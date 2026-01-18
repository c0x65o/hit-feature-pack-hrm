import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/hrm/pto-requests-self/[id]
 */
export declare function GET(request: NextRequest, ctx: {
    params: {
        id: string;
    };
}): Promise<NextResponse<any>>;
/**
 * PUT /api/hrm/pto-requests-self/[id]
 *
 * (Not enabled yet; self-service edits are handled via future flow controls.)
 */
export declare function PUT(): Promise<NextResponse<{
    error: string;
}>>;
//# sourceMappingURL=pto-requests-self-id.d.ts.map