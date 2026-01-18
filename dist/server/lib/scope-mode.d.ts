import type { NextRequest } from 'next/server';
export type ScopeMode = 'none' | 'own' | 'ldd' | 'any';
export type ScopeVerb = 'read' | 'write' | 'delete';
export type ScopeEntity = 'employees';
/**
 * Resolve effective scope mode using a tree:
 * - entity override: hrm.{entity}.{verb}.scope.{mode}
 * - hrm default:     hrm.{verb}.scope.{mode}
 * - fallback:        own
 *
 * Precedence if multiple are granted: most restrictive wins.
 *
 * Legacy back-compat (deprecated):
 * - Treat `.scope.all` as `.scope.any`.
 */
export declare function resolveHrmScopeMode(request: NextRequest, args: {
    entity?: ScopeEntity;
    verb: ScopeVerb;
}): Promise<ScopeMode>;
//# sourceMappingURL=scope-mode.d.ts.map