import type { NextRequest } from 'next/server';
export declare function deriveEmployeeNamesFromEmail(email: string): {
    firstName: string;
    lastName: string;
};
export declare function getAuthUrlFromRequest(request: NextRequest): string;
export declare function getForwardedBearerFromRequest(request: NextRequest): string;
export declare function ensureEmployeesExistForEmails(params: {
    db: any;
    emails: string[];
}): Promise<{
    ensured: number;
}>;
//# sourceMappingURL=employee-provisioning.d.ts.map