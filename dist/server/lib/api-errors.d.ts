import { NextResponse } from 'next/server';
/**
 * Structured API error response format.
 *
 * This provides consistent, user-friendly error messages with context
 * that can be displayed in the UI and logged for debugging.
 */
export interface ApiErrorResponse {
    /** Short error message (e.g., "Permission denied") */
    error: string;
    /** User-friendly explanation of what went wrong and how to fix it */
    detail?: string;
    /** Machine-readable error code for programmatic handling */
    code?: string;
    /** What permission is needed to perform this action */
    requiredPermission?: string;
}
/**
 * Create a 403 Forbidden response with helpful context.
 *
 * @example
 * ```ts
 * return forbiddenError({
 *   message: 'Permission denied',
 *   detail: 'You can only edit your own employee record.',
 *   code: 'HRM_WRITE_SCOPE_INSUFFICIENT',
 *   requiredPermission: 'hrm.employees.write.scope.ldd or .all',
 * });
 * ```
 */
export declare function forbiddenError(opts?: {
    message?: string;
    detail?: string;
    code?: string;
    requiredPermission?: string;
}): NextResponse<ApiErrorResponse>;
/**
 * Create a 401 Unauthorized response.
 */
export declare function unauthorizedError(opts?: {
    message?: string;
    detail?: string;
    code?: string;
}): NextResponse<ApiErrorResponse>;
/**
 * Create a 404 Not Found response.
 */
export declare function notFoundError(opts?: {
    message?: string;
    detail?: string;
    code?: string;
    entityType?: string;
}): NextResponse<ApiErrorResponse>;
/**
 * Create a 400 Bad Request response.
 */
export declare function badRequestError(opts?: {
    message?: string;
    detail?: string;
    code?: string;
}): NextResponse<ApiErrorResponse>;
/**
 * Create a 500 Internal Server Error response.
 */
export declare function serverError(opts?: {
    message?: string;
    detail?: string;
    code?: string;
}): NextResponse<ApiErrorResponse>;
/**
 * Legacy helper for simple error responses.
 * Prefer the typed helpers above for new code.
 */
export declare function jsonError(message: string, status?: number): NextResponse<{
    error: string;
}>;
//# sourceMappingURL=api-errors.d.ts.map