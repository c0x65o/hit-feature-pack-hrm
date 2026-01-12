import { NextRequest, NextResponse } from 'next/server';
import { eq, inArray, or, and } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { employees, userOrgAssignments } from '@/lib/feature-pack-schemas';
import { requireAuth, extractUserFromRequest } from '../auth';
import { resolveHrmScopeMode } from '../lib/scope-mode';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getIdFromPath(request: NextRequest): string {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // Path is /api/hrm/employees/[id]/photo - id is second to last
  return decodeURIComponent(parts[parts.length - 2] || '');
}

function getForwardedBearerFromRequest(request: NextRequest): string {
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return '';
}

function getAuthUrlFromRequest(request: NextRequest): string {
  // Check for x-auth-url header (set by proxy)
  const authUrl = request.headers.get('x-auth-url');
  if (authUrl) return authUrl;
  
  // Fall back to inferring from request URL
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}/api/proxy/auth`;
}

async function fetchUserOrgScopeIds(db: any, userKey: string): Promise<{
  divisionIds: string[];
  departmentIds: string[];
  locationIds: string[];
}> {
  const rows = await db
    .select({
      divisionId: userOrgAssignments.divisionId,
      departmentId: userOrgAssignments.departmentId,
      locationId: userOrgAssignments.locationId,
    })
    .from(userOrgAssignments)
    .where(eq(userOrgAssignments.userKey, userKey));

  const divisionIds: string[] = [];
  const departmentIds: string[] = [];
  const locationIds: string[] = [];

  for (const r of rows as any[]) {
    if (r.divisionId && !divisionIds.includes(r.divisionId)) divisionIds.push(r.divisionId);
    if (r.departmentId && !departmentIds.includes(r.departmentId)) departmentIds.push(r.departmentId);
    if (r.locationId && !locationIds.includes(r.locationId)) locationIds.push(r.locationId);
  }

  return { divisionIds, departmentIds, locationIds };
}

async function canAccessEmployeeForWrite(
  db: any,
  request: NextRequest,
  employeeUserEmail: string
): Promise<boolean> {
  const user = extractUserFromRequest(request);
  if (!user?.sub || !user?.email) return false;

  // Always allow users to update their own photo (self-service)
  if (employeeUserEmail.toLowerCase() === user.email.toLowerCase()) {
    return true;
  }

  const mode = await resolveHrmScopeMode(request, { entity: 'employees', verb: 'write' });
  
  if (mode === 'none') {
    return false;
  } else if (mode === 'own') {
    // Already handled above (self-service)
    return false;
  } else if (mode === 'any') {
    return true;
  } else if (mode === 'ldd') {
    // Check if employee's user has matching LDD assignments
    const scopeIds = await fetchUserOrgScopeIds(db, user.sub);
    
    // Check if the employee's userEmail has matching assignments
    const assignmentRows = await db
      .select({ id: userOrgAssignments.id })
      .from(userOrgAssignments)
      .where(
        and(
          eq(userOrgAssignments.userKey, employeeUserEmail),
          or(
            scopeIds.divisionIds.length ? inArray(userOrgAssignments.divisionId, scopeIds.divisionIds) : undefined,
            scopeIds.departmentIds.length ? inArray(userOrgAssignments.departmentId, scopeIds.departmentIds) : undefined,
            scopeIds.locationIds.length ? inArray(userOrgAssignments.locationId, scopeIds.locationIds) : undefined
          )!
        )
      )
      .limit(1);
    
    return assignmentRows.length > 0;
  }
  
  return false;
}

/**
 * PUT /api/hrm/employees/[id]/photo
 * 
 * Allows updating an employee's profile photo.
 * - Users can always update their own photo (self-service)
 * - For other employees, requires write scope access (any/ldd mode)
 * 
 * Body: { profile_picture_url: string | null }
 */
export async function PUT(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;
  if (!user.email) return jsonError('Missing user email', 400);

  const id = getIdFromPath(request);
  if (!id) return jsonError('Missing employee id', 400);

  const body = (await request.json().catch(() => null)) as
    | { profile_picture_url?: unknown }
    | null;

  if (!body || body.profile_picture_url === undefined) {
    return jsonError('profile_picture_url is required', 400);
  }

  const profilePictureUrl = body.profile_picture_url === null 
    ? null 
    : String(body.profile_picture_url);

  // Get the employee to find their email
  const db = getDb();
  const rows = await db.select().from(employees).where(eq(employees.id, id as any)).limit(1);
  const employee = rows[0] ?? null;
  if (!employee) return jsonError('Employee not found', 404);

  // Check if this is the current user updating their own photo (self-service)
  const isSelf = (employee as any).userEmail.toLowerCase() === user.email.toLowerCase();

  if (!isSelf) {
    // For updating another user's photo, check scope-based write access
    const canAccess = await canAccessEmployeeForWrite(db, request, (employee as any).userEmail);
    if (!canAccess) {
      return jsonError('Forbidden', 403);
    }
  }

  const token = getForwardedBearerFromRequest(request);
  const authUrl = getAuthUrlFromRequest(request);

  // Use /me endpoint for self, /users/{email} for others
  const endpoint = isSelf ? '/me' : `/users/${encodeURIComponent((employee as any).userEmail)}`;
  const response = await fetch(`${authUrl}${endpoint}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ profile_picture_url: profilePictureUrl }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    return jsonError(data?.detail || data?.error || 'Failed to update profile picture', response.status);
  }

  const data = await response.json().catch(() => ({}));
  return NextResponse.json({
    success: true,
    profile_picture_url: data.profile_picture_url ?? profilePictureUrl,
  });
}
