import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { employees } from '@/lib/feature-pack-schemas';
import { requireAuth } from '../auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getIdFromPath(request: NextRequest): string {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // Path is /api/hrm/employees/[id]/photo - id is second to last
  return decodeURIComponent(parts[parts.length - 2] || '');
}

function getForwardedBearerFromRequest(request: NextRequest): string {
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return '';
}

function getAuthUrlFromRequest(request: NextRequest): string {
  // Check for x-auth-url header (set by proxy)
  const authUrl = request.headers.get('x-auth-url');
  if (authUrl) return authUrl;
  
  // Fall back to inferring from request URL
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}/api/proxy/auth`;
}

/**
 * PUT /api/hrm/employees/[id]/photo
 * 
 * Allows updating an employee's profile photo.
 * - If the employee is the current user, updates via /me endpoint (no admin required)
 * - If the employee is a different user, requires admin access
 * 
 * Body: { profile_picture_url: string | null }
 */
export async function PUT(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;
  if (!user.email) return jsonError('Missing user email', 400);

  const id = getIdFromPath(request);
  if (!id) return jsonError('Missing employee id', 400);

  const body = (await request.json().catch(() => null)) as
    | { profile_picture_url?: unknown }
    | null;

  if (!body || body.profile_picture_url === undefined) {
    return jsonError('profile_picture_url is required', 400);
  }

  const profilePictureUrl = body.profile_picture_url === null 
    ? null 
    : String(body.profile_picture_url);

  // Get the employee to find their email
  const db = getDb();
  const rows = await db.select().from(employees).where(eq(employees.id, id as any)).limit(1);
  const employee = rows[0] ?? null;
  if (!employee) return jsonError('Employee not found', 404);

  const token = getForwardedBearerFromRequest(request);
  const authUrl = getAuthUrlFromRequest(request);

  // Check if this is the current user updating their own photo
  const isSelf = employee.userEmail.toLowerCase() === user.email.toLowerCase();

  if (isSelf) {
    // User can update their own photo via /me endpoint
    const response = await fetch(`${authUrl}/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ profile_picture_url: profilePictureUrl }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return jsonError(data?.detail || data?.error || 'Failed to update profile picture', response.status);
    }

    const data = await response.json().catch(() => ({}));
    return NextResponse.json({
      success: true,
      profile_picture_url: data.profile_picture_url ?? profilePictureUrl,
    });
  }

  // For updating another user's photo, require admin
  const isAdmin = user.roles?.includes('admin') || user.sub === 'admin';
  if (!isAdmin) {
    return jsonError('You can only update your own profile picture', 403);
  }

  // Admin updating another user's photo
  const response = await fetch(`${authUrl}/users/${encodeURIComponent(employee.userEmail)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ profile_picture_url: profilePictureUrl }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    return jsonError(data?.detail || data?.error || 'Failed to update profile picture', response.status);
  }

  const data = await response.json().catch(() => ({}));
  return NextResponse.json({
    success: true,
    profile_picture_url: data.profile_picture_url ?? profilePictureUrl,
  });
}
