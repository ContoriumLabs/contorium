export interface CognitiveHotkeyConfig {
    version: 1;
    /** Host-level accelerator label (e.g. IDE / OS binding → run mode-panel) */
    panel_accelerator: string;
    /** Terminal dashboard single-key fallback (TTY) */
    panel_key: string;
}
export declare function readCognitiveHotkeyConfig(workspaceRoot: string): Promise<CognitiveHotkeyConfig>;
export declare function writeCognitiveHotkeyConfig(workspaceRoot: string, patch: Partial<CognitiveHotkeyConfig>): Promise<CognitiveHotkeyConfig>;
/** Detect Ctrl+Alt+C style sequences in raw TTY input (best-effort). */
export declare function isPanelAcceleratorChunk(raw: string, accelerator?: string): boolean;
