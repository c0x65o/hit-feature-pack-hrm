'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { OrgChart, useUi, useEntityResolver } from '@hit/ui-kit';
import { splitLinkedEntityTabsExtra, wrapWithLinkedEntityTabsIfConfigured } from '@hit/feature-pack-form-core';
import { EmbeddedEntityTable } from './EmbeddedEntityTable';
import { getHitPlatform } from './platformVisibility';
function asRecord(v) {
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}
function formatLocalDateTime(value) {
    if (value == null || value === '')
        return null;
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime()))
        return null;
    try {
        return new Intl.DateTimeFormat(undefined, {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        }).format(d);
    }
    catch {
        return d.toLocaleString();
    }
}
function formatDuration(value, unit) {
    if (value == null || value === '')
        return null;
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n))
        return null;
    const ms = unit === 's' ? n * 1000 : n;
    if (ms === 0)
        return '0s';
    const absMs = Math.abs(ms);
    const sign = ms < 0 ? '-' : '';
    const units = [
        { label: 'd', ms: 86400000 },
        { label: 'h', ms: 3600000 },
        { label: 'm', ms: 60000 },
        { label: 's', ms: 1000 },
        { label: 'ms', ms: 1 },
    ];
    const parts = [];
    let remaining = absMs;
    for (const u of units) {
        if (remaining >= u.ms) {
            const count = Math.floor(remaining / u.ms);
            remaining = remaining % u.ms;
            parts.push(`${count}${u.label}`);
            if (parts.length >= 2)
                break;
        }
    }
    return parts.length > 0 ? sign + parts.join(' ') : '0s';
}
function DetailField({ uiSpec, record, fieldKey }) {
    const resolver = useEntityResolver();
    const fieldsMap = asRecord(uiSpec?.fields) || {};
    const spec = asRecord(fieldsMap[fieldKey]) || {};
    const type = String(spec.type || 'text');
    const label = String(spec.label || fieldKey);
    const raw = record?.[fieldKey];
    if (type === 'reference') {
        const ref = asRecord(spec.reference) || {};
        const entityType = String(ref.entityType || '').trim();
        const id = raw == null ? '' : String(raw).trim();
        if (!entityType || !id)
            return null;
        const text = resolver.getLabel(entityType, id) || id;
        return (_jsxs("div", { children: [_jsx("div", { className: "text-sm text-gray-400 mb-1", children: label }), _jsx("div", { children: text })] }, fieldKey));
    }
    if (type === 'datetime' || type === 'date') {
        const formatted = formatLocalDateTime(raw);
        if (!formatted)
            return null;
        return (_jsxs("div", { children: [_jsx("div", { className: "text-sm text-gray-400 mb-1", children: label }), _jsx("div", { children: formatted })] }, fieldKey));
    }
    if (type === 'duration') {
        const formatted = formatDuration(raw, spec.unit);
        if (!formatted)
            return null;
        return (_jsxs("div", { children: [_jsx("div", { className: "text-sm text-gray-400 mb-1", children: label }), _jsx("div", { children: formatted })] }, fieldKey));
    }
    if (raw == null || raw === '')
        return null;
    return (_jsxs("div", { children: [_jsx("div", { className: "text-sm text-gray-400 mb-1", children: label }), _jsx("div", { children: String(raw) })] }, fieldKey));
}
export function EntityDetailBody({ entityKey, uiSpec, record, navigate, }) {
    const { Card, Tabs, Alert } = useUi();
    const detailSpec = asRecord(uiSpec?.detail) || {};
    const { linkedEntityTabs, extras } = splitLinkedEntityTabsExtra(detailSpec.extras);
    const summaryFields = useMemo(() => {
        const explicit = Array.isArray(detailSpec.summaryFields) ? detailSpec.summaryFields.map(String) : null;
        return explicit && explicit.length > 0 ? explicit : [];
    }, [detailSpec.summaryFields]);
    const platform = getHitPlatform();
    const renderExtraContent = (spec) => {
        const kind = String(spec?.kind || '');
        if (kind === 'embeddedTable') {
            if (!navigate)
                return null;
            return _jsx(EmbeddedEntityTable, { spec: spec, parent: record, navigate: navigate });
        }
        if (kind === 'orgChart') {
            return _jsx(OrgChart, { spec: spec, record: record, onNavigate: navigate });
        }
        return (_jsxs(Alert, { variant: "warning", title: "Unsupported detail extra", children: ["No renderer is registered for `", kind, "` yet."] }));
    };
    const renderExtra = (spec, idx) => {
        const kind = String(spec?.kind || '');
        if (kind === 'tabs') {
            const tabsAny = Array.isArray(spec?.tabs) ? spec.tabs : [];
            const tabs = tabsAny
                .map((tab) => {
                const tabPlatforms = Array.isArray(tab?.platforms) ? tab.platforms.map(String) : [];
                if (tabPlatforms.length > 0 && !tabPlatforms.includes(platform))
                    return null;
                const contentSpec = asRecord(tab?.content) || {};
                return {
                    id: String(tab?.id || tab?.value || ''),
                    label: String(tab?.label || 'Tab'),
                    content: renderExtraContent(contentSpec),
                };
            })
                .filter(Boolean);
            if (!tabs.length)
                return null;
            return _jsx(Tabs, { tabs: tabs }, `extra-tabs-${idx}`);
        }
        return _jsx("div", { children: renderExtraContent(spec) }, `extra-${idx}`);
    };
    const inner = (_jsxs("div", { className: "space-y-4", children: [_jsxs(Card, { children: [_jsx("h2", { className: "text-lg font-semibold mb-4", children: String(detailSpec.summaryTitle || 'Details') }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: summaryFields.map((k) => (_jsx(DetailField, { uiSpec: uiSpec, record: record, fieldKey: String(k) }, `${entityKey}-${k}`))) })] }), extras
                .filter((x) => Boolean(x) && typeof x === 'object')
                .map((x, idx) => renderExtra(x, idx))] }));
    return wrapWithLinkedEntityTabsIfConfigured({
        linkedEntityTabs,
        entityKey,
        record,
        navigate,
        overview: inner,
    });
}
