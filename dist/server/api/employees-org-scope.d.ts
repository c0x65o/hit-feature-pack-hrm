import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/hrm/employees/[id]/org-scope
 * Get the org assignment for the employee's userKey.
 */
export declare function GET(request: NextRequest): Promise<NextResponse<unknown>>;
/**
 * PUT /api/hrm/employees/[id]/org-scope
 * Upsert the org assignment for the employee's userKey.
 */
export declare function PUT(request: NextRequest): Promise<NextResponse<any>>;
//# sourceMappingURL=employees-org-scope.d.ts.map