import type { CognitiveInsights, CognitiveModeState, ContoriumMcpMode } from './types.js';
export type CognitiveModeSource = 'mcp' | 'user' | 'agent' | 'panel' | 'hotkey';
export interface ApplyCognitiveModeResult {
    workspaceRoot: string;
    mode: CognitiveModeState;
    cognitive_overlay_enabled: boolean;
    insights?: CognitiveInsights;
    hint?: string;
}
/** Single entry for set_cognitive_mode, dashboard panel, and hotkey — same logic everywhere. */
export declare function applyCognitiveModeChange(workspaceRoot: string, mode: ContoriumMcpMode, source?: CognitiveModeSource): Promise<ApplyCognitiveModeResult>;
export declare function readCognitiveModeSummary(workspaceRoot: string): Promise<{
    mode: ContoriumMcpMode;
    cognitive_overlay_enabled: boolean;
    updatedAt: string;
}>;
