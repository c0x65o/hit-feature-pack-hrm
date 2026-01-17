import { NextResponse } from 'next/server';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { employees, userOrgAssignments } from '@/lib/feature-pack-schemas';
import { requirePageAccess, extractUserFromRequest } from '../auth';
import { resolveHrmScopeMode } from '../lib/scope-mode';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
function getEmployeeIdFromPath(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.lastIndexOf('employees');
    if (idx === -1 || parts.length <= idx + 1)
        return '';
    return decodeURIComponent(parts[idx + 1] || '');
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
async function canAccessEmployee(db, request, employeeUserEmail, verb) {
    const user = extractUserFromRequest(request);
    if (!user?.sub || !user?.email)
        return false;
    const mode = await resolveHrmScopeMode(request, { entity: 'employees', verb });
    if (mode === 'none') {
        return false;
    }
    else if (mode === 'own') {
        return employeeUserEmail.toLowerCase() === user.email.toLowerCase();
    }
    else if (mode === 'any') {
        return true;
    }
    else if (mode === 'ldd') {
        if (employeeUserEmail.toLowerCase() === user.email.toLowerCase()) {
            return true;
        }
        const scopeIds = await fetchUserOrgScopeIds(db, user.sub);
        const assignmentRows = await db
            .select({ id: userOrgAssignments.id })
            .from(userOrgAssignments)
            .where(and(eq(userOrgAssignments.userKey, employeeUserEmail), or(scopeIds.divisionIds.length ? inArray(userOrgAssignments.divisionId, scopeIds.divisionIds) : undefined, scopeIds.departmentIds.length ? inArray(userOrgAssignments.departmentId, scopeIds.departmentIds) : undefined, scopeIds.locationIds.length ? inArray(userOrgAssignments.locationId, scopeIds.locationIds) : undefined)))
            .limit(1);
        return assignmentRows.length > 0;
    }
    return false;
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
            and ${userOrgAssignments.divisionId} in (${sql.join(scopeIds.divisionIds.map(id => sql `${id}`), sql `, `)})
        )`);
        }
        if (scopeIds.departmentIds.length) {
            lddParts.push(sql `exists (
          select 1 from ${userOrgAssignments}
          where ${userOrgAssignments.userKey} = ${employees.userEmail}
            and ${userOrgAssignments.departmentId} in (${sql.join(scopeIds.departmentIds.map(id => sql `${id}`), sql `, `)})
        )`);
        }
        if (scopeIds.locationIds.length) {
            lddParts.push(sql `exists (
          select 1 from ${userOrgAssignments}
          where ${userOrgAssignments.userKey} = ${employees.userEmail}
            and ${userOrgAssignments.locationId} in (${sql.join(scopeIds.locationIds.map(id => sql `${id}`), sql `, `)})
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
 * GET /api/hrm/employees/[id]/direct-reports
 */
export async function GET(request) {
    const gate = await requirePageAccess(request, '/hrm/employees/[id]');
    if (gate instanceof NextResponse)
        return gate;
    const id = getEmployeeIdFromPath(request);
    if (!id)
        return jsonError('Missing employee id', 400);
    const db = getDb();
    const rows = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    const employee = rows[0] ?? null;
    if (!employee)
        return jsonError('Employee not found', 404);
    const canAccess = await canAccessEmployee(db, request, employee.userEmail, 'read');
    if (!canAccess) {
        return jsonError('Employee not found', 404);
    }
    const scope = await buildScopeCondition(db, request);
    if (!scope.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const allRows = scope.where
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
    for (const row of allRows) {
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
    for (const node of nodesById.values()) {
        // Prevent self-cycles (employee.managerId === employee.id) from making the root its own child.
        if (node.managerId && node.managerId !== node.id && nodesById.has(node.managerId)) {
            nodesById.get(node.managerId).children.push(node);
        }
    }
    const root = nodesById.get(String(id));
    if (!root) {
        return NextResponse.json({ directReports: [], orgTree: [] });
    }
    const rootEmail = String(employee?.userEmail || '').trim().toLowerCase();
    const directReports = root.children
        .filter((child) => String(child.id) !== String(id))
        .filter((child) => {
        if (!rootEmail)
            return true;
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
