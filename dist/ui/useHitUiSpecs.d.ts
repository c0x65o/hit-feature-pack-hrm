import { type HitPlatform } from './platformVisibility';
type HitUiSpecs = {
    generated?: boolean;
    version?: number;
    entities?: Record<string, any>;
    fieldTypes?: Record<string, any>;
};
export declare function useHitUiSpecs(): HitUiSpecs | null;
export declare function useEntityUiSpec(entityKey: string): any;
export declare function useEntityUiSpecForPlatform(entityKey: string, platform: HitPlatform): any;
export {};
//# sourceMappingURL=useHitUiSpecs.d.ts.map