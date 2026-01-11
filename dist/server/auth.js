import { NextResponse } from 'next/server';
function getForwardedBearerFromRequest(request) {
    const rawTokenHeader = request.headers.get('x-hit-token-raw') || request.headers.get('X-HIT-Token-Raw');
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const cookieToken = request.cookies.get('hit_token')?.value || null;
    const bearer = rawTokenHeader && rawTokenHeader.trim()
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
function getAuthProxyBaseUrlFromRequest(request) {
    // Server-side fetch() requires absolute URL.
    const origin = new URL(request.url).origin;
    return `${origin}/api/proxy/auth`;
}
export function extractUserFromRequest(request) {
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
    if (!token)
        return null;
    try {
        const parts = token.split('.');
        if (parts.length !== 3)
            return null;
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
            return null;
        }
        const email = payload.email || '';
        const rolesRaw = payload.roles ?? payload.role ?? [];
        const roles = Array.isArray(rolesRaw)
            ? rolesRaw.map((r) => String(r)).map((r) => r.trim()).filter(Boolean)
            : typeof rolesRaw === 'string'
                ? [rolesRaw.trim()].filter(Boolean)
                : [];
        return {
            sub: payload.sub || email || '',
            email,
            roles,
        };
    }
    catch {
        return null;
    }
}
export function requireAuth(request) {
    const user = extractUserFromRequest(request);
    if (!user?.sub)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return user;
}
export function requireAdmin(request) {
    const user = requireAuth(request);
    if (user instanceof NextResponse)
        return user;
    if (!(user.roles || []).map((r) => String(r || '').toLowerCase()).includes('admin')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return user;
}
export async function requirePageAccess(request, pagePath) {
    const user = requireAuth(request);
    if (user instanceof NextResponse)
        return user;
    const bearer = getForwardedBearerFromRequest(request);
    if (!bearer)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const authBase = getAuthProxyBaseUrlFromRequest(request);
    try {
        const res = await fetch(`${authBase}/permissions/pages/check-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: bearer },
            credentials: 'include',
            body: JSON.stringify([String(pagePath)]),
        });
        if (!res.ok)
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        const json = await res.json().catch(() => ({}));
        const allowed = Boolean(json?.[String(pagePath)]);
        if (!allowed)
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        return user;
    }
    catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
}
