'use client';

export type HitPlatform = 'web' | 'mobile';

export function getHitPlatform(): HitPlatform {
  try {
    const g = globalThis as any;
    const p = String(g?.__HIT_PLATFORM__ || '').trim().toLowerCase();
    if (p === 'mobile') return 'mobile';
    return 'web';
  } catch {
    return 'web';
  }
}

function normalizePlatforms(v: unknown): HitPlatform[] | null {
  if (!Array.isArray(v)) return null;
  const out: HitPlatform[] = [];
  for (const x of v) {
    const s = String(x || '').trim().toLowerCase();
    if (s === 'web' || s === 'mobile') out.push(s as HitPlatform);
  }
  return out.length ? out : null;
}

function isVisibleForPlatform(node: any, platform: HitPlatform): boolean {
  if (!node || typeof node !== 'object') return true;
  const direct = normalizePlatforms((node as any).platforms);
  if (direct) return direct.includes(platform);
  const vis = (node as any).visibility && typeof (node as any).visibility === 'object' ? (node as any).visibility : null;
  const fromVis = normalizePlatforms(vis?.platforms);
  if (fromVis) return fromVis.includes(platform);
  return true;
}

export function filterUiSpecByPlatform<T>(node: T, platform: HitPlatform): T {
  if (!node || typeof node !== 'object') return node;

  // Arrays: filter and recurse
  if (Array.isArray(node)) {
    return (node
      .filter((x) => isVisibleForPlatform(x, platform))
      .map((x) => filterUiSpecByPlatform(x, platform)) as any) as T;
  }

  // Objects: filter children recursively
  if (!isVisibleForPlatform(node, platform)) return (null as any) as T;

  const out: any = Array.isArray(node) ? [] : { ...(node as any) };
  for (const [k, v] of Object.entries(node as any)) {
    if (v && typeof v === 'object') {
      out[k] = filterUiSpecByPlatform(v as any, platform);
    }
  }
  return out as T;
}

