import type { NextRequest } from 'next/server';
import { checkHrmAction } from './require-action';

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
export async function resolveHrmScopeMode(
  request: NextRequest,
  args: { entity?: ScopeEntity; verb: ScopeVerb }
): Promise<ScopeMode> {
  const { entity, verb } = args;
  const entityPrefix = entity ? `hrm.${entity}.${verb}.scope` : `hrm.${verb}.scope`;
  const globalPrefix = `hrm.${verb}.scope`;

  // Most restrictive wins (first match returned).
  const modes: ScopeMode[] = ['none', 'own', 'ldd', 'any'];

  const checkPrefix = async (prefix: string): Promise<ScopeMode | null> => {
    for (const m of modes) {
      if (m === 'any') {
        const allRes = await checkHrmAction(request, `${prefix}.all`);
        if (allRes.ok) return 'any';
        const anyRes = await checkHrmAction(request, `${prefix}.any`);
        if (anyRes.ok) return 'any';
        continue;
      }
      const res = await checkHrmAction(request, `${prefix}.${m}`);
      if (res.ok) return m;
    }
    return null;
  };

  const entityMode = await checkPrefix(entityPrefix);
  if (entityMode) return entityMode;

  const globalMode = await checkPrefix(globalPrefix);
  if (globalMode) return globalMode;

  return 'own';
}
