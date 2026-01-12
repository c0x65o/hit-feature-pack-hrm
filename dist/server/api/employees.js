import { NextResponse } from 'next/server';
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { employees, userOrgAssignments } from '@/lib/feature-pack-schemas';
import { requirePageAccess, extractUserFromRequest } from '../auth';
import { ensureEmployeesExistForEmails, getAuthUrlFromRequest, getForwardedBearerFromRequest } from '../lib/employee-provisioning';
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
/**
 * GET /api/hrm/employees
 * List employees with scope-based access control
 */
export async function GET(request) {
    const gate = await requirePageAccess(request, '/hrm/employees');
    if (gate instanceof NextResponse)
        return gate;
    const user = extractUserFromRequest(request);
    if (!user?.sub || !user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const db = getDb();
    const url = new URL(request.url);
    const sp = url.searchParams;
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
    const pageSizeRaw = parseInt(sp.get('pageSize') || '25', 10) || 25;
    const pageSize = Math.min(Math.max(1, pageSizeRaw), 200);
    const offset = (page - 1) * pageSize;
    const search = (sp.get('search') || '').trim();
    const sortBy = (sp.get('sortBy') || 'lastName').trim();
    const sortOrder = (sp.get('sortOrder') || 'asc').trim().toLowerCase() === 'desc' ? 'desc' : 'asc';
    // Foolproof invariant: ensure employee rows exist for all auth users before listing.
    // No manual syncs. This runs on every list call and is idempotent.
    const provisionMeta = {
        authDirectoryStatus: null,
        authUserCount: null,
        ensured: null,
        provisioningError: null,
        authUrl: null,
        bearerPresent: false,
        cookiePresent: Boolean(request.cookies.get('hit_token')?.value),
        incomingServiceTokenPresent: Boolean(request.headers.get('x-hit-service-token') || request.headers.get('X-HIT-Service-Token')),
        authProxyProxiedFrom: null,
    };
    try {
        const bearer = getForwardedBearerFromRequest(request);
        provisionMeta.bearerPresent = Boolean(bearer);
        const headers = { 'Content-Type': 'application/json' };
        if (bearer)
            headers['Authorization'] = bearer;
        // Forward cookies to the proxy as a fallback auth mechanism.
        // This improves parity when Authorization headers are stripped by an intermediary.
        const cookieHeader = request.headers.get('cookie') || request.headers.get('Cookie') || '';
        if (cookieHeader)
            headers['Cookie'] = cookieHeader;
        const serviceToken = request.headers.get('x-hit-service-token') ||
            request.headers.get('X-HIT-Service-Token') ||
            process.env.HIT_SERVICE_TOKEN ||
            '';
        if (serviceToken)
            headers['X-HIT-Service-Token'] = serviceToken;
        // When calling the auth module directly, it needs this to fetch the compiled permissions catalog.
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
        const proto = request.headers.get('x-forwarded-proto') || 'https';
        if (host)
            headers['X-Frontend-Base-URL'] = `${proto}://${host}`;
        const authUrl = getAuthUrlFromRequest(request);
        provisionMeta.authUrl = authUrl;
        const res = await fetch(`${authUrl}/directory/users`, {
            method: 'GET',
            headers,
            credentials: 'include',
        });
        provisionMeta.authDirectoryStatus = res.status;
        provisionMeta.authProxyProxiedFrom = res.headers.get('x-proxied-from') || res.headers.get('X-Proxied-From');
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            const msg = body?.error || body?.detail || body?.message || `Auth directory users failed (${res.status})`;
            // IMPORTANT: don't silently return an empty employee list; this hides the root cause.
            return NextResponse.json({
                error: msg,
                // Keep extra info compact but actionable for debugging.
                upstream: { path: '/directory/users', status: res.status, body },
                meta: provisionMeta,
            }, { status: res.status });
        }
        const users = await res.json().catch(() => []);
        if (!Array.isArray(users)) {
            return NextResponse.json({ error: 'Unexpected auth directory response', meta: provisionMeta }, { status: 500 });
        }
        const emails = users
            .map((u) => String(u?.email || '').trim())
            .filter(Boolean)
            .slice(0, 5000);
        provisionMeta.authUserCount = emails.length;
        const { ensured } = await ensureEmployeesExistForEmails({ db, emails });
        provisionMeta.ensured = ensured;
    }
    catch (e) {
        provisionMeta.provisioningError = e?.message ? String(e.message) : 'Provisioning failed';
        return NextResponse.json({ error: provisionMeta.provisioningError, meta: provisionMeta }, { status: 500 });
    }
    // Resolve scope mode for read access
    const mode = await resolveHrmScopeMode(request, { entity: 'employees', verb: 'read' });
    const conditions = [];
    // Apply scope-based filtering (explicit branching on none/own/ldd/any)
    if (mode === 'none') {
        // Explicit deny: return empty results (fail-closed but non-breaking for list UI)
        conditions.push(sql `false`);
    }
    else if (mode === 'own') {
        // Only show the current user's own employee record
        conditions.push(eq(employees.userEmail, user.email));
    }
    else if (mode === 'ldd') {
        // Show employees where:
        // 1. The employee is the current user (own)
        // 2. The employee's user has matching L/D/D assignments
        const scopeIds = await fetchUserOrgScopeIds(db, user.sub);
        // Build condition: own OR matching LDD
        const ownCondition = eq(employees.userEmail, user.email);
        // For LDD matching, we need to check if the employee's userEmail has matching assignments
        // We'll use a subquery to check org_user_assignments
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
            // No LDD assignments, fall back to own only
            conditions.push(ownCondition);
        }
    }
    else if (mode === 'any') {
        // No scoping - show all employees
    }
    if (search) {
        conditions.push(or(like(employees.userEmail, `%${search}%`), like(employees.firstName, `%${search}%`), like(employees.lastName, `%${search}%`), like(employees.preferredName, `%${search}%`)));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const sortColumns = {
        userEmail: employees.userEmail,
        firstName: employees.firstName,
        lastName: employees.lastName,
        preferredName: employees.preferredName,
        phone: employees.phone,
        city: employees.city,
        state: employees.state,
        country: employees.country,
        createdAt: employees.createdAt,
        updatedAt: employees.updatedAt,
    };
    const orderCol = sortColumns[sortBy] ?? employees.lastName;
    const orderDir = sortOrder === 'desc' ? desc(orderCol) : asc(orderCol);
    const countQuery = db.select({ count: sql `count(*)` }).from(employees);
    const countRes = whereClause ? await countQuery.where(whereClause) : await countQuery;
    const total = Number(countRes[0]?.count || 0);
    const baseQuery = db
        .select({
        id: employees.id,
        userEmail: employees.userEmail,
        firstName: employees.firstName,
        lastName: employees.lastName,
        preferredName: employees.preferredName,
        phone: employees.phone,
        city: employees.city,
        state: employees.state,
        country: employees.country,
        createdAt: employees.createdAt,
        updatedAt: employees.updatedAt,
    })
        .from(employees);
    const employeeRows = whereClause
        ? await baseQuery.where(whereClause).orderBy(orderDir).limit(pageSize).offset(offset)
        : await baseQuery.orderBy(orderDir).limit(pageSize).offset(offset);
    // Enrich with LDD data using raw SQL query (org tables are from auth-core)
    const userEmails = employeeRows.map((e) => e.userEmail);
    const lddMap = {};
    if (userEmails.length > 0) {
        try {
            // Use IN clause with sql.join for proper array parameter handling
            // ANY(${array}) doesn't work correctly with drizzle's sql template
            const emailParams = sql.join(userEmails.map(e => sql `${e}`), sql `, `);
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
            const rows = lddResult.rows;
            for (const row of rows) {
                lddMap[row.user_key] = {
                    divisionName: row.division_name,
                    departmentName: row.department_name,
                    locationName: row.location_name,
                };
            }
        }
        catch (e) {
            // Log the error for debugging - org tables might not exist yet
            console.error('Failed to fetch LDD data for employees:', e);
        }
    }
    // Merge employee data with LDD
    const items = employeeRows.map((emp) => ({
        ...emp,
        divisionName: lddMap[emp.userEmail]?.divisionName || null,
        departmentName: lddMap[emp.userEmail]?.departmentName || null,
        locationName: lddMap[emp.userEmail]?.locationName || null,
    }));
    return NextResponse.json({
        items,
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
        },
        meta: provisionMeta,
    });
}
/**
 * POST /api/hrm/employees
 * Employees are auto-provisioned from auth users. Creating manually is not supported.
 */
export async function POST(request) {
    const gate = await requirePageAccess(request, '/hrm/employees');
    if (gate instanceof NextResponse)
        return gate;
    return NextResponse.json({ error: 'Employees are auto-provisioned from auth users. Edit the employee record instead.' }, { status: 405 });
}
