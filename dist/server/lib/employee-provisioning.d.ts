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
type AuthDirectoryUser = {
    email?: string | null;
    locked?: boolean | null;
    isActive?: boolean | null;
};
export declare function syncEmployeesWithAuthUsers(params: {
    db: any;
    users: AuthDirectoryUser[];
    allowDeactivation?: boolean;
}): Promise<{
    ensured: number;
    reactivated: number;
    deactivated: number;
}>;
export {};
//# sourceMappingURL=employee-provisioning.d.ts.map