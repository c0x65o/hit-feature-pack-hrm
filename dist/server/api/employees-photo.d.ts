import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * PUT /api/hrm/employees/[id]/photo
 *
 * Allows updating an employee's profile photo.
 * - Users can always update their own photo (self-service)
 * - For other employees, requires write scope access (any/ldd mode)
 *
 * Body: { profile_picture_url: string | null }
 */
export declare function PUT(request: NextRequest): Promise<NextResponse<unknown>>;
//# sourceMappingURL=employees-photo.d.ts.map