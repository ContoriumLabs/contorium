import type { ContoriumMcpMode } from './types.js';
export declare function renderModePanelFrame(args: {
    selection: ContoriumMcpMode;
    current: ContoriumMcpMode;
    hotkeyHint?: string;
}): string;
export declare function runCognitiveModePanel(workspaceRoot: string, opts?: {
    interactive?: boolean;
}): Promise<{
    applied: boolean;
    mode?: ContoriumMcpMode;
}>;
