import { NextResponse } from 'next/server';
import { and, eq, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { employees, positions, userOrgAssignments } from '@/lib/feature-pack-schemas';
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
    const rows = scope.where
        ? await db
            .select(selectFields)
            .from(employees)
            .leftJoin(positions, eq(employees.positionId, positions.id))
            .where(scope.where)
        : await db
            .select(selectFields)
            .from(employees)
            .leftJoin(positions, eq(employees.positionId, positions.id));
    // Fetch LDD data for all employees
    const userEmails = rows.map((r) => String(r.userEmail || '')).filter(Boolean);
    const lddMap = {};
    if (userEmails.length > 0) {
        try {
            const emailParams = sql.join(userEmails.map((e) => sql `${e}`), sql `, `);
            const lddResult = await db.execute(sql `
        SELECT 
          a.user_key,
          d.name as division_name,
          dp.name as department_name,
          l.name as location_name
        FROM org_user_assignments a
        LEFT JOIN org_divisions d ON d.id = a.division_id
        LEFT JOIN org_departments dp ON dp.id = a.department_id
        LEFT JOIN org_locations l ON l.id = a.location_id
        WHERE a.user_key IN (${emailParams})
      `);
            const lddRows = lddResult.rows;
            for (const row of lddRows) {
                lddMap[row.user_key] = {
                    divisionName: row.division_name,
                    departmentName: row.department_name,
                    locationName: row.location_name,
                };
            }
        }
        catch (e) {
            // LDD tables might not exist yet - continue without grouping data
            console.error('Failed to fetch LDD data for org tree:', e);
        }
    }
    const nodesById = new Map();
    for (const row of rows) {
        const email = String(row.userEmail || '');
        const ldd = lddMap[email] || { divisionName: null, departmentName: null, locationName: null };
        nodesById.set(String(row.id), {
            id: String(row.id),
            managerId: row.managerId ? String(row.managerId) : null,
            userEmail: email,
            firstName: String(row.firstName || ''),
            lastName: String(row.lastName || ''),
            preferredName: row.preferredName ? String(row.preferredName) : null,
            profilePictureUrl: row.profilePictureUrl ? String(row.profilePictureUrl) : null,
            positionName: row.positionName ? String(row.positionName) : null,
            isActive: Boolean(row.isActive),
            locationName: ldd.locationName,
            divisionName: ldd.divisionName,
            departmentName: ldd.departmentName,
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
    // Collect unique group names for filter UI
    const locations = new Set();
    const divisions = new Set();
    const departments = new Set();
    for (const node of nodesById.values()) {
        if (node.locationName)
            locations.add(node.locationName);
        if (node.divisionName)
            divisions.add(node.divisionName);
        if (node.departmentName)
            departments.add(node.departmentName);
    }
    return NextResponse.json({
        orgTree: roots,
        groups: {
            locations: Array.from(locations).sort(),
            divisions: Array.from(divisions).sort(),
            departments: Array.from(departments).sort(),
        },
    });
}
