import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { employees } from '@/lib/feature-pack-schemas';
import { requirePageAccess } from '../auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getIdFromPath(request: NextRequest): string {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  return decodeURIComponent(parts[parts.length - 1] || '');
}

/**
 * GET /api/hrm/employees/[id]
 */
export async function GET(request: NextRequest) {
  const gate = await requirePageAccess(request, '/hrm/employees/[id]');
  if (gate instanceof NextResponse) return gate;

  const id = getIdFromPath(request);
  if (!id) return jsonError('Missing employee id', 400);

  const db = getDb();
  const rows = await db.select().from(employees).where(eq(employees.id, id as any)).limit(1);
  const employee = rows[0] ?? null;
  if (!employee) return jsonError('Employee not found', 404);
  return NextResponse.json(employee);
}

/**
 * PUT /api/hrm/employees/[id]
 */
export async function PUT(request: NextRequest) {
  const gate = await requirePageAccess(request, '/hrm/employees/[id]/edit');
  if (gate instanceof NextResponse) return gate;

  const id = getIdFromPath(request);
  if (!id) return jsonError('Missing employee id', 400);

  const body = (await request.json().catch(() => null)) as
    | { 
        firstName?: unknown; 
        lastName?: unknown; 
        preferredName?: unknown;
        phone?: unknown;
        address1?: unknown;
        address2?: unknown;
        city?: unknown;
        state?: unknown;
        postalCode?: unknown;
        country?: unknown;
      }
    | null;

  const firstName = body?.firstName !== undefined ? String(body.firstName ?? '').trim() : undefined;
  const lastName = body?.lastName !== undefined ? String(body.lastName ?? '').trim() : undefined;
  const preferredName =
    body?.preferredName === undefined
      ? undefined
      : body.preferredName === null
        ? null
        : String(body.preferredName).trim() || null;

  // Optional string fields helper
  const optionalString = (val: unknown): string | null | undefined => {
    if (val === undefined) return undefined;
    if (val === null) return null;
    return String(val).trim() || null;
  };

  const phone = optionalString(body?.phone);
  const address1 = optionalString(body?.address1);
  const address2 = optionalString(body?.address2);
  const city = optionalString(body?.city);
  const state = optionalString(body?.state);
  const postalCode = optionalString(body?.postalCode);
  const country = optionalString(body?.country);

  const update: Record<string, any> = {};
  if (firstName !== undefined) {
    if (!firstName) return jsonError('firstName cannot be empty', 400);
    update.firstName = firstName;
  }
  if (lastName !== undefined) {
    if (!lastName) return jsonError('lastName cannot be empty', 400);
    update.lastName = lastName;
  }
  if (preferredName !== undefined) {
    update.preferredName = preferredName;
  }
  if (phone !== undefined) update.phone = phone;
  if (address1 !== undefined) update.address1 = address1;
  if (address2 !== undefined) update.address2 = address2;
  if (city !== undefined) update.city = city;
  if (state !== undefined) update.state = state;
  if (postalCode !== undefined) update.postalCode = postalCode;
  if (country !== undefined) update.country = country;

  if (Object.keys(update).length === 0) return jsonError('No fields to update', 400);

  const db = getDb();
  const updated = await db.update(employees).set(update).where(eq(employees.id, id as any)).returning();
  const employee = updated[0] ?? null;
  if (!employee) return jsonError('Employee not found', 404);
  return NextResponse.json(employee);
}

/**
 * DELETE /api/hrm/employees/[id]
 */
export async function DELETE(request: NextRequest) {
  const gate = await requirePageAccess(request, '/hrm/employees/[id]/edit');
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json(
    { error: 'Employees are auto-provisioned from auth users. Deleting is not supported.' },
    { status: 405 }
  );
}

