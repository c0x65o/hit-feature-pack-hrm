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
function getIdFromPath(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    return decodeURIComponent(parts[parts.length - 1] || '');
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
        // Check if employee is the current user (own)
        if (employeeUserEmail.toLowerCase() === user.email.toLowerCase()) {
            return true;
        }
        // Check if employee's user has matching LDD assignments
        const scopeIds = await fetchUserOrgScopeIds(db, user.sub);
        // Check if the employee's userEmail has matching assignments
        const assignmentRows = await db
            .select({ id: userOrgAssignments.id })
            .from(userOrgAssignments)
            .where(and(eq(userOrgAssignments.userKey, employeeUserEmail), or(scopeIds.divisionIds.length ? inArray(userOrgAssignments.divisionId, scopeIds.divisionIds) : undefined, scopeIds.departmentIds.length ? inArray(userOrgAssignments.departmentId, scopeIds.departmentIds) : undefined, scopeIds.locationIds.length ? inArray(userOrgAssignments.locationId, scopeIds.locationIds) : undefined)))
            .limit(1);
        return assignmentRows.length > 0;
    }
    return false;
}
/**
 * GET /api/hrm/employees/[id]
 */
export async function GET(request) {
    const gate = await requirePageAccess(request, '/hrm/employees/[id]');
    if (gate instanceof NextResponse)
        return gate;
    const id = getIdFromPath(request);
    if (!id)
        return jsonError('Missing employee id', 400);
    const db = getDb();
    const rows = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    const employee = rows[0] ?? null;
    if (!employee)
        return jsonError('Employee not found', 404);
    // Check scope-based access
    const canAccess = await canAccessEmployee(db, request, employee.userEmail, 'read');
    if (!canAccess) {
        return jsonError('Employee not found', 404);
    }
    // Enrich with LDD display names (best-effort; org tables may not exist yet).
    let divisionName = null;
    let departmentName = null;
    let locationName = null;
    try {
        const email = String(employee.userEmail || '').trim();
        if (email) {
            const res = await db.execute(sql `
        SELECT 
          d.name as division_name,
          dp.name as department_name,
          l.name as location_name
        FROM org_user_assignments a
        LEFT JOIN org_divisions d ON d.id = a.division_id
        LEFT JOIN org_departments dp ON dp.id = a.department_id
        LEFT JOIN org_locations l ON l.id = a.location_id
        WHERE a.user_key = ${email}
        LIMIT 1
      `);
            const r = (res.rows?.[0] || null);
            if (r) {
                divisionName = r.division_name ?? null;
                departmentName = r.department_name ?? null;
                locationName = r.location_name ?? null;
            }
        }
    }
    catch {
        // ignore enrichment errors
    }
    return NextResponse.json({ ...employee, divisionName, departmentName, locationName });
}
/**
 * PUT /api/hrm/employees/[id]
 */
export async function PUT(request) {
    const gate = await requirePageAccess(request, '/hrm/employees/[id]/edit');
    if (gate instanceof NextResponse)
        return gate;
    const id = getIdFromPath(request);
    if (!id)
        return jsonError('Missing employee id', 400);
    const db = getDb();
    // First check if employee exists and user has access
    const existingRows = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    const existingEmployee = existingRows[0] ?? null;
    if (!existingEmployee)
        return jsonError('Employee not found', 404);
    // Check scope-based write access
    const canAccess = await canAccessEmployee(db, request, existingEmployee.userEmail, 'write');
    if (!canAccess) {
        return jsonError('Forbidden', 403);
    }
    const body = (await request.json().catch(() => null));
    const firstName = body?.firstName !== undefined ? String(body.firstName ?? '').trim() : undefined;
    const lastName = body?.lastName !== undefined ? String(body.lastName ?? '').trim() : undefined;
    const preferredName = body?.preferredName === undefined
        ? undefined
        : body.preferredName === null
            ? null
            : String(body.preferredName).trim() || null;
    // Optional string fields helper
    const optionalString = (val) => {
        if (val === undefined)
            return undefined;
        if (val === null)
            return null;
        return String(val).trim() || null;
    };
    const phone = optionalString(body?.phone);
    const address1 = optionalString(body?.address1);
    const address2 = optionalString(body?.address2);
    const city = optionalString(body?.city);
    const state = optionalString(body?.state);
    const postalCode = optionalString(body?.postalCode);
    const country = optionalString(body?.country);
    const managerIdRaw = optionalString(body?.managerId);
    const managerId = managerIdRaw === undefined ? undefined : managerIdRaw;
    const update = {};
    if (firstName !== undefined) {
        if (!firstName)
            return jsonError('firstName cannot be empty', 400);
        update.firstName = firstName;
    }
    if (lastName !== undefined) {
        if (!lastName)
            return jsonError('lastName cannot be empty', 400);
        update.lastName = lastName;
    }
    if (preferredName !== undefined) {
        update.preferredName = preferredName;
    }
    if (phone !== undefined)
        update.phone = phone;
    if (address1 !== undefined)
        update.address1 = address1;
    if (address2 !== undefined)
        update.address2 = address2;
    if (city !== undefined)
        update.city = city;
    if (state !== undefined)
        update.state = state;
    if (postalCode !== undefined)
        update.postalCode = postalCode;
    if (country !== undefined)
        update.country = country;
    if (managerId !== undefined) {
        if (managerId === null) {
            update.managerId = null;
        }
        else {
            const mid = String(managerId).trim();
            if (!mid) {
                update.managerId = null;
            }
            else {
                if (mid === String(id)) {
                    return jsonError('managerId cannot reference the employee itself', 400);
                }
                const managerRows = await db.select({ id: employees.id }).from(employees).where(eq(employees.id, mid)).limit(1);
                if (!managerRows[0]) {
                    return jsonError('managerId must reference an existing employee', 400);
                }
                update.managerId = mid;
            }
        }
    }
    if (Object.keys(update).length === 0)
        return jsonError('No fields to update', 400);
    // Explicitly set updatedAt to avoid $onUpdate serialization issues
    update.updatedAt = new Date();
    const updated = await db.update(employees).set(update).where(eq(employees.id, id)).returning();
    const employee = updated[0] ?? null;
    if (!employee)
        return jsonError('Employee not found', 404);
    return NextResponse.json(employee);
}
/**
 * DELETE /api/hrm/employees/[id]
 */
export async function DELETE(request) {
    const gate = await requirePageAccess(request, '/hrm/employees/[id]/edit');
    if (gate instanceof NextResponse)
        return gate;
    return NextResponse.json({ error: 'Employees are auto-provisioned from auth users. Deleting is not supported.' }, { status: 405 });
}
