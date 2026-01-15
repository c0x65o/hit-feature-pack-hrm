import { NextResponse } from 'next/server';
import { and, eq, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { employees, userOrgAssignments } from '@/lib/feature-pack-schemas';
import { requirePageAccess, extractUserFromRequest } from '../auth';
import { resolveHrmScopeMode } from '../lib/scope-mode';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
async function fetchUserOrgScopeIds(db, userKey) {
    const rows = await db
        .select({
        divisionId: userOrgAssignments.divisionId,
        departmentId: userOrgAssignments.departmentId,
        locationId: userOrgAssignments.locationId,
    })
        .from(userOrgAssignments)
        .where(eq(userOrgAssignments.userKey, userKey));
    const divisionIds = [];
    const departmentIds = [];
    const locationIds = [];
    for (const r of rows) {
        if (r.divisionId && !divisionIds.includes(r.divisionId))
            divisionIds.push(r.divisionId);
        if (r.departmentId && !departmentIds.includes(r.departmentId))
            departmentIds.push(r.departmentId);
        if (r.locationId && !locationIds.includes(r.locationId))
            locationIds.push(r.locationId);
    }
    return { divisionIds, departmentIds, locationIds };
}
async function buildScopeCondition(db, request) {
    const user = extractUserFromRequest(request);
    if (!user?.sub || !user?.email)
        return { user: null, where: sql `false` };
    const mode = await resolveHrmScopeMode(request, { entity: 'employees', verb: 'read' });
    const conditions = [];
    if (mode === 'none') {
        conditions.push(sql `false`);
    }
    else if (mode === 'own') {
        conditions.push(eq(employees.userEmail, user.email));
    }
    else if (mode === 'ldd') {
        const scopeIds = await fetchUserOrgScopeIds(db, user.sub);
        const ownCondition = eq(employees.userEmail, user.email);
        const lddParts = [];
        if (scopeIds.divisionIds.length) {
            lddParts.push(sql `exists (
          select 1 from ${userOrgAssignments}
          where ${userOrgAssignments.userKey} = ${employees.userEmail}
            and ${userOrgAssignments.divisionId} in (${sql.join(scopeIds.divisionIds.map((id) => sql `${id}`), sql `, `)})
        )`);
        }
        if (scopeIds.departmentIds.length) {
            lddParts.push(sql `exists (
          select 1 from ${userOrgAssignments}
          where ${userOrgAssignments.userKey} = ${employees.userEmail}
            and ${userOrgAssignments.departmentId} in (${sql.join(scopeIds.departmentIds.map((id) => sql `${id}`), sql `, `)})
        )`);
        }
        if (scopeIds.locationIds.length) {
            lddParts.push(sql `exists (
          select 1 from ${userOrgAssignments}
          where ${userOrgAssignments.userKey} = ${employees.userEmail}
            and ${userOrgAssignments.locationId} in (${sql.join(scopeIds.locationIds.map((id) => sql `${id}`), sql `, `)})
        )`);
        }
        if (lddParts.length > 0) {
            conditions.push(or(ownCondition, or(...lddParts)));
        }
        else {
            conditions.push(ownCondition);
        }
    }
    else if (mode === 'any') {
        // no additional filter
    }
    return {
        user,
        where: conditions.length > 0 ? and(...conditions) : undefined,
    };
}
/**
 * GET /api/hrm/employees/org-tree
 */
export async function GET(request) {
    const gate = await requirePageAccess(request, '/hrm/org-chart');
    if (gate instanceof NextResponse)
        return gate;
    const db = getDb();
    const scope = await buildScopeCondition(db, request);
    if (!scope.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const rows = scope.where
        ? await db
            .select({
            id: employees.id,
            managerId: employees.managerId,
            userEmail: employees.userEmail,
            firstName: employees.firstName,
            lastName: employees.lastName,
            preferredName: employees.preferredName,
            isActive: employees.isActive,
        })
            .from(employees)
            .where(scope.where)
        : await db
            .select({
            id: employees.id,
            managerId: employees.managerId,
            userEmail: employees.userEmail,
            firstName: employees.firstName,
            lastName: employees.lastName,
            preferredName: employees.preferredName,
            isActive: employees.isActive,
        })
            .from(employees);
    const nodesById = new Map();
    for (const row of rows) {
        nodesById.set(String(row.id), {
            id: String(row.id),
            managerId: row.managerId ? String(row.managerId) : null,
            userEmail: String(row.userEmail || ''),
            firstName: String(row.firstName || ''),
            lastName: String(row.lastName || ''),
            preferredName: row.preferredName ? String(row.preferredName) : null,
            isActive: Boolean(row.isActive),
            children: [],
        });
    }
    const roots = [];
    for (const node of nodesById.values()) {
        if (node.managerId && nodesById.has(node.managerId)) {
            nodesById.get(node.managerId).children.push(node);
        }
        else {
            roots.push(node);
        }
    }
    if (!roots.length) {
        return jsonError('No org chart data available', 404);
    }
    return NextResponse.json({ orgTree: roots });
}
