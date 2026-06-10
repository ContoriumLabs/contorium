import type { CognitiveInsights } from './types.js';
export declare function readCognitiveInsights(workspaceRoot: string): Promise<CognitiveInsights | undefined>;
export declare function buildCognitiveInsights(workspaceRoot: string, opts?: {
    skipExternalSearch?: boolean;
}): Promise<CognitiveInsights>;
export declare function observationOnlyPayload(mode: 'A' | 'B'): Pick<CognitiveInsights, 'mode' | 'cognitive_overlay_enabled' | 'boundaries'>;
