import { NextRequest, NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { employees } from '@/lib/feature-pack-schemas';
import { ensureEmployeesExistForEmails, getAuthUrlFromRequest, getForwardedBearerFromRequest } from '../lib/employee-provisioning';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function displayNameFromEmployee(e: { preferredName?: string | null; firstName?: string | null; lastName?: string | null }) {
  const preferred = String(e.preferredName || '').trim();
  if (preferred) return preferred;
  const first = String(e.firstName || '').trim();
  const last = String(e.lastName || '').trim();
  return [first, last].filter(Boolean).join(' ').trim();
}

/**
 * GET /api/hrm/directory/users
 *
 * Purpose:
 * - Return the auth module's directory users, but enrich display name from HRM employees when present.
 *
 * Return shape intentionally matches auth `/directory/users`: array of user objects.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = String(searchParams.get('search') || '').trim().toLowerCase();
    const id = String(searchParams.get('id') || '').trim().toLowerCase();
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '25', 10), 100);

    // Forward auth (prefer a real Bearer token; Cookie header forwarding is unreliable in Next App Router).
    const bearer = getForwardedBearerFromRequest(request);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (bearer) headers['Authorization'] = bearer;
    // Forward cookies + base URL hints in case auth is remote or headers are stripped.
    const cookieHeader = request.headers.get('cookie') || request.headers.get('Cookie') || '';
    if (cookieHeader) headers['Cookie'] = cookieHeader;
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    if (host) headers['X-Frontend-Base-URL'] = `${proto}://${host}`;

    const authUrl = getAuthUrlFromRequest(request);
    const res = await fetch(`${authUrl}/directory/users`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: body?.detail || body?.message || `Failed to fetch users (${res.status})` },
        { status: res.status }
      );
    }

    const users = await res.json();
    if (!Array.isArray(users)) return jsonError('Unexpected auth directory response', 500);

    const emails = users
      .map((u: any) => String(u?.email || '').trim())
      .filter(Boolean)
      .slice(0, 5000);

    const db = getDb();
    // Invariant: ensure every auth user has an employee row (best-effort, idempotent).
    // This is the "foolproof" bridge: auth directory == source of truth, HRM employees are auto-provisioned.
    await ensureEmployeesExistForEmails({ db, emails });

    const employeeRows =
      emails.length === 0
        ? []
        : await db
            .select({
              userEmail: employees.userEmail,
              firstName: employees.firstName,
              lastName: employees.lastName,
              preferredName: employees.preferredName,
              profilePictureUrl: employees.profilePictureUrl,
            })
            .from(employees)
            .where(inArray(employees.userEmail, emails));

    const byEmail = new Map<string, (typeof employeeRows)[number]>();
    for (const e of employeeRows) byEmail.set(String(e.userEmail).trim(), e);

    const enriched = users.map((u: any) => {
      const email = String(u?.email || '').trim();
      const employee = email ? byEmail.get(email) : undefined;
      const employeeDisplayName = employee ? displayNameFromEmployee(employee) : '';
      return {
        ...u,
        employee: employee ? { ...employee } : null,
        // Prefer HRM-owned photo; fall back to auth directory's photo if present.
        profile_picture_url: employee?.profilePictureUrl ?? u?.profile_picture_url ?? null,
        // Keep a normalized displayName field for convenience (callers can still compute their own).
        displayName: employeeDisplayName || u?.displayName || null,
      };
    });

    const normalize = (value: unknown) => String(value || '').trim().toLowerCase();
    const filtered = id
      ? enriched.filter((u: any) => normalize(u?.email) === id)
      : search
        ? enriched.filter((u: any) => {
            const email = normalize(u?.email);
            const displayName = normalize(u?.displayName || u?.name);
            const employee = u?.employee || {};
            const preferred = normalize(employee?.preferredName);
            const first = normalize(employee?.firstName);
            const last = normalize(employee?.lastName);
            const fullName = `${first} ${last}`.trim();
            return (
              email.includes(search) ||
              displayName.includes(search) ||
              preferred.includes(search) ||
              first.includes(search) ||
              last.includes(search) ||
              fullName.includes(search)
            );
          })
        : enriched;

    return NextResponse.json(filtered.slice(0, pageSize));
  } catch (error) {
    console.error('[hrm] directory-users GET error:', error);
    return jsonError('Failed to fetch user directory', 500);
  }
}

