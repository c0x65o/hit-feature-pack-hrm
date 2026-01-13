'use client';
export function getHitPlatform() {
    try {
        const g = globalThis;
        const p = String(g?.__HIT_PLATFORM__ || '').trim().toLowerCase();
        if (p === 'mobile')
            return 'mobile';
        return 'web';
    }
    catch {
        return 'web';
    }
}
function normalizePlatforms(v) {
    if (!Array.isArray(v))
        return null;
    const out = [];
    for (const x of v) {
        const s = String(x || '').trim().toLowerCase();
        if (s === 'web' || s === 'mobile')
            out.push(s);
    }
    return out.length ? out : null;
}
function isVisibleForPlatform(node, platform) {
    if (!node || typeof node !== 'object')
        return true;
    const direct = normalizePlatforms(node.platforms);
    if (direct)
        return direct.includes(platform);
    const vis = node.visibility && typeof node.visibility === 'object' ? node.visibility : null;
    const fromVis = normalizePlatforms(vis?.platforms);
    if (fromVis)
        return fromVis.includes(platform);
    return true;
}
export function filterUiSpecByPlatform(node, platform) {
    if (!node || typeof node !== 'object')
        return node;
    // Arrays: filter and recurse
    if (Array.isArray(node)) {
        return node
            .filter((x) => isVisibleForPlatform(x, platform))
            .map((x) => filterUiSpecByPlatform(x, platform));
    }
    // Objects: filter children recursively
    if (!isVisibleForPlatform(node, platform))
        return null;
    const out = Array.isArray(node) ? [] : { ...node };
    for (const [k, v] of Object.entries(node)) {
        if (v && typeof v === 'object') {
            out[k] = filterUiSpecByPlatform(v, platform);
        }
    }
    return out;
}
