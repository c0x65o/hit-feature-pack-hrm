import { NextRequest, NextResponse } from 'next/server';
import { asc, eq, like, or, sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { employees } from '@/lib/feature-pack-schemas';
import { extractUserFromRequest } from '../auth';
import { requireHrmAction } from '../lib/require-action';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
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
export async function GET(request: NextRequest) {
  // Require hrm.employees.picker permission
  const gate = await requireHrmAction(request, 'hrm.employees.picker');
  if (gate instanceof NextResponse) return gate;

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
  const pageSizeRaw = parseInt(sp.get('pageSize') || sp.get('limit') || '25', 10) || 25;
  const pageSize = Math.min(Math.max(1, pageSizeRaw), 100);

  try {
    const conditions: any[] = [];

    // Only show active employees
    conditions.push(eq(employees.isActive, true));

    // If id is provided, fetch a single employee by id (for resolveValue)
    if (id) {
      conditions.push(eq(employees.id, id));
    } else if (userEmail) {
      // If userEmail is provided, fetch by email (for resolveValue when valueField=userEmail)
      conditions.push(eq(employees.userEmail, userEmail));
    } else if (search) {
      // Search by name or email
      const searchLower = search.toLowerCase();
      conditions.push(
        or(
          like(sql`lower(${employees.userEmail})`, `%${searchLower}%`),
          like(sql`lower(${employees.firstName})`, `%${searchLower}%`),
          like(sql`lower(${employees.lastName})`, `%${searchLower}%`),
          like(sql`lower(${employees.preferredName})`, `%${searchLower}%`),
          like(
            sql`lower(concat(${employees.firstName}, ' ', ${employees.lastName}))`,
            `%${searchLower}%`
          )
        )!
      );
    }

    const whereClause = conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined;

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

    // Build displayName for each employee
    type EmployeeRow = typeof rows[number];
    const items = rows.map((row: EmployeeRow) => {
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
  } catch (e: any) {
    const message = e?.message ? String(e.message) : 'Failed to load employees';
    console.error('[hrm] employees-picker GET error:', e);
    return jsonError(message, 500);
  }
}
