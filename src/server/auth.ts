import { NextRequest, NextResponse } from 'next/server';

export interface User {
  sub: string;
  email: string;
  roles?: string[];
}

function getForwardedBearerFromRequest(request: NextRequest): string {
  const rawTokenHeader = request.headers.get('x-hit-token-raw') || request.headers.get('X-HIT-Token-Raw');
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const cookieToken = request.cookies.get('hit_token')?.value || null;
  const bearer =
    rawTokenHeader && rawTokenHeader.trim()
      ? rawTokenHeader.trim().startsWith('Bearer ')
        ? rawTokenHeader.trim()
        : `Bearer ${rawTokenHeader.trim()}`
      : authHeader && authHeader.trim()
        ? authHeader
        : cookieToken
          ? `Bearer ${cookieToken}`
          : '';
  return bearer;
}

function getAuthProxyBaseUrlFromRequest(request: NextRequest): string {
  // Server-side fetch() requires absolute URL.
  const origin = new URL(request.url).origin;
  return `${origin}/api/proxy/auth`;
}

export function extractUserFromRequest(request: NextRequest): User | null {
  // Check for token in cookie first
  let token = request.cookies.get('hit_token')?.value;

  // Fall back to Authorization header
  if (!token) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  // Fall back to x-user-* headers (set by proxy in production)
  const xUserId = request.headers.get('x-user-id');
  if (xUserId) {
    const xUserEmail = request.headers.get('x-user-email') || '';
    const xUserRoles = request.headers.get('x-user-roles');
    const roles = xUserRoles ? xUserRoles.split(',').map((r) => r.trim()).filter(Boolean) : [];
    return { sub: xUserId, email: xUserEmail, roles };
  }

  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }

    const email = payload.email || '';
    const rolesRaw = payload.roles ?? payload.role ?? [];
    const roles = Array.isArray(rolesRaw)
      ? rolesRaw.map((r: unknown) => String(r)).map((r: string) => r.trim()).filter(Boolean)
      : typeof rolesRaw === 'string'
        ? [rolesRaw.trim()].filter(Boolean)
        : [];

    return {
      sub: payload.sub || email || '',
      email,
      roles,
    };
  } catch {
    return null;
  }
}

export function requireAuth(request: NextRequest): User | NextResponse {
  const user = extractUserFromRequest(request);
  if (!user?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return user;
}

export function requireAdmin(request: NextRequest): User | NextResponse {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;
  if (!(user.roles || []).map((r: string) => String(r || '').toLowerCase()).includes('admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return user;
}

export async function requirePageAccess(request: NextRequest, pagePath: string): Promise<User | NextResponse> {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const bearer = getForwardedBearerFromRequest(request);
  if (!bearer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // IMPORTANT (prod parity):
  // Many deployed environments inject X-HIT-Service-Token on the *incoming* request to the app
  // (so modules can resolve config/db via provisioner). Server-side fetches to our own proxy
  // must forward it explicitly; `credentials: 'include'` does not forward headers in Next's
  // server runtime.
  const serviceToken =
    request.headers.get('x-hit-service-token') ||
    request.headers.get('X-HIT-Service-Token') ||
    '';

  const authBase = getAuthProxyBaseUrlFromRequest(request);
  try {
    // Use the single-page check endpoint so failures include diagnostic context
    // (e.g. source: no_permission_sets | no_grant | unknown_page).
    const res = await fetch(`${authBase}/permissions/pages/check${String(pagePath)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: bearer,
        ...(serviceToken ? { 'X-HIT-Service-Token': serviceToken } : {}),
      },
      credentials: 'include',
    });
    const json = await res.json().catch(() => ({}));

    // Fail closed if auth proxy returns non-200 or unexpected shape.
    const allowed = Boolean((json as any)?.has_permission ?? (json as any)?.hasPermission ?? false);
    if (!res.ok || !allowed) {
      // Keep response safe/minimal but include enough to debug in audit logs.
      const debug = typeof json === 'object' && json ? json : { raw: json };
      return NextResponse.json(
        {
          error: 'Forbidden',
          code: 'page_access_denied',
          pagePath,
          authz: {
            status: res.status,
            ...(debug as any),
          },
        },
        { status: 403 }
      );
    }
    return user;
  } catch {
    return NextResponse.json(
      { error: 'Forbidden', code: 'page_access_denied', pagePath, authz: { status: null, source: 'auth_proxy_exception' } },
      { status: 403 }
    );
  }
}
