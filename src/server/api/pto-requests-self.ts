import { NextRequest, NextResponse } from 'next/server';
import { asc, desc, eq } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { employees, leaveTypes, ptoPolicies, ptoRequests } from '@/lib/feature-pack-schemas';
import { requireAuth } from '../auth';
import { deriveEmployeeNamesFromEmail } from '../lib/employee-provisioning';
import { requireHrmAction } from '../lib/require-action';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeAmount(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  const s = String(value).trim();
  if (!s) return null;
  return s;
}

async function getOrCreateEmployee(db: any, email: string) {
  const rows = await db.select().from(employees).where(eq(employees.userEmail, email)).limit(1);
  let employee = rows[0] ?? null;
  if (employee) return employee;

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

async function fetchSelfRequest(db: any, requestId: string, employeeId: string) {
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
  if (!row) return null;
  if (String(row.employeeId) !== String(employeeId)) return null;
  return row;
}

/**
 * GET /api/hrm/pto-requests-self
 * List PTO requests for the current employee.
 */
export async function GET(request: NextRequest) {
  const denied = await requireHrmAction(request, 'hrm.pto.requests.self.access');
  if (denied) return denied;

  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;
  if (!user.email) return jsonError('Missing user email', 400);

  const db = getDb();
  const employee = await getOrCreateEmployee(db, user.email);
  if (!employee) return jsonError('Employee not found', 404);

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const pageSizeRaw = parseInt(url.searchParams.get('pageSize') || '25', 10) || 25;
  const pageSize = Math.min(Math.max(1, pageSizeRaw), 200);
  const offset = (page - 1) * pageSize;

  const sortBy = String(url.searchParams.get('sortBy') || 'createdAt').trim();
  const sortOrder = String(url.searchParams.get('sortOrder') || 'desc').trim().toLowerCase() === 'desc' ? 'desc' : 'asc';

  const sortColumns: Record<string, any> = {
    createdAt: ptoRequests.createdAt,
    submittedAt: ptoRequests.submittedAt,
    startDate: ptoRequests.startDate,
    endDate: ptoRequests.endDate,
    status: ptoRequests.status,
  };
  const sortCol = sortColumns[sortBy] || ptoRequests.createdAt;
  const orderBy = sortOrder === 'desc' ? desc(sortCol) : asc(sortCol);

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
    .where(eq(ptoRequests.employeeId, employee.id))
    .orderBy(orderBy)
    .limit(pageSize)
    .offset(offset);

  return NextResponse.json({
    items: rows,
    pagination: { page, pageSize, total: undefined },
  });
}

/**
 * POST /api/hrm/pto-requests-self
 * Create a PTO request for the current employee.
 */
export async function POST(request: NextRequest) {
  const denied = await requireHrmAction(request, 'hrm.pto.requests.self.create');
  if (denied) return denied;

  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;
  if (!user.email) return jsonError('Missing user email', 400);

  const body = await request.json().catch(() => ({}));
  const leaveTypeId = String(body?.leaveTypeId || '').trim();
  const policyIdRaw = String(body?.policyId || '').trim();
  const startDate = String(body?.startDate || '').trim();
  const endDate = String(body?.endDate || '').trim();
  const unit = String(body?.unit || 'days').trim();
  const reason = body?.reason != null ? String(body.reason).trim() : null;
  const amount = normalizeAmount(body?.amount);

  if (!leaveTypeId) return jsonError('leaveTypeId is required', 400);
  if (!startDate || !isValidDate(startDate)) return jsonError('startDate must be YYYY-MM-DD', 400);
  if (!endDate || !isValidDate(endDate)) return jsonError('endDate must be YYYY-MM-DD', 400);
  if (unit && unit !== 'days' && unit !== 'hours') return jsonError('unit must be days or hours', 400);

  const db = getDb();
  const employee = await getOrCreateEmployee(db, user.email);
  if (!employee) return jsonError('Employee not found', 404);

  const now = new Date();
  const values = {
    employeeId: employee.id,
    leaveTypeId,
    policyId: policyIdRaw || null,
    status: 'submitted',
    startDate,
    endDate,
    amount,
    unit: unit || 'days',
    reason,
    requestedByUserKey: user.email,
    submittedAt: now,
  };

  const inserted = await db.insert(ptoRequests).values(values as any).returning();
  const row = inserted[0] ?? null;
  if (!row) return jsonError('Failed to create PTO request', 500);

  const enriched = await fetchSelfRequest(db, row.id, employee.id);
  return NextResponse.json(enriched || row, { status: 201 });
}
