import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/hrm/pto-requests
 * Admin list of PTO requests.
 */
export declare function GET(request: NextRequest): Promise<NextResponse<unknown>>;
/**
 * POST /api/hrm/pto-requests
 * Admin create PTO request.
 */
export declare function POST(request: NextRequest): Promise<NextResponse<any>>;
//# sourceMappingURL=pto-requests.d.ts.map