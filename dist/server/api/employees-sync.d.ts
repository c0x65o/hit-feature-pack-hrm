import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * POST /api/hrm/employees/sync
 * Manually sync HRM employees with auth users.
 */
export declare function POST(request: NextRequest): Promise<NextResponse<unknown>>;
//# sourceMappingURL=employees-sync.d.ts.map