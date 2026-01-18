import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/hrm/pto-requests-self
 * List PTO requests for the current employee.
 */
export declare function GET(request: NextRequest): Promise<NextResponse<unknown>>;
/**
 * POST /api/hrm/pto-requests-self
 * Create a PTO request for the current employee.
 */
export declare function POST(request: NextRequest): Promise<NextResponse<any>>;
//# sourceMappingURL=pto-requests-self.d.ts.map