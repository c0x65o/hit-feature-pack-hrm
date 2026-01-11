import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/hrm/directory/users
 *
 * Purpose:
 * - Return the auth module's directory users, but enrich display name from HRM employees when present.
 *
 * Return shape intentionally matches auth `/directory/users`: array of user objects.
 */
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: any;
}> | NextResponse<any[]>>;
//# sourceMappingURL=directory-users.d.ts.map