import { NextResponse } from 'next/server';
import { asc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { employees, userOrgAssignments } from '@/lib/feature-pack-schemas';
import { extractUserFromRequest } from '../auth';
import { requireHrmAction } from '../lib/require-action';
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
/**
 * GET /api/hrm/employees/picker
 *
 * Lightweight employee picker endpoint for autocomplete in reference fields.
 * Returns minimal data (id, displayName, userEmail) for use in form pickers.
 *
 * Permission: requires `hrm.employees.picker` action (no page access or HRM read scope required).
 * This allows users who don't have access to the HRM employees list page to still
 * search employees for manager fields in other entities (org.division, org.department, etc.).
 */
export async function GET(request) {
    // Require hrm.employees.picker permission
    const gate = await requireHrmAction(request, 'hrm.employees.picker');
    if (gate instanceof NextResponse)
        return gate;
    const user = extractUserFromRequest(request);
    if (!user?.sub || !user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const db = getDb();
    const url = new URL(request.url);
    const sp = url.searchParams;
    const search = (sp.get('search') || '').trim();
    const id = (sp.get('id') || '').trim();
    const userEmail = (sp.get('userEmail') || '').trim();
    const idsRaw = (sp.get('ids') || '').trim();
    const ids = idsRaw ? idsRaw.split(',').map((x) => x.trim()).filter(Boolean) : [];
    const pageSizeRaw = parseInt(sp.get('pageSize') || sp.get('limit') || '25', 10) || 25;
    const pageSize = Math.min(Math.max(1, pageSizeRaw), 100);
    const scope = String(sp.get('scope') || '').trim().toLowerCase();
    const limitToScope = scope === 'ldd';
    try {
        const conditions = [];
        // Only show active employees
        conditions.push(eq(employees.isActive, true));
        if (limitToScope) {
            const scopeIds = await fetchUserOrgScopeIds(db, user.sub);
            const ownKey = user.email || user.sub;
            const ownCondition = ownKey ? eq(employees.userEmail, ownKey) : null;
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
                conditions.push(ownCondition ? or(ownCondition, or(...lddParts)) : or(...lddParts));
            }
            else if (ownCondition) {
                conditions.push(ownCondition);
            }
        }
        // If id is provided, fetch a single employee by id (for resolveValue)
        if (ids.length > 0) {
            conditions.push(inArray(employees.id, ids));
        }
        else if (id) {
            conditions.push(eq(employees.id, id));
        }
        else if (userEmail) {
            // If userEmail is provided, fetch by email (for resolveValue when valueField=userEmail)
            conditions.push(eq(employees.userEmail, userEmail));
        }
        else if (search) {
            // Search by name or email
            const searchLower = search.toLowerCase();
            conditions.push(or(like(sql `lower(${employees.userEmail})`, `%${searchLower}%`), like(sql `lower(${employees.firstName})`, `%${searchLower}%`), like(sql `lower(${employees.lastName})`, `%${searchLower}%`), like(sql `lower(${employees.preferredName})`, `%${searchLower}%`), like(sql `lower(concat(${employees.firstName}, ' ', ${employees.lastName}))`, `%${searchLower}%`)));
        }
        const whereClause = conditions.length > 0 ? sql `${sql.join(conditions, sql ` AND `)}` : undefined;
        const query = db
            .select({
            id: employees.id,
            userEmail: employees.userEmail,
            firstName: employees.firstName,
            lastName: employees.lastName,
            preferredName: employees.preferredName,
        })
            .from(employees);
        const rows = whereClause
            ? await query.where(whereClause).orderBy(asc(employees.lastName), asc(employees.firstName)).limit(pageSize)
            : await query.orderBy(asc(employees.lastName), asc(employees.firstName)).limit(pageSize);
        const items = rows.map((row) => {
            const preferred = (row.preferredName || '').trim();
            const first = (row.firstName || '').trim();
            const last = (row.lastName || '').trim();
            const displayName = preferred || [first, last].filter(Boolean).join(' ') || row.userEmail;
            return {
                id: row.id,
                displayName,
                userEmail: row.userEmail,
            };
        });
        return NextResponse.json({ items });
    }
    catch (e) {
        const message = e?.message ? String(e.message) : 'Failed to load employees';
        console.error('[hrm] employees-picker GET error:', e);
        return jsonError(message, 500);
    }
}
