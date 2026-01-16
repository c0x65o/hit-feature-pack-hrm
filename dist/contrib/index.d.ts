import React from 'react';
export type PackDetailExtraRendererArgs = {
    entityKey: string;
    record: any;
    uiSpec?: any;
    spec: any;
    navigate?: (path: string) => void;
    ui?: any;
    platform?: string;
};
export type PackContrib = {
    detailExtras?: Record<string, (args: PackDetailExtraRendererArgs) => React.ReactNode>;
};
export declare const contrib: PackContrib;
export default contrib;
//# sourceMappingURL=index.d.ts.map