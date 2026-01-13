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
    referenceRenderers: Record<string, undefined | ((args: {
        keyName: string;
        label: string;
        value: string;
        setValue: (v: string) => void;
        placeholder?: string;
        ui: {
            Autocomplete: any;
        };
    }) => React.ReactNode)>;
};
export declare function renderEntityFormField({ keyName, fieldSpec, value, setValue, error, required, ui, optionSources, referenceRenderers, }: RenderEntityFormFieldArgs): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=renderEntityFormField.d.ts.map