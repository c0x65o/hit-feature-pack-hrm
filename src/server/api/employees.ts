import { NextRequest, NextResponse } from 'next/server';
import { and, asc, desc, like, or, sql, type AnyColumn } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { employees } from '@/lib/feature-pack-schemas';
import { requirePageAccess } from '../auth';
import { ensureEmployeesExistForEmails, getAuthUrlFromRequest, getForwardedBearerFromRequest } from '../lib/employee-provisioning';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * GET /api/hrm/employees
 * Admin: list employees
 */
export async function GET(request: NextRequest) {
  const gate = await requirePageAccess(request, '/hrm/employees');
  if (gate instanceof NextResponse) return gate;

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
  const provisionMeta: {
    authDirectoryStatus: number | null;
    authUserCount: number | null;
    ensured: number | null;
    provisioningError: string | null;
    authUrl: string | null;
  } = {
    authDirectoryStatus: null,
    authUserCount: null,
    ensured: null,
    provisioningError: null,
    authUrl: null,
  };

  try {
    const bearer = getForwardedBearerFromRequest(request);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (bearer) headers['Authorization'] = bearer;

    const authUrl = getAuthUrlFromRequest(request);
    provisionMeta.authUrl = authUrl;
    const res = await fetch(`${authUrl}/directory/users`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    provisionMeta.authDirectoryStatus = res.status;

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body?.detail || body?.message || `Auth directory users failed (${res.status})`;
      // IMPORTANT: don't silently return an empty employee list; this hides the root cause.
      return NextResponse.json({ error: msg, meta: provisionMeta }, { status: res.status });
    }

    const users = await res.json().catch(() => []);
    if (!Array.isArray(users)) {
      return NextResponse.json({ error: 'Unexpected auth directory response', meta: provisionMeta }, { status: 500 });
    }

    const emails = users
      .map((u: any) => String(u?.email || '').trim())
      .filter(Boolean)
      .slice(0, 5000);
    provisionMeta.authUserCount = emails.length;

    const { ensured } = await ensureEmployeesExistForEmails({ db, emails });
    provisionMeta.ensured = ensured;
  } catch (e: any) {
    provisionMeta.provisioningError = e?.message ? String(e.message) : 'Provisioning failed';
    return NextResponse.json({ error: provisionMeta.provisioningError, meta: provisionMeta }, { status: 500 });
  }

  const conditions: any[] = [];
  if (search) {
    conditions.push(
      or(
        like(employees.userEmail, `%${search}%`),
        like(employees.firstName, `%${search}%`),
        like(employees.lastName, `%${search}%`),
        like(employees.preferredName, `%${search}%`)
      )!
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const sortColumns: Record<string, AnyColumn> = {
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

  const countQuery = db.select({ count: sql<number>`count(*)` }).from(employees);
  const countRes = whereClause ? await countQuery.where(whereClause) : await countQuery;
  const total = Number(countRes[0]?.count || 0);

  // Query employees with optional LDD joins (using raw SQL for org tables since they're from auth-core)
  // First get the base employee data
  interface EmployeeRow {
    id: string;
    userEmail: string;
    firstName: string;
    lastName: string;
    preferredName: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    createdAt: Date;
    updatedAt: Date;
  }

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

  const employeeRows: EmployeeRow[] = whereClause
    ? await baseQuery.where(whereClause).orderBy(orderDir).limit(pageSize).offset(offset)
    : await baseQuery.orderBy(orderDir).limit(pageSize).offset(offset);

  // Enrich with LDD data using raw SQL query (org tables are from auth-core)
  const userEmails = employeeRows.map((e: EmployeeRow) => e.userEmail);
  
  type LddData = { divisionName: string | null; departmentName: string | null; locationName: string | null };
  const lddMap: Record<string, LddData> = {};
  
  if (userEmails.length > 0) {
    try {
      const lddResult = await db.execute(sql`
        SELECT 
          a.user_key,
          d.name as division_name,
          dp.name as department_name,
          l.name as location_name
        FROM org_user_assignments a
        LEFT JOIN org_divisions d ON d.id = a.division_id
        LEFT JOIN org_departments dp ON dp.id = a.department_id
        LEFT JOIN org_locations l ON l.id = a.location_id
        WHERE a.user_key = ANY(${userEmails})
      `);
      
      const rows = lddResult.rows as Array<{
        user_key: string;
        division_name: string | null;
        department_name: string | null;
        location_name: string | null;
      }>;
      
      for (const row of rows) {
        lddMap[row.user_key] = {
          divisionName: row.division_name,
          departmentName: row.department_name,
          locationName: row.location_name,
        };
      }
    } catch {
      // If org tables don't exist yet, just continue without LDD data
    }
  }

  // Merge employee data with LDD
  const items = employeeRows.map((emp: EmployeeRow) => ({
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
export async function POST(request: NextRequest) {
  const gate = await requirePageAccess(request, '/hrm/employees');
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json(
    { error: 'Employees are auto-provisioned from auth users. Edit the employee record instead.' },
    { status: 405 }
  );
}

