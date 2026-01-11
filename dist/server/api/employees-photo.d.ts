import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * PUT /api/hrm/employees/[id]/photo
 *
 * Allows updating an employee's profile photo.
 * - If the employee is the current user, updates via /me endpoint (no admin required)
 * - If the employee is a different user, requires admin access
 *
 * Body: { profile_picture_url: string | null }
 */
export declare function PUT(request: NextRequest): Promise<NextResponse<unknown>>;
//# sourceMappingURL=employees-photo.d.ts.map