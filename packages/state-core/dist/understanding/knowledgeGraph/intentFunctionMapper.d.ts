import type { IntentFunctionMapping } from './types.js';
declare function tokenize(text: string): string[];
declare function cosineSimilarity(a: string[], b: string[]): number;
export interface FunctionDescriptor {
    id: string;
    name: string;
    file: string;
    moduleHint?: string;
    callTargets?: string[];
}
export interface IntentDescriptor {
    id: string;
    text: string;
}
export interface MappingContext {
    recentEditFiles?: Set<string>;
    gitFrequency?: Map<string, number>;
}
/** Intent ↔ Function mapping — token similarity + recency + git frequency (V3.1). */
export declare function mapIntentsToFunctions(intents: IntentDescriptor[], functions: FunctionDescriptor[], ctx?: MappingContext): IntentFunctionMapping[];
export { tokenize, cosineSimilarity };
//# sourceMappingURL=intentFunctionMapper.d.ts.map