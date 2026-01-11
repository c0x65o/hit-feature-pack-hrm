import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { employees } from '@/lib/feature-pack-schemas';
import { requireAuth } from '../auth';
import { deriveEmployeeNamesFromEmail } from '../lib/employee-provisioning';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
function displayNameFromEmployee(e) {
    const preferred = String(e.preferredName || '').trim();
    if (preferred)
        return preferred;
    const first = String(e.firstName || '').trim();
    const last = String(e.lastName || '').trim();
    return [first, last].filter(Boolean).join(' ').trim();
}
/**
 * GET /api/hrm/employees/me
 *
 * Returns:
 *  - employee: Employee | null
 *  - displayName: string | null
 */
export async function GET(request) {
    const user = requireAuth(request);
    if (user instanceof NextResponse)
        return user;
    if (!user.email)
        return jsonError('Missing user email', 400);
    const db = getDb();
    const rows = await db.select().from(employees).where(eq(employees.userEmail, user.email)).limit(1);
    let employee = rows[0] ?? null;
    // Invariant: if HRM is installed, an employee row MUST exist for every auth user.
    // Auto-provision on first access (no manual linking).
    if (!employee) {
        const derived = deriveEmployeeNamesFromEmail(user.email);
        const inserted = await db
            .insert(employees)
            .values({
            userEmail: user.email,
            firstName: derived.firstName,
            lastName: derived.lastName,
            preferredName: null,
        })
            .onConflictDoNothing({ target: employees.userEmail })
            .returning();
        employee = inserted[0] ?? null;
    }
    return NextResponse.json({
        employee,
        displayName: employee ? displayNameFromEmployee(employee) : null,
    });
}
/**
 * PUT /api/hrm/employees/me
 *
 * Body:
 *  - firstName: string
 *  - lastName: string
 *  - preferredName?: string | null
 *
 * Behavior:
 *  - upserts by userEmail (current user)
 */
export async function PUT(request) {
    const user = requireAuth(request);
    if (user instanceof NextResponse)
        return user;
    if (!user.email)
        return jsonError('Missing user email', 400);
    const body = (await request.json().catch(() => null));
    const firstName = String(body?.firstName ?? '').trim();
    const lastName = String(body?.lastName ?? '').trim();
    const preferredNameRaw = body?.preferredName;
    const preferredName = preferredNameRaw === null || preferredNameRaw === undefined
        ? null
        : String(preferredNameRaw).trim() || null;
    if (!firstName)
        return jsonError('firstName is required', 400);
    if (!lastName)
        return jsonError('lastName is required', 400);
    const db = getDb();
    const existing = await db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.userEmail, user.email))
        .limit(1);
    if (existing.length === 0) {
        const inserted = await db
            .insert(employees)
            .values({
            userEmail: user.email,
            firstName,
            lastName,
            preferredName,
        })
            .returning();
        const employee = inserted[0] ?? null;
        return NextResponse.json({ employee, displayName: employee ? displayNameFromEmployee(employee) : null }, { status: 201 });
    }
    const updated = await db
        .update(employees)
        .set({
        firstName,
        lastName,
        preferredName,
    })
        .where(eq(employees.userEmail, user.email))
        .returning();
    const employee = updated[0] ?? null;
    return NextResponse.json({ employee, displayName: employee ? displayNameFromEmployee(employee) : null });
}
