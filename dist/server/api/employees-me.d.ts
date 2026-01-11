import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/hrm/employees/me
 *
 * Returns:
 *  - employee: Employee | null
 *  - displayName: string | null
 */
export declare function GET(request: NextRequest): Promise<NextResponse<unknown>>;
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
export declare function PUT(request: NextRequest): Promise<NextResponse<unknown>>;
//# sourceMappingURL=employees-me.d.ts.map