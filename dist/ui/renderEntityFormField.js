'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
export function renderEntityFormField({ keyName, fieldSpec, value, setValue, error, required, ui, optionSources, referenceRenderers, }) {
    const spec = fieldSpec && typeof fieldSpec === 'object' ? fieldSpec : {};
    const type = String(spec.type || 'text');
    const label = String(spec.label || keyName);
    const placeholder = typeof spec.placeholder === 'string' ? String(spec.placeholder) : undefined;
    const readOnly = Boolean(spec.readOnly);
    if (type === 'select') {
        const src = typeof spec.optionSource === 'string' ? String(spec.optionSource) : '';
        const cfg = src && optionSources[src] ? optionSources[src] : undefined;
        const options = cfg?.options || [{ value: '', label: 'Select…' }];
        return (_jsx(ui.Select, { label: label, value: value, onChange: (v) => setValue(String(v)), options: options, placeholder: placeholder || cfg?.placeholder, disabled: readOnly || Boolean(cfg?.loading), error: error, required: Boolean(required) }, keyName));
    }
    if (type === 'reference') {
        const entityType = String(spec?.reference?.entityType || '');
        const renderer = entityType ? referenceRenderers[entityType] : undefined;
        if (renderer) {
            return (_jsx(React.Fragment, { children: renderer({
                    keyName,
                    label,
                    value,
                    setValue,
                    placeholder,
                    ui: { Autocomplete: ui.Autocomplete },
                }) }, keyName));
        }
        return (_jsx(ui.Input, { label: label, value: value, onChange: (v) => setValue(v), placeholder: placeholder, error: error, required: Boolean(required), disabled: readOnly }, keyName));
    }
    const inputType = type === 'email' ? 'email' : 'text';
    return (_jsx(ui.Input, { label: label, type: inputType, value: value, onChange: (v) => setValue(v), placeholder: placeholder, error: error, required: Boolean(required), disabled: readOnly }, keyName));
}
