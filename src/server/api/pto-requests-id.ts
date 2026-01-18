import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { employees, leaveTypes, ptoPolicies, ptoRequests } from '@/lib/feature-pack-schemas';
import { requireAuth } from '../auth';
import { getForwardedBearerFromRequest } from '../lib/employee-provisioning';
import { requireHrmAction } from '../lib/require-action';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function formatEmployeeName(row: any): string | null {
  const preferred = String(row?.preferredName || '').trim();
  if (preferred) return preferred;
  const first = String(row?.firstName || '').trim();
  const last = String(row?.lastName || '').trim();
  const full = [first, last].filter(Boolean).join(' ').trim();
  if (full) return full;
  const email = String(row?.userEmail || '').trim();
  return email || null;
}

async function resolvePolicyId(args: {
  request: NextRequest;
  employeeId: string;
  userEmail: string;
}): Promise<string | null> {
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
    if (!res.ok) return null;
    const policyId = String(json?.policyId || '').trim();
    return policyId || null;
  } catch {
    return null;
  }
}

async function fetchRequest(db: any, id: string) {
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
    .where(eq(ptoRequests.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return { ...row, employeeName: formatEmployeeName(row) };
}

export async function GET(request: NextRequest, ctx: { params: { id: string } }) {
  const denied = await requireHrmAction(request, 'hrm.pto.requests.access');
  if (denied) return denied;

  const id = String(ctx?.params?.id || '').trim();
  if (!id) return jsonError('Missing id', 400);

  const db = getDb();
  const row = await fetchRequest(db, id);
  if (!row) return jsonError('Not found', 404);
  return NextResponse.json(row);
}

export async function PUT(request: NextRequest, ctx: { params: { id: string } }) {
  const denied = await requireHrmAction(request, 'hrm.pto.requests.manage');
  if (denied) return denied;

  const id = String(ctx?.params?.id || '').trim();
  if (!id) return jsonError('Missing id', 400);

  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => ({}));
  const db = getDb();

  const existing = await db.select().from(ptoRequests).where(eq(ptoRequests.id, id)).limit(1);
  const current = existing[0];
  if (!current) return jsonError('Not found', 404);

  let policyId = body?.policyId ? String(body.policyId).trim() : (current.policyId ? String(current.policyId) : '');
  const employeeId = body?.employeeId ? String(body.employeeId).trim() : String(current.employeeId || '');
  if (!policyId && employeeId) {
    const empRows = await db
      .select({ id: employees.id, userEmail: employees.userEmail })
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1);
    const employee = empRows[0];
    if (employee?.id && employee?.userEmail) {
      policyId =
        (await resolvePolicyId({ request, employeeId: String(employee.id), userEmail: String(employee.userEmail) })) || '';
    }
  }
  if (!policyId) {
    return jsonError('No PTO policy assignment found for this employee', 400);
  }

  const values = {
    ...body,
    policyId,
    updatedAt: new Date(),
  };

  const updated = await db.update(ptoRequests).set(values as any).where(eq(ptoRequests.id, id)).returning();
  const row = updated[0] ?? null;
  if (!row) return jsonError('Not found', 404);

  const result = await fetchRequest(db, id);
  return NextResponse.json(result || row);
}

export async function DELETE(request: NextRequest, ctx: { params: { id: string } }) {
  const denied = await requireHrmAction(request, 'hrm.pto.requests.manage');
  if (denied) return denied;

  const id = String(ctx?.params?.id || '').trim();
  if (!id) return jsonError('Missing id', 400);

  const db = getDb();
  await db.delete(ptoRequests).where(eq(ptoRequests.id, id));
  return NextResponse.json({ ok: true });
}
