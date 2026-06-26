import type { CognitiveHealthReport } from './types.js';
/** Cognitive Health — CIL-native quality signals for Dashboard / Action Engine. */
export declare function computeCognitiveHealth(workspaceRoot: string): Promise<CognitiveHealthReport>;
export declare function persistCognitiveHealth(workspaceRoot: string): Promise<CognitiveHealthReport>;
export declare function readCognitiveHealthReport(workspaceRoot: string): Promise<CognitiveHealthReport | null>;
//# sourceMappingURL=cognitiveHealth.d.ts.map