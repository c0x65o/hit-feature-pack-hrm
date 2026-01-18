import { NextResponse } from 'next/server';
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
export function forbiddenError(opts = {}) {
    return NextResponse.json({
        error: opts.message || 'Permission denied',
        detail: opts.detail,
        code: opts.code,
        requiredPermission: opts.requiredPermission,
    }, { status: 403 });
}
/**
 * Create a 401 Unauthorized response.
 */
export function unauthorizedError(opts = {}) {
    return NextResponse.json({
        error: opts.message || 'Unauthorized',
        detail: opts.detail || 'You must be logged in to perform this action.',
        code: opts.code || 'UNAUTHORIZED',
    }, { status: 401 });
}
/**
 * Create a 404 Not Found response.
 */
export function notFoundError(opts = {}) {
    const entityLabel = opts.entityType || 'Resource';
    return NextResponse.json({
        error: opts.message || `${entityLabel} not found`,
        detail: opts.detail,
        code: opts.code || 'NOT_FOUND',
    }, { status: 404 });
}
/**
 * Create a 400 Bad Request response.
 */
export function badRequestError(opts = {}) {
    return NextResponse.json({
        error: opts.message || 'Bad request',
        detail: opts.detail,
        code: opts.code || 'BAD_REQUEST',
    }, { status: 400 });
}
/**
 * Create a 500 Internal Server Error response.
 */
export function serverError(opts = {}) {
    return NextResponse.json({
        error: opts.message || 'Internal server error',
        detail: opts.detail || 'An unexpected error occurred. Please try again later.',
        code: opts.code || 'INTERNAL_ERROR',
    }, { status: 500 });
}
/**
 * Legacy helper for simple error responses.
 * Prefer the typed helpers above for new code.
 */
export function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
