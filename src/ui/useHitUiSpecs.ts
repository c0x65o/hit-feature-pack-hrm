'use client';

import { useEffect, useMemo, useState } from 'react';
import { filterUiSpecByPlatform, getHitPlatform, type HitPlatform } from './platformVisibility';

type HitUiSpecs = {
  generated?: boolean;
  version?: number;
  entities?: Record<string, any>;
  fieldTypes?: Record<string, any>;
};

let cached: HitUiSpecs | null = null;
let inflight: Promise<HitUiSpecs> | null = null;

function getBootstrappedSpecs(): HitUiSpecs | null {
  try {
    if (typeof window === 'undefined') return null;
    const g = window as any;
    const s = g.__HIT_UI_SPECS__;
    return s && typeof s === 'object' ? (s as HitUiSpecs) : null;
  } catch {
    return null;
  }
}

async function fetchSpecs(): Promise<HitUiSpecs> {
  if (cached) return cached;
  const boot = getBootstrappedSpecs();
  if (boot) {
    cached = boot;
    return cached;
  }
  if (inflight) return inflight;

  inflight = fetch('/hit-ui-specs.json', { method: 'GET' })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      cached = json && typeof json === 'object' ? (json as HitUiSpecs) : {};
      return cached;
    })
    .catch(() => {
      cached = {};
      return cached;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function useHitUiSpecs() {
  const [specs, setSpecs] = useState<HitUiSpecs | null>(() => cached || getBootstrappedSpecs());

  useEffect(() => {
    let cancelled = false;
    const boot = getBootstrappedSpecs();
    if (boot) {
      cached = boot;
      if (!cancelled) setSpecs(boot);
      return () => {
        cancelled = true;
      };
    }
    fetchSpecs().then((s) => {
      if (!cancelled) setSpecs(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return specs;
}

export function useEntityUiSpec(entityKey: string) {
  const specs = useHitUiSpecs();
  const platform = getHitPlatform();
  return useMemo(() => {
    const e = specs?.entities?.[entityKey];
    if (!e || typeof e !== 'object') return null;
    return filterUiSpecByPlatform(e, platform);
  }, [specs, entityKey, platform]);
}

export function useEntityUiSpecForPlatform(entityKey: string, platform: HitPlatform) {
  const specs = useHitUiSpecs();
  return useMemo(() => {
    const e = specs?.entities?.[entityKey];
    if (!e || typeof e !== 'object') return null;
    return filterUiSpecByPlatform(e, platform);
  }, [specs, entityKey, platform]);
}

