import { NextRequest, NextResponse } from 'next/server';
export interface User {
    sub: string;
    email: string;
    roles?: string[];
}
export declare function extractUserFromRequest(request: NextRequest): User | null;
export declare function requireAuth(request: NextRequest): User | NextResponse;
export declare function requireAdmin(request: NextRequest): User | NextResponse;
export declare function requirePageAccess(request: NextRequest, pagePath: string): Promise<User | NextResponse>;
//# sourceMappingURL=auth.d.ts.map