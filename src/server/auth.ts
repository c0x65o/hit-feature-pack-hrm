import { NextRequest, NextResponse } from 'next/server';

export interface User {
  sub: string;
  email: string;
  roles?: string[];
}

function getEnvFlag(name: string): boolean {
  const env = (globalThis as any)?.process?.env || {};
  const raw = String(env[name] || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function isAuthDebug(): boolean {
  return getEnvFlag('HIT_AUTH_DEBUG') || getEnvFlag('HIT_DEBUG');
}

function formatDebugDetails(input: Record<string, unknown>): string {
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
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

function getExternalOriginFromRequest(request: NextRequest): string {
  // Prefer an explicitly provided frontend base URL (some proxies strip/override host headers).
  const explicit =
    request.headers.get('x-frontend-base-url') || request.headers.get('X-Frontend-Base-URL') || '';
  if (explicit && explicit.trim()) return explicit.trim().replace(/\/$/, '');

  const hostRaw = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const protoRaw = request.headers.get('x-forwarded-proto') || 'https';

  // Handle comma-separated values from chained proxies.
  const host = String(hostRaw).split(',')[0]?.trim();
  const proto = String(protoRaw).split(',')[0]?.trim() || 'https';

  if (host) return `${proto}://${host}`;
  return new URL(request.url).origin;
}

function getAuthProxyBaseUrlFromRequest(request: NextRequest): string {
  // Server-side fetch() requires absolute URL.
  const origin = getExternalOriginFromRequest(request);
  // Auth is app-local (Next.js API dispatcher under /api/auth).
  return `${origin}/api/auth`;
}

function getFrontendBaseUrlFromRequest(request: NextRequest): string {
  return getExternalOriginFromRequest(request);
}

function getAuthBaseUrl(request: NextRequest): { baseUrl: string; source: string } {
  // No external auth base URL. Always use app-local auth API.
  return { baseUrl: getAuthProxyBaseUrlFromRequest(request).replace(/\/$/, ''), source: 'local' };
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
    const roles = xUserRoles
      ? xUserRoles
          .split(',')
          .map((r: string) => r.trim())
          .filter(Boolean)
      : [];
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

  // Admins always have access to pages (defaultRolesAllow) and should not be blocked
  // by transient auth module/proxy outages.
  const isAdmin = (user.roles || [])
    .map((r: string) => String(r || '').trim().toLowerCase())
    .includes('admin');
  if (isAdmin) return user;

  const bearer = getForwardedBearerFromRequest(request);
  if (!bearer) {
    if (isAuthDebug()) {
      console.warn('[hrm auth] missing bearer for page check', {
        pagePath,
        hasCookie: Boolean(request.cookies.get('hit_token')?.value),
        hasAuthHeader: Boolean(request.headers.get('authorization') || request.headers.get('Authorization')),
        requestId: request.headers.get('x-request-id') || request.headers.get('X-Request-Id') || null,
      });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { baseUrl, source } = getAuthBaseUrl(request);
  const frontendBaseUrl = getFrontendBaseUrlFromRequest(request);
  try {
    // Prefer direct auth module URL when available (avoids "server calls itself via ingress" failures).
    // Still use the same endpoint so failures include diagnostic context.
    const res = await fetch(`${baseUrl}/permissions/pages/check${String(pagePath)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: bearer,
        ...(frontendBaseUrl ? { 'X-Frontend-Base-URL': frontendBaseUrl } : {}),
      },
      credentials: 'include',
    });
    const json = await res.json().catch(() => ({}));

    // Fail closed if auth proxy returns non-200 or unexpected shape.
    const allowed = Boolean((json as any)?.has_permission ?? (json as any)?.hasPermission ?? false);
    if (isAuthDebug()) {
      console.warn('[hrm auth] page check response', {
        pagePath,
        status: res.status,
        ok: res.ok,
        allowed,
        authBaseUrl: baseUrl,
        authBaseSource: source,
        frontendBaseUrl,
        body: json,
        requestId: request.headers.get('x-request-id') || request.headers.get('X-Request-Id') || null,
      });
    }

    if (!res.ok || !allowed) {
      const debugPayload = {
        status: res.status,
        authBaseSource: source,
        authBaseUrl: baseUrl,
        allowed,
        body: json,
      };
      const debugSuffix = isAuthDebug() ? ` ${formatDebugDetails(debugPayload)}` : '';
      // Keep response safe/minimal but include enough to debug in audit logs.
      const debug = typeof json === 'object' && json ? json : { raw: json };
      return NextResponse.json(
        {
          error: `Forbidden${debugSuffix}`,
          code: 'page_access_denied',
          pagePath,
          authz: {
            status: res.status,
            authBaseSource: source,
            ...(debug as any),
          },
        },
        { status: 403 }
      );
    }
    return user;
  } catch (e: any) {
    if (isAuthDebug()) {
      console.warn('[hrm auth] page check exception', {
        pagePath,
        authBaseUrl: baseUrl,
        authBaseSource: source,
        frontendBaseUrl,
        message: e?.message ? String(e.message) : 'Auth check threw',
        requestId: request.headers.get('x-request-id') || request.headers.get('X-Request-Id') || null,
      });
    }
    return NextResponse.json(
      {
        error: 'Auth service unavailable',
        code: 'auth_unavailable',
        pagePath,
        authz: {
          status: null,
          source: 'auth_proxy_exception',
          authBaseSource: source,
          authBaseUrl: baseUrl,
          message: e?.message ? String(e.message) : 'Auth check threw',
        },
      },
      { status: 503 }
    );
  }
}
