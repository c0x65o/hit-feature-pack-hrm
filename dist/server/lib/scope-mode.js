import { checkHrmAction } from './require-action';
/**
 * Resolve effective scope mode using a tree:
 * - entity override: hrm.{entity}.{verb}.scope.{mode}
 * - hrm default:     hrm.{verb}.scope.{mode}
 * - fallback:        own
 *
 * Precedence if multiple are granted: most restrictive wins.
 */
export async function resolveHrmScopeMode(request, args) {
    const { entity, verb } = args;
    const entityPrefix = entity ? `hrm.${entity}.${verb}.scope` : `hrm.${verb}.scope`;
    const globalPrefix = `hrm.${verb}.scope`;
    // Most restrictive wins (first match returned).
    const modes = ['none', 'own', 'ldd', 'any'];
    for (const m of modes) {
        const res = await checkHrmAction(request, `${entityPrefix}.${m}`);
        if (res.ok)
            return m;
    }
    for (const m of modes) {
        const res = await checkHrmAction(request, `${globalPrefix}.${m}`);
        if (res.ok)
            return m;
    }
    return 'own';
}
