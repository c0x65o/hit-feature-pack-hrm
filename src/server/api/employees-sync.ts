import { NextRequest, NextResponse } from 'next/server';

import { getDb } from '@/lib/db';
import { extractUserFromRequest, requirePageAccess } from '../auth';
import {
  getAuthUrlFromRequest,
  getForwardedBearerFromRequest,
  syncEmployeesWithAuthUsers,
} from '../lib/employee-provisioning';
import { checkAuthCoreReadScope } from '@hit/feature-pack-auth-core/server/lib/require-action';
import { requireHrmAction } from '../lib/require-action';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * POST /api/hrm/employees/sync
 * Manually sync HRM employees with auth users.
 */
export async function POST(request: NextRequest) {
  const gate = await requirePageAccess(request, '/hrm/employees');
  if (gate instanceof NextResponse) return gate;

  const actionGate = await requireHrmAction(request, 'hrm.employees.sync');
  if (actionGate) return actionGate;

  const user = extractUserFromRequest(request);
  if (!user?.email) return jsonError('Unauthorized', 401);

  const db = getDb();
  const bearer = getForwardedBearerFromRequest(request);
  const authUrl = getAuthUrlFromRequest(request);

  const adminAccess = await checkAuthCoreReadScope(request);
  const directoryLimit = 500;

  let users: any[] = [];
  let allowDeactivation = false;
  let authDirectoryPath = '/directory/users';
  let authDirectorySource: 'admin' | 'directory' = 'directory';
  let authDirectoryStatus: number | null = null;

  let usedAdmin = false;
  if (adminAccess.ok) {
    const adminHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (bearer) adminHeaders['Authorization'] = bearer;
    const cookieHeader = request.headers.get('cookie') || request.headers.get('Cookie') || '';
    if (cookieHeader) adminHeaders['Cookie'] = cookieHeader;
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    if (host) adminHeaders['X-Frontend-Base-URL'] = `${proto}://${host}`;

    const adminRes = await fetch(`${authUrl}/users`, {
      method: 'GET',
      headers: adminHeaders,
      credentials: 'include',
    });
    authDirectoryStatus = adminRes.status;

    if (adminRes.ok) {
      const adminUsers = await adminRes.json().catch(() => []);
      if (!Array.isArray(adminUsers)) {
        return jsonError('Unexpected auth users response', 500);
      }
      users = adminUsers;
      allowDeactivation = true;
      authDirectoryPath = '/users';
      authDirectorySource = 'admin';
      usedAdmin = true;
    }
  }

  if (!usedAdmin) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (bearer) headers['Authorization'] = bearer;
    const cookieHeader = request.headers.get('cookie') || request.headers.get('Cookie') || '';
    if (cookieHeader) headers['Cookie'] = cookieHeader;
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    if (host) headers['X-Frontend-Base-URL'] = `${proto}://${host}`;

    const res = await fetch(`${authUrl}/directory/users?limit=${directoryLimit}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    authDirectoryStatus = res.status;
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: body?.error || body?.detail || body?.message || `Auth directory users failed (${res.status})` },
        { status: res.status }
      );
    }

    const directoryUsers = await res.json().catch(() => []);
    if (!Array.isArray(directoryUsers)) {
      return jsonError('Unexpected auth directory response', 500);
    }

    users = directoryUsers;
    allowDeactivation = false;
    authDirectoryPath = '/directory/users';
    authDirectorySource = 'directory';
  }

  const currentEmail = String(user?.email || '').trim().toLowerCase();
  if (currentEmail) {
    const hasCurrent = users.some((u: any) => String(u?.email || '').trim().toLowerCase() === currentEmail);
    if (!hasCurrent) users.push({ email: currentEmail, isActive: true });
  }

  const { ensured, reactivated, deactivated, deleted } = await syncEmployeesWithAuthUsers({
    db,
    users,
    allowDeactivation,
  });

  return NextResponse.json({
    ok: true,
    ensured,
    reactivated,
    deactivated,
    deleted,
    authDirectorySource,
    authDirectoryPath,
    authDirectoryStatus,
    authUserCount: Array.isArray(users) ? users.length : 0,
  });
}
