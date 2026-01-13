'use client';
import { useEffect, useMemo, useState } from 'react';
import { filterUiSpecByPlatform, getHitPlatform } from './platformVisibility';
let cached = null;
let inflight = null;
function getBootstrappedSpecs() {
    try {
        if (typeof window === 'undefined')
            return null;
        const g = window;
        const s = g.__HIT_UI_SPECS__;
        return s && typeof s === 'object' ? s : null;
    }
    catch {
        return null;
    }
}
async function fetchSpecs() {
    if (cached)
        return cached;
    const boot = getBootstrappedSpecs();
    if (boot) {
        cached = boot;
        return cached;
    }
    if (inflight)
        return inflight;
    inflight = fetch('/hit-ui-specs.json', { method: 'GET' })
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
        cached = json && typeof json === 'object' ? json : {};
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
    const [specs, setSpecs] = useState(() => cached || getBootstrappedSpecs());
    useEffect(() => {
        let cancelled = false;
        const boot = getBootstrappedSpecs();
        if (boot) {
            cached = boot;
            if (!cancelled)
                setSpecs(boot);
            return () => {
                cancelled = true;
            };
        }
        fetchSpecs().then((s) => {
            if (!cancelled)
                setSpecs(s);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    return specs;
}
export function useEntityUiSpec(entityKey) {
    const specs = useHitUiSpecs();
    const platform = getHitPlatform();
    return useMemo(() => {
        const e = specs?.entities?.[entityKey];
        if (!e || typeof e !== 'object')
            return null;
        return filterUiSpecByPlatform(e, platform);
    }, [specs, entityKey, platform]);
}
export function useEntityUiSpecForPlatform(entityKey, platform) {
    const specs = useHitUiSpecs();
    return useMemo(() => {
        const e = specs?.entities?.[entityKey];
        if (!e || typeof e !== 'object')
            return null;
        return filterUiSpecByPlatform(e, platform);
    }, [specs, entityKey, platform]);
}
