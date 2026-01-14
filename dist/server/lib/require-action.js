import { checkActionPermission, requireActionPermission, } from '@hit/feature-pack-auth-core/server/lib/action-check';
export async function checkHrmAction(request, actionKey) {
    return checkActionPermission(request, actionKey, { logPrefix: 'HRM' });
}
export async function requireHrmAction(request, actionKey) {
    return requireActionPermission(request, actionKey, { logPrefix: 'HRM' });
}
