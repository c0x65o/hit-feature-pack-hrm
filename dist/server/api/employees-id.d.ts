import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/hrm/employees/[id]
 */
export declare function GET(request: NextRequest): Promise<NextResponse<any>>;
/**
 * PUT /api/hrm/employees/[id]
 */
export declare function PUT(request: NextRequest): Promise<NextResponse<any>>;
/**
 * DELETE /api/hrm/employees/[id]
 */
export declare function DELETE(request: NextRequest): Promise<NextResponse<unknown>>;
//# sourceMappingURL=employees-id.d.ts.map