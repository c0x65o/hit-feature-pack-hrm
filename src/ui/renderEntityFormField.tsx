'use client';

import React from 'react';

export type OptionSourceConfig = {
  options: any[];
  loading?: boolean;
  placeholder?: string;
};

export type RenderEntityFormFieldArgs = {
  keyName: string;
  fieldSpec: any;
  value: string;
  setValue: (v: string) => void;
  error?: any;
  required?: boolean;
  ui: {
    Input: any;
    Select: any;
    Autocomplete: any;
  };
  optionSources: Record<string, OptionSourceConfig | undefined>;
  referenceRenderers: Record<
    string,
    | undefined
    | ((args: {
        keyName: string;
        label: string;
        value: string;
        setValue: (v: string) => void;
        placeholder?: string;
        ui: { Autocomplete: any };
      }) => React.ReactNode)
  >;
};

export function renderEntityFormField({
  keyName,
  fieldSpec,
  value,
  setValue,
  error,
  required,
  ui,
  optionSources,
  referenceRenderers,
}: RenderEntityFormFieldArgs) {
  const spec = fieldSpec && typeof fieldSpec === 'object' ? fieldSpec : {};
  const type = String(spec.type || 'text');
  const label = String(spec.label || keyName);
  const placeholder = typeof spec.placeholder === 'string' ? String(spec.placeholder) : undefined;
  const readOnly = Boolean(spec.readOnly);

  if (type === 'select') {
    const src = typeof spec.optionSource === 'string' ? String(spec.optionSource) : '';
    const cfg = src && optionSources[src] ? optionSources[src] : undefined;
    const options = cfg?.options || [{ value: '', label: 'Select…' }];
    return (
      <ui.Select
        key={keyName}
        label={label}
        value={value}
        onChange={(v: string | number) => setValue(String(v))}
        options={options}
        placeholder={placeholder || cfg?.placeholder}
        disabled={readOnly || Boolean(cfg?.loading)}
        error={error}
        required={Boolean(required)}
      />
    );
  }

  if (type === 'reference') {
    const entityType = String(spec?.reference?.entityType || '');
    const renderer = entityType ? referenceRenderers[entityType] : undefined;
    if (renderer) {
      return (
        <React.Fragment key={keyName}>
          {renderer({
            keyName,
            label,
            value,
            setValue,
            placeholder,
            ui: { Autocomplete: ui.Autocomplete },
          })}
        </React.Fragment>
      );
    }
    return (
      <ui.Input
        key={keyName}
        label={label}
        value={value}
        onChange={(v: string) => setValue(v)}
        placeholder={placeholder}
        error={error}
        required={Boolean(required)}
        disabled={readOnly}
      />
    );
  }

  const inputType = type === 'email' ? 'email' : 'text';
  return (
    <ui.Input
      key={keyName}
      label={label}
      type={inputType as any}
      value={value}
      onChange={(v: string) => setValue(v)}
      placeholder={placeholder}
      error={error}
      required={Boolean(required)}
      disabled={readOnly}
    />
  );
}

