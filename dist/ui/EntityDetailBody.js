'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { useUi } from '@hit/ui-kit';
import { useEntityResolver } from '@hit/ui-kit';
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
    if (raw == null || raw === '')
        return null;
    return (_jsxs("div", { children: [_jsx("div", { className: "text-sm text-gray-400 mb-1", children: label }), _jsx("div", { children: String(raw) })] }, fieldKey));
}
export function EntityDetailBody({ entityKey, uiSpec, record, }) {
    const { Card } = useUi();
    const detailSpec = asRecord(uiSpec?.detail) || {};
    const summaryFields = useMemo(() => {
        const explicit = Array.isArray(detailSpec.summaryFields) ? detailSpec.summaryFields.map(String) : null;
        return explicit && explicit.length > 0 ? explicit : [];
    }, [detailSpec.summaryFields]);
    return (_jsxs(Card, { children: [_jsx("h2", { className: "text-lg font-semibold mb-4", children: String(detailSpec.summaryTitle || 'Details') }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: summaryFields.map((k) => (_jsx(DetailField, { uiSpec: uiSpec, record: record, fieldKey: String(k) }, `${entityKey}-${k}`))) })] }));
}
