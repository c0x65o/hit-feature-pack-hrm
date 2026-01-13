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
    TextArea?: any;
    Select: any;
    Checkbox?: any;
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
  const type = String(spec.type || 'text').trim().toLowerCase();
  const label = String(spec.label || keyName);
  const placeholder = typeof spec.placeholder === 'string' ? String(spec.placeholder) : undefined;
  const readOnly = Boolean(spec.readOnly);

  if (type === 'select') {
    const src = typeof spec.optionSource === 'string' ? String(spec.optionSource) : '';
    const cfg = src && optionSources[src] ? optionSources[src] : undefined;
    const inline = Array.isArray(spec.options) ? spec.options : null;
    const options = (inline && inline.length > 0) ? inline : (cfg?.options || [{ value: '', label: 'Select…' }]);
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

  if (type === 'textarea' && ui.TextArea) {
    return (
      <ui.TextArea
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

  if (type === 'boolean' && ui.Checkbox) {
    const checked = value === 'true' || value === '1' || value.toLowerCase?.() === 'true';
    return (
      <ui.Checkbox
        key={keyName}
        label={label}
        checked={Boolean(checked)}
        onChange={(v: boolean) => setValue(v ? 'true' : 'false')}
        disabled={readOnly}
      />
    );
  }

  const inputType =
    type === 'email'
      ? 'email'
      : type === 'secret' || type === 'password'
        ? 'password'
        : type === 'phone'
          ? 'tel'
          : type === 'number'
            ? 'number'
            : type === 'date'
              ? 'date'
              : type === 'datetime'
                ? 'datetime-local'
                : 'text';

  const inputValue =
    inputType === 'datetime-local' && typeof value === 'string' && value.includes('T')
      ? value.slice(0, 16)
      : value;
  return (
    <ui.Input
      key={keyName}
      label={label}
      type={inputType as any}
      value={inputValue}
      onChange={(v: string) => setValue(v)}
      placeholder={placeholder}
      error={error}
      required={Boolean(required)}
      disabled={readOnly}
    />
  );
}

