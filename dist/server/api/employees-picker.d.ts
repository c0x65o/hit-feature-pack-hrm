import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/hrm/employees/picker
 *
 * Lightweight employee picker endpoint for autocomplete in reference fields.
 * Returns minimal data (id, displayName, userEmail) for use in form pickers.
 *
 * Permission: requires `hrm.employees.picker` action (no page access or HRM read scope required).
 * This allows users who don't have access to the HRM employees list page to still
 * search employees for manager fields in other entities (org.division, org.department, etc.).
 */
export declare function GET(request: NextRequest): Promise<NextResponse<unknown>>;
//# sourceMappingURL=employees-picker.d.ts.map