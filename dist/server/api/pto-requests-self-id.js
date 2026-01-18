import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { employees, leaveTypes, ptoPolicies, ptoRequests } from '@/lib/feature-pack-schemas';
import { requireAuth } from '../auth';
import { deriveEmployeeNamesFromEmail } from '../lib/employee-provisioning';
import { requireHrmAction } from '../lib/require-action';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
async function getOrCreateEmployee(db, email) {
    const rows = await db.select().from(employees).where(eq(employees.userEmail, email)).limit(1);
    let employee = rows[0] ?? null;
    if (employee)
        return employee;
    const derived = deriveEmployeeNamesFromEmail(email);
    const inserted = await db
        .insert(employees)
        .values({
        userEmail: email,
        firstName: derived.firstName,
        lastName: derived.lastName,
        preferredName: null,
        isActive: true,
    })
        .onConflictDoNothing({ target: employees.userEmail })
        .returning();
    employee = inserted[0] ?? null;
    if (!employee) {
        const fallback = await db.select().from(employees).where(eq(employees.userEmail, email)).limit(1);
        employee = fallback[0] ?? null;
    }
    return employee;
}
async function fetchSelfRequest(db, requestId, employeeId) {
    const rows = await db
        .select({
        id: ptoRequests.id,
        employeeId: ptoRequests.employeeId,
        leaveTypeId: ptoRequests.leaveTypeId,
        policyId: ptoRequests.policyId,
        status: ptoRequests.status,
        startDate: ptoRequests.startDate,
        endDate: ptoRequests.endDate,
        amount: ptoRequests.amount,
        unit: ptoRequests.unit,
        reason: ptoRequests.reason,
        requestedByUserKey: ptoRequests.requestedByUserKey,
        submittedAt: ptoRequests.submittedAt,
        approvedAt: ptoRequests.approvedAt,
        approvedByUserKey: ptoRequests.approvedByUserKey,
        deniedAt: ptoRequests.deniedAt,
        deniedByUserKey: ptoRequests.deniedByUserKey,
        decisionNote: ptoRequests.decisionNote,
        workflowRunId: ptoRequests.workflowRunId,
        createdAt: ptoRequests.createdAt,
        updatedAt: ptoRequests.updatedAt,
        leaveTypeName: leaveTypes.name,
        policyName: ptoPolicies.name,
    })
        .from(ptoRequests)
        .leftJoin(leaveTypes, eq(ptoRequests.leaveTypeId, leaveTypes.id))
        .leftJoin(ptoPolicies, eq(ptoRequests.policyId, ptoPolicies.id))
        .where(eq(ptoRequests.id, requestId))
        .limit(1);
    const row = rows[0] ?? null;
    if (!row)
        return null;
    if (String(row.employeeId) !== String(employeeId))
        return null;
    return row;
}
/**
 * GET /api/hrm/pto-requests-self/[id]
 */
export async function GET(request, ctx) {
    const denied = await requireHrmAction(request, 'hrm.pto.requests.self.access');
    if (denied)
        return denied;
    const user = requireAuth(request);
    if (user instanceof NextResponse)
        return user;
    if (!user.email)
        return jsonError('Missing user email', 400);
    const requestId = String(ctx?.params?.id || '').trim();
    if (!requestId)
        return jsonError('Missing id', 400);
    const db = getDb();
    const employee = await getOrCreateEmployee(db, user.email);
    if (!employee)
        return jsonError('Employee not found', 404);
    const row = await fetchSelfRequest(db, requestId, employee.id);
    if (!row)
        return jsonError('Not found', 404);
    return NextResponse.json(row);
}
/**
 * PUT /api/hrm/pto-requests-self/[id]
 *
 * (Not enabled yet; self-service edits are handled via future flow controls.)
 */
export async function PUT() {
    return jsonError('Updates are not supported for self-service PTO requests.', 405);
}
