import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, or, sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { employees, positions, userOrgAssignments } from '@/lib/feature-pack-schemas';
import { requirePageAccess, extractUserFromRequest } from '../auth';
import { resolveHrmScopeMode } from '../lib/scope-mode';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getEmployeeIdFromPath(request: NextRequest): string {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const idx = parts.lastIndexOf('employees');
  if (idx === -1 || parts.length <= idx + 1) return '';
  return decodeURIComponent(parts[idx + 1] || '');
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

async function buildScopeCondition(db: any, request: NextRequest) {
  const user = extractUserFromRequest(request);
  if (!user?.sub || !user?.email) return { user: null, where: sql<boolean>`false` };

  const mode = await resolveHrmScopeMode(request, { entity: 'employees', verb: 'read' });
  const conditions: any[] = [];

  if (mode === 'none') {
    conditions.push(sql<boolean>`false`);
  } else if (mode === 'own') {
    conditions.push(eq(employees.userEmail, user.email));
  } else if (mode === 'ldd') {
    const scopeIds = await fetchUserOrgScopeIds(db, user.sub);
    const ownCondition = eq(employees.userEmail, user.email);
    const lddParts: any[] = [];

    if (scopeIds.divisionIds.length) {
      lddParts.push(
        sql`exists (
          select 1 from ${userOrgAssignments}
          where ${userOrgAssignments.userKey} = ${employees.userEmail}
            and ${userOrgAssignments.divisionId} in (${sql.join(scopeIds.divisionIds.map(id => sql`${id}`), sql`, `)})
        )`
      );
    }
    if (scopeIds.departmentIds.length) {
      lddParts.push(
        sql`exists (
          select 1 from ${userOrgAssignments}
          where ${userOrgAssignments.userKey} = ${employees.userEmail}
            and ${userOrgAssignments.departmentId} in (${sql.join(scopeIds.departmentIds.map(id => sql`${id}`), sql`, `)})
        )`
      );
    }
    if (scopeIds.locationIds.length) {
      lddParts.push(
        sql`exists (
          select 1 from ${userOrgAssignments}
          where ${userOrgAssignments.userKey} = ${employees.userEmail}
            and ${userOrgAssignments.locationId} in (${sql.join(scopeIds.locationIds.map(id => sql`${id}`), sql`, `)})
        )`
      );
    }

    if (lddParts.length > 0) {
      conditions.push(or(ownCondition, or(...lddParts)!)!);
    } else {
      conditions.push(ownCondition);
    }
  } else if (mode === 'any') {
    // no additional filter
  }

  return {
    user,
    where: conditions.length > 0 ? and(...conditions) : undefined,
  };
}

type OrgTreeNode = {
  id: string;
  managerId: string | null;
  userEmail: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  profilePictureUrl: string | null;
  positionName: string | null;
  isActive: boolean;
  children: OrgTreeNode[];
};

/**
 * GET /api/hrm/employees/[id]/direct-reports
 */
export async function GET(request: NextRequest) {
  const gate = await requirePageAccess(request, '/hrm/employees/[id]');
  if (gate instanceof NextResponse) return gate;

  const id = getEmployeeIdFromPath(request);
  if (!id) return jsonError('Missing employee id', 400);

  const db = getDb();
  const rows = await db.select().from(employees).where(eq(employees.id, id as any)).limit(1);
  const employee = rows[0] ?? null;
  if (!employee) return jsonError('Employee not found', 404);

  const canAccess = await canAccessEmployee(db, request, (employee as any).userEmail, 'read');
  if (!canAccess) {
    return jsonError('Employee not found', 404);
  }

  const scope = await buildScopeCondition(db, request);
  if (!scope.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const selectFields = {
    id: employees.id,
    managerId: employees.managerId,
    userEmail: employees.userEmail,
    firstName: employees.firstName,
    lastName: employees.lastName,
    preferredName: employees.preferredName,
    profilePictureUrl: employees.profilePictureUrl,
    positionName: positions.name,
    isActive: employees.isActive,
  };

  const allRows = scope.where
    ? await db
        .select(selectFields)
        .from(employees)
        .leftJoin(positions, eq(employees.positionId, positions.id))
        .where(scope.where)
    : await db
        .select(selectFields)
        .from(employees)
        .leftJoin(positions, eq(employees.positionId, positions.id));

  const nodesById = new Map<string, OrgTreeNode>();
  for (const row of allRows as any[]) {
    nodesById.set(String(row.id), {
      id: String(row.id),
      managerId: row.managerId ? String(row.managerId) : null,
      userEmail: String(row.userEmail || ''),
      firstName: String(row.firstName || ''),
      lastName: String(row.lastName || ''),
      preferredName: row.preferredName ? String(row.preferredName) : null,
      profilePictureUrl: row.profilePictureUrl ? String(row.profilePictureUrl) : null,
      positionName: row.positionName ? String(row.positionName) : null,
      isActive: Boolean(row.isActive),
      children: [],
    });
  }

  for (const node of nodesById.values()) {
    // Prevent self-cycles (employee.managerId === employee.id) from making the root its own child.
    if (node.managerId && node.managerId !== node.id && nodesById.has(node.managerId)) {
      nodesById.get(node.managerId)!.children.push(node);
    }
  }

  const root = nodesById.get(String(id));
  if (!root) {
    return NextResponse.json({ directReports: [], orgTree: [] });
  }

  const rootEmail = String((employee as any)?.userEmail || '').trim().toLowerCase();
  const directReports = root.children
    .filter((child) => String(child.id) !== String(id))
    .filter((child) => {
      if (!rootEmail) return true;
      const childEmail = String(child.userEmail || '').trim().toLowerCase();
      return childEmail ? childEmail !== rootEmail : true;
    })
    .map((child) => ({
      ...child,
      children: [],
    }));

  return NextResponse.json({
    directReports,
    orgTree: [root],
  });
}
