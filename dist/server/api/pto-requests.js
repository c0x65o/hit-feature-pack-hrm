import { NextResponse } from 'next/server';
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { employees, leaveTypes, ptoPolicies, ptoRequests } from '@/lib/feature-pack-schemas';
import { requireAuth } from '../auth';
import { getForwardedBearerFromRequest } from '../lib/employee-provisioning';
import { requireHrmAction } from '../lib/require-action';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
function isValidDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
function normalizeAmount(value) {
    if (value == null || value === '')
        return null;
    if (typeof value === 'number' && Number.isFinite(value))
        return String(value);
    const s = String(value).trim();
    if (!s)
        return null;
    return s;
}
function formatEmployeeName(row) {
    const preferred = String(row?.preferredName || '').trim();
    if (preferred)
        return preferred;
    const first = String(row?.firstName || '').trim();
    const last = String(row?.lastName || '').trim();
    const full = [first, last].filter(Boolean).join(' ').trim();
    if (full)
        return full;
    const email = String(row?.userEmail || '').trim();
    return email || null;
}
async function resolvePolicyId(args) {
    try {
        const { request, employeeId, userEmail } = args;
        const url = new URL('/api/policy/assignments/resolve', request.url);
        const bearer = getForwardedBearerFromRequest(request);
        const res = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(bearer ? { Authorization: bearer } : {}),
            },
            body: JSON.stringify({
                policyType: 'hrm.ptoPolicy',
                employeeId,
                userEmail,
            }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok)
            return null;
        const policyId = String(json?.policyId || '').trim();
        return policyId || null;
    }
    catch {
        return null;
    }
}
/**
 * GET /api/hrm/pto-requests
 * Admin list of PTO requests.
 */
export async function GET(request) {
    const denied = await requireHrmAction(request, 'hrm.pto.requests.access');
    if (denied)
        return denied;
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSizeRaw = parseInt(url.searchParams.get('pageSize') || '25', 10) || 25;
    const pageSize = Math.min(Math.max(1, pageSizeRaw), 200);
    const offset = (page - 1) * pageSize;
    const search = String(url.searchParams.get('search') || '').trim();
    const sortBy = String(url.searchParams.get('sortBy') || 'createdAt').trim();
    const sortOrder = String(url.searchParams.get('sortOrder') || 'desc').trim().toLowerCase() === 'desc' ? 'desc' : 'asc';
    const sortColumns = {
        createdAt: ptoRequests.createdAt,
        submittedAt: ptoRequests.submittedAt,
        startDate: ptoRequests.startDate,
        endDate: ptoRequests.endDate,
        status: ptoRequests.status,
        employeeId: ptoRequests.employeeId,
    };
    const sortCol = sortColumns[sortBy] || ptoRequests.createdAt;
    const orderBy = sortOrder === 'desc' ? desc(sortCol) : asc(sortCol);
    const searchClause = search
        ? or(ilike(employees.preferredName, `%${search}%`), ilike(employees.firstName, `%${search}%`), ilike(employees.lastName, `%${search}%`), ilike(employees.userEmail, `%${search}%`), ilike(leaveTypes.name, `%${search}%`), ilike(ptoPolicies.name, `%${search}%`), ilike(ptoRequests.status, `%${search}%`))
        : undefined;
    const db = getDb();
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
        preferredName: employees.preferredName,
        firstName: employees.firstName,
        lastName: employees.lastName,
        userEmail: employees.userEmail,
    })
        .from(ptoRequests)
        .leftJoin(employees, eq(ptoRequests.employeeId, employees.id))
        .leftJoin(leaveTypes, eq(ptoRequests.leaveTypeId, leaveTypes.id))
        .leftJoin(ptoPolicies, eq(ptoRequests.policyId, ptoPolicies.id))
        .where(searchClause ? and(searchClause) : undefined)
        .orderBy(orderBy)
        .limit(pageSize)
        .offset(offset);
    const countResult = await db
        .select({ count: sql `count(*)` })
        .from(ptoRequests)
        .leftJoin(employees, eq(ptoRequests.employeeId, employees.id))
        .leftJoin(leaveTypes, eq(ptoRequests.leaveTypeId, leaveTypes.id))
        .leftJoin(ptoPolicies, eq(ptoRequests.policyId, ptoPolicies.id))
        .where(searchClause ? and(searchClause) : undefined);
    const total = Number(countResult?.[0]?.count || 0);
    const items = rows.map((row) => ({
        ...row,
        employeeName: formatEmployeeName(row),
    }));
    return NextResponse.json({
        items,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
}
/**
 * POST /api/hrm/pto-requests
 * Admin create PTO request.
 */
export async function POST(request) {
    const denied = await requireHrmAction(request, 'hrm.pto.requests.manage');
    if (denied)
        return denied;
    const user = requireAuth(request);
    if (user instanceof NextResponse)
        return user;
    const body = await request.json().catch(() => ({}));
    const employeeId = String(body?.employeeId || '').trim();
    const leaveTypeId = String(body?.leaveTypeId || '').trim();
    const policyIdRaw = String(body?.policyId || '').trim();
    const status = String(body?.status || 'submitted').trim();
    const startDate = String(body?.startDate || '').trim();
    const endDate = String(body?.endDate || '').trim();
    const unit = String(body?.unit || 'days').trim();
    const reason = body?.reason != null ? String(body.reason).trim() : null;
    const amount = normalizeAmount(body?.amount);
    if (!employeeId)
        return jsonError('employeeId is required', 400);
    if (!leaveTypeId)
        return jsonError('leaveTypeId is required', 400);
    if (!startDate || !isValidDate(startDate))
        return jsonError('startDate must be YYYY-MM-DD', 400);
    if (!endDate || !isValidDate(endDate))
        return jsonError('endDate must be YYYY-MM-DD', 400);
    if (endDate < startDate)
        return jsonError('endDate must be on or after startDate', 400);
    const db = getDb();
    const empRows = await db
        .select({ id: employees.id, userEmail: employees.userEmail })
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);
    const employee = empRows[0];
    if (!employee)
        return jsonError('Employee not found', 404);
    const resolvedPolicyId = policyIdRaw || (await resolvePolicyId({ request, employeeId: String(employee.id), userEmail: String(employee.userEmail || '') }));
    if (!resolvedPolicyId) {
        return jsonError('No PTO policy assignment found for this employee', 400);
    }
    const now = new Date();
    const submittedAt = status && status !== 'draft' ? now : null;
    const values = {
        employeeId,
        leaveTypeId,
        policyId: resolvedPolicyId,
        status,
        startDate,
        endDate,
        amount,
        unit,
        reason,
        requestedByUserKey: body?.requestedByUserKey ?? user?.email ?? null,
        submittedAt,
        approvedAt: body?.approvedAt ? new Date(body.approvedAt) : null,
        approvedByUserKey: body?.approvedByUserKey ?? null,
        deniedAt: body?.deniedAt ? new Date(body.deniedAt) : null,
        deniedByUserKey: body?.deniedByUserKey ?? null,
        decisionNote: body?.decisionNote ?? null,
        workflowRunId: body?.workflowRunId ?? null,
        createdAt: now,
        updatedAt: now,
    };
    const inserted = await db.insert(ptoRequests).values(values).returning();
    const row = inserted[0] ?? null;
    if (!row)
        return jsonError('Failed to create request', 500);
    return NextResponse.json(row, { status: 201 });
}
