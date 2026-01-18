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
export function forbiddenError(opts: {
  message?: string;
  detail?: string;
  code?: string;
  requiredPermission?: string;
} = {}): NextResponse<ApiErrorResponse> {
  return NextResponse.json<ApiErrorResponse>(
    {
      error: opts.message || 'Permission denied',
      detail: opts.detail,
      code: opts.code,
      requiredPermission: opts.requiredPermission,
    },
    { status: 403 }
  );
}

/**
 * Create a 401 Unauthorized response.
 */
export function unauthorizedError(opts: {
  message?: string;
  detail?: string;
  code?: string;
} = {}): NextResponse<ApiErrorResponse> {
  return NextResponse.json<ApiErrorResponse>(
    {
      error: opts.message || 'Unauthorized',
      detail: opts.detail || 'You must be logged in to perform this action.',
      code: opts.code || 'UNAUTHORIZED',
    },
    { status: 401 }
  );
}

/**
 * Create a 404 Not Found response.
 */
export function notFoundError(opts: {
  message?: string;
  detail?: string;
  code?: string;
  entityType?: string;
} = {}): NextResponse<ApiErrorResponse> {
  const entityLabel = opts.entityType || 'Resource';
  return NextResponse.json<ApiErrorResponse>(
    {
      error: opts.message || `${entityLabel} not found`,
      detail: opts.detail,
      code: opts.code || 'NOT_FOUND',
    },
    { status: 404 }
  );
}

/**
 * Create a 400 Bad Request response.
 */
export function badRequestError(opts: {
  message?: string;
  detail?: string;
  code?: string;
} = {}): NextResponse<ApiErrorResponse> {
  return NextResponse.json<ApiErrorResponse>(
    {
      error: opts.message || 'Bad request',
      detail: opts.detail,
      code: opts.code || 'BAD_REQUEST',
    },
    { status: 400 }
  );
}

/**
 * Create a 500 Internal Server Error response.
 */
export function serverError(opts: {
  message?: string;
  detail?: string;
  code?: string;
} = {}): NextResponse<ApiErrorResponse> {
  return NextResponse.json<ApiErrorResponse>(
    {
      error: opts.message || 'Internal server error',
      detail: opts.detail || 'An unexpected error occurred. Please try again later.',
      code: opts.code || 'INTERNAL_ERROR',
    },
    { status: 500 }
  );
}

/**
 * Legacy helper for simple error responses.
 * Prefer the typed helpers above for new code.
 */
export function jsonError(message: string, status = 400): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status });
}
