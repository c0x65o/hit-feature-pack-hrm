import { NextRequest, NextResponse } from 'next/server';
import { and, asc, desc, eq, inArray, like, ne, or, sql, type AnyColumn } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { employees, positions, userOrgAssignments } from '@/lib/feature-pack-schemas';
import { requirePageAccess, extractUserFromRequest } from '../auth';
import { checkHrmAction } from '../lib/require-action';
import { resolveHrmScopeMode } from '../lib/scope-mode';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function fetchUserOrgScopeIds(db: any, userKey: string): Promise<{
  divisionIds: string[];
  departmentIds: string[];
  locationIds: string[];
}> {
  const rows = await db
    .select({
      divisionId: userOrgAssignments.divisionId,
      departmentId: userOrgAssignments.departmentId,
      locationId: userOrgAssignments.locationId,
    })
    .from(userOrgAssignments)
    .where(eq(userOrgAssignments.userKey, userKey));

  const divisionIds: string[] = [];
  const departmentIds: string[] = [];
  const locationIds: string[] = [];

  for (const r of rows as any[]) {
    if (r.divisionId && !divisionIds.includes(r.divisionId)) divisionIds.push(r.divisionId);
    if (r.departmentId && !departmentIds.includes(r.departmentId)) departmentIds.push(r.departmentId);
    if (r.locationId && !locationIds.includes(r.locationId)) locationIds.push(r.locationId);
  }

  return { divisionIds, departmentIds, locationIds };
}

/**
 * GET /api/hrm/employees
 * List employees with scope-based access control
 */
export async function GET(request: NextRequest) {
  const gate = await requirePageAccess(request, '/hrm/employees');
  if (gate instanceof NextResponse) return gate;

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
  const managerId = (sp.get('managerId') || '').trim();
  const sortBy = (sp.get('sortBy') || 'lastName').trim();
  const sortOrder = (sp.get('sortOrder') || 'asc').trim().toLowerCase() === 'desc' ? 'desc' : 'asc';

  const debugEnabled =
    String(process.env.HIT_AUTH_DEBUG || process.env.HIT_DEBUG || '').trim().toLowerCase() === 'true' ||
    String(process.env.HIT_AUTH_DEBUG || process.env.HIT_DEBUG || '').trim() === '1';

  try {
  // Resolve scope mode for read access
  const mode = await resolveHrmScopeMode(request, { entity: 'employees', verb: 'read' });
  
  const conditions: any[] = [];
  
  // Apply scope-based filtering (explicit branching on none/own/ldd/any)
  if (mode === 'none') {
    // Explicit deny: return empty results (fail-closed but non-breaking for list UI)
    conditions.push(sql<boolean>`false`);
  } else if (mode === 'own') {
    // Only show the current user's own employee record
    conditions.push(eq(employees.userEmail, user.email));
  } else if (mode === 'ldd') {
    // Show employees where:
    // 1. The employee is the current user (own)
    // 2. The employee's user has matching L/D/D assignments
    const scopeIds = await fetchUserOrgScopeIds(db, user.sub);
    
    // Build condition: own OR matching LDD
    const ownCondition = eq(employees.userEmail, user.email);
    
    // For LDD matching, we need to check if the employee's userEmail has matching assignments
    // We'll use a subquery to check org_user_assignments
    const lddParts: any[] = [];
    if (scopeIds.divisionIds.length) {
      lddParts.push(
        sql`exists (
          select 1 from ${userOrgAssignments}
          where ${userOrgAssignments.userKey} = ${employees.userEmail}
            and ${userOrgAssignments.divisionId} in (${sql.join(scopeIds.divisionIds.map(id => sql`${id}`), sql`, `)})
        )`
      );
    }
    if (scopeIds.departmentIds.length) {
      lddParts.push(
        sql`exists (
          select 1 from ${userOrgAssignments}
          where ${userOrgAssignments.userKey} = ${employees.userEmail}
            and ${userOrgAssignments.departmentId} in (${sql.join(scopeIds.departmentIds.map(id => sql`${id}`), sql`, `)})
        )`
      );
    }
    if (scopeIds.locationIds.length) {
      lddParts.push(
        sql`exists (
          select 1 from ${userOrgAssignments}
          where ${userOrgAssignments.userKey} = ${employees.userEmail}
            and ${userOrgAssignments.locationId} in (${sql.join(scopeIds.locationIds.map(id => sql`${id}`), sql`, `)})
        )`
      );
    }
    
    if (lddParts.length > 0) {
      conditions.push(or(ownCondition, or(...lddParts)!)!);
    } else {
      // No LDD assignments, fall back to own only
      conditions.push(ownCondition);
    }
  } else if (mode === 'any') {
    // No scoping - show all employees
  }
  
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

  if (managerId) {
    // Guard against bad data (self-manager) so "Direct Reports" never includes the parent.
    conditions.push(and(eq(employees.managerId, managerId as any), ne(employees.id, managerId as any)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const sortColumns: Record<string, AnyColumn> = {
    userEmail: employees.userEmail,
    firstName: employees.firstName,
    lastName: employees.lastName,
    preferredName: employees.preferredName,
    positionName: positions.name,
    jobLevel: employees.jobLevel,
    hireDate: employees.hireDate,
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
    profilePictureUrl: string | null;
    firstName: string;
    lastName: string;
    preferredName: string | null;
    displayName: string | null;
    positionId: string | null;
    positionName: string | null;
    jobLevel: number | null;
    hireDate: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }

  const baseQuery = db
    .select({
      id: employees.id,
      userEmail: employees.userEmail,
      profilePictureUrl: employees.profilePictureUrl,
      firstName: employees.firstName,
      lastName: employees.lastName,
      preferredName: employees.preferredName,
      displayName: sql<string>`coalesce(${employees.preferredName}, concat(${employees.firstName}, ' ', ${employees.lastName}), ${employees.userEmail})`,
      positionId: employees.positionId,
      positionName: positions.name,
      jobLevel: employees.jobLevel,
      hireDate: employees.hireDate,
      phone: employees.phone,
      city: employees.city,
      state: employees.state,
      country: employees.country,
      isActive: employees.isActive,
      createdAt: employees.createdAt,
      updatedAt: employees.updatedAt,
    })
    .from(employees)
    .leftJoin(positions, eq(employees.positionId, positions.id));

  const employeeRows: EmployeeRow[] = whereClause
    ? await baseQuery.where(whereClause).orderBy(orderDir).limit(pageSize).offset(offset)
    : await baseQuery.orderBy(orderDir).limit(pageSize).offset(offset);


  // Enrich with LDD data using raw SQL query (org tables are from auth-core)
  const userEmails = employeeRows.map((e: EmployeeRow) => e.userEmail);
  
  type LddData = { divisionName: string | null; departmentName: string | null; locationName: string | null };
  const lddMap: Record<string, LddData> = {};
  
  if (userEmails.length > 0) {
    try {
      // Use IN clause with sql.join for proper array parameter handling
      // ANY(${array}) doesn't work correctly with drizzle's sql template
      const emailParams = sql.join(userEmails.map(e => sql`${e}`), sql`, `);
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
        WHERE a.user_key IN (${emailParams})
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
    } catch (e) {
      // Log the error for debugging - org tables might not exist yet
      console.error('Failed to fetch LDD data for employees:', e);
    }
  }

  // Merge employee data with LDD
  const items = employeeRows.map((emp: EmployeeRow) => ({
    ...emp,
    displayName: String((emp as any)?.displayName || '').trim(),
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
  });
  } catch (e: any) {
    const message = e?.message ? String(e.message) : 'Failed to load employees';
    if (debugEnabled) {
      console.error('[hrm employees] list error', e);
    }
    return NextResponse.json(
      { error: debugEnabled ? `${message} ${String(e)}` : message },
      { status: 500 }
    );
  }
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

