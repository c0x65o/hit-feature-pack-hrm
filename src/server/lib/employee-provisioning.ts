import { inArray } from 'drizzle-orm';
import type { NextRequest } from 'next/server';

import { employees } from '@/lib/feature-pack-schemas';

function toTitle(word: string): string {
  const w = String(word || '').trim();
  if (!w) return '';
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

export function deriveEmployeeNamesFromEmail(email: string): { firstName: string; lastName: string } {
  const e = String(email || '').trim().toLowerCase();
  const local = e.split('@')[0] || '';
  const parts = local
    .replace(/[._-]/g, ' ')
    .split(' ')
    .map((p) => p.trim())
    .filter(Boolean)
    .map(toTitle);

  if (parts.length >= 2) {
    return { firstName: parts[0], lastName: parts[parts.length - 1] };
  }
  if (parts.length === 1) {
    // Must be non-empty; lastName cannot be empty in schema.
    return { firstName: parts[0], lastName: 'User' };
  }
  return { firstName: 'Employee', lastName: 'User' };
}

export function getAuthUrl(): string {
  return process.env.NEXT_PUBLIC_HIT_AUTH_URL || '/api/proxy/auth';
}

export function getForwardedBearerFromRequest(request: NextRequest): string {
  const rawTokenHeader = request.headers.get('x-hit-token-raw') || request.headers.get('X-HIT-Token-Raw');
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const cookieToken = request.cookies.get('hit_token')?.value || null;
  const bearer =
    rawTokenHeader && rawTokenHeader.trim()
      ? rawTokenHeader.trim().startsWith('Bearer ')
        ? rawTokenHeader.trim()
        : `Bearer ${rawTokenHeader.trim()}`
      : authHeader && authHeader.trim()
        ? authHeader
        : cookieToken
          ? `Bearer ${cookieToken}`
          : '';
  return bearer;
}

export async function ensureEmployeesExistForEmails(params: {
  db: any;
  emails: string[];
}): Promise<{ ensured: number }> {
  const emails = params.emails
    .map((x) => String(x || '').trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) return { ensured: 0 };

  const unique = Array.from(new Set(emails)).slice(0, 5000);

  const existing = await params.db
    .select({ userEmail: employees.userEmail })
    .from(employees)
    .where(inArray(employees.userEmail, unique));

  const existingSet = new Set(existing.map((r: any) => String(r.userEmail || '').trim().toLowerCase()).filter(Boolean));
  const missing = unique.filter((e) => !existingSet.has(e));
  if (missing.length === 0) return { ensured: 0 };

  const rows = missing.map((email) => {
    const derived = deriveEmployeeNamesFromEmail(email);
    return {
      userEmail: email,
      firstName: derived.firstName,
      lastName: derived.lastName,
      preferredName: null,
    };
  });

  // Best-effort. If races happen, ON CONFLICT DO NOTHING keeps it safe.
  const inserted = await params.db
    .insert(employees)
    .values(rows)
    .onConflictDoNothing({ target: employees.userEmail })
    .returning({ userEmail: employees.userEmail });

  return { ensured: Array.isArray(inserted) ? inserted.length : 0 };
}

