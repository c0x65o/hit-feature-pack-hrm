import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, inArray, or } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { employees, userOrgAssignments } from '@/lib/feature-pack-schemas';
import { requirePageAccess, extractUserFromRequest } from '../auth';
import { resolveHrmScopeMode } from '../lib/scope-mode';
import { forbiddenError, jsonError } from '../lib/api-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getIdFromPath(request: NextRequest): string {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  return decodeURIComponent(parts[parts.length - 2] || '');
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

async function canAccessEmployee(
  db: any,
  request: NextRequest,
  employeeUserEmail: string,
  verb: 'read' | 'write'
): Promise<boolean> {
  const user = extractUserFromRequest(request);
  if (!user?.sub || !user?.email) return false;

  const mode = await resolveHrmScopeMode(request, { entity: 'employees', verb });

  if (mode === 'none') {
    return false;
  } else if (mode === 'own') {
    return employeeUserEmail.toLowerCase() === user.email.toLowerCase();
  } else if (mode === 'any') {
    return true;
  } else if (mode === 'ldd') {
    if (employeeUserEmail.toLowerCase() === user.email.toLowerCase()) {
      return true;
    }

    const scopeIds = await fetchUserOrgScopeIds(db, user.sub);
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
 * GET /api/hrm/employees/[id]/org-scope
 * Get the org assignment for the employee's userKey.
 */
export async function GET(request: NextRequest) {
  const gate = await requirePageAccess(request, '/hrm/employees/[id]/edit');
  if (gate instanceof NextResponse) return gate;

  const id = getIdFromPath(request);
  if (!id) return jsonError('Missing employee id', 400);

  const db = getDb();
  const rows = await db.select().from(employees).where(eq(employees.id, id as any)).limit(1);
  const employee = rows[0] ?? null;
  if (!employee) return jsonError('Employee not found', 404);

  const email = String((employee as any).userEmail || '').trim();
  if (!email) return jsonError('Employee is missing userEmail', 400);

  const canAccess = await canAccessEmployee(db, request, email, 'write');
  if (!canAccess) {
    return forbiddenError({
      message: 'Permission denied',
      detail: 'You can only edit org scope for your own employee record. To edit other employees, contact an admin to grant HRM write scope.',
      code: 'HRM_ORG_SCOPE_WRITE_DENIED',
      requiredPermission: 'hrm.employees.write.scope.ldd or hrm.employees.write.scope.all',
    });
  }

  const assignments = await db
    .select({
      id: userOrgAssignments.id,
      divisionId: userOrgAssignments.divisionId,
      departmentId: userOrgAssignments.departmentId,
      locationId: userOrgAssignments.locationId,
      createdAt: userOrgAssignments.createdAt,
    })
    .from(userOrgAssignments)
    .where(eq(userOrgAssignments.userKey, email))
    .orderBy(desc(userOrgAssignments.createdAt));

  return NextResponse.json({ items: assignments });
}

/**
 * PUT /api/hrm/employees/[id]/org-scope
 * Upsert the org assignment for the employee's userKey.
 */
export async function PUT(request: NextRequest) {
  const gate = await requirePageAccess(request, '/hrm/employees/[id]/edit');
  if (gate instanceof NextResponse) return gate;

  const id = getIdFromPath(request);
  if (!id) return jsonError('Missing employee id', 400);

  const db = getDb();
  const rows = await db.select().from(employees).where(eq(employees.id, id as any)).limit(1);
  const employee = rows[0] ?? null;
  if (!employee) return jsonError('Employee not found', 404);

  const email = String((employee as any).userEmail || '').trim();
  if (!email) return jsonError('Employee is missing userEmail', 400);

  const canAccess = await canAccessEmployee(db, request, email, 'write');
  if (!canAccess) {
    return forbiddenError({
      message: 'Permission denied',
      detail: 'You can only update org scope for your own employee record. To update other employees, contact an admin to grant HRM write scope.',
      code: 'HRM_ORG_SCOPE_WRITE_DENIED',
      requiredPermission: 'hrm.employees.write.scope.ldd or hrm.employees.write.scope.all',
    });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        divisionId?: unknown;
        departmentId?: unknown;
        locationId?: unknown;
      }
    | null;

  if (!body) return jsonError('Missing request body', 400);

  const divisionIdRaw = body?.divisionId === undefined ? undefined : String(body.divisionId || '').trim();
  const departmentIdRaw = body?.departmentId === undefined ? undefined : String(body.departmentId || '').trim();
  const locationIdRaw = body?.locationId === undefined ? undefined : String(body.locationId || '').trim();

  const divisionId = divisionIdRaw === undefined ? undefined : divisionIdRaw || null;
  const departmentId = departmentIdRaw === undefined ? undefined : departmentIdRaw || null;
  const locationId = locationIdRaw === undefined ? undefined : locationIdRaw || null;

  const hasAny = Boolean(
    (divisionId !== undefined ? divisionId : null) ||
      (departmentId !== undefined ? departmentId : null) ||
      (locationId !== undefined ? locationId : null)
  );
  if (!hasAny) {
    return jsonError('Select at least one division, department, or location.', 400);
  }

  const existingRows = await db
    .select({ id: userOrgAssignments.id })
    .from(userOrgAssignments)
    .where(eq(userOrgAssignments.userKey, email))
    .limit(1);
  const existing = existingRows[0] ?? null;

  if (existing) {
    const updateData: Record<string, any> = {};
    if (divisionId !== undefined) updateData.divisionId = divisionId;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (locationId !== undefined) updateData.locationId = locationId;

    const [updated] = await db
      .update(userOrgAssignments)
      .set(updateData)
      .where(eq(userOrgAssignments.id, existing.id))
      .returning();

    return NextResponse.json(updated);
  }

  const user = extractUserFromRequest(request);
  const [created] = await db
    .insert(userOrgAssignments)
    .values({
      userKey: email,
      divisionId: divisionId ?? null,
      departmentId: departmentId ?? null,
      locationId: locationId ?? null,
      createdByUserKey: user?.email || user?.sub || null,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
