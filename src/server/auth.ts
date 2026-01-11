import { NextRequest, NextResponse } from 'next/server';

export interface User {
  sub: string;
  email: string;
  roles?: string[];
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

