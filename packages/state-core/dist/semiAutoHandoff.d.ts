import { type ChpHandoffFormat } from './understanding/chpHandoff.js';
export type HandoffInjectionStatus = 'pending' | 'injected' | 'skipped';
export interface HandoffInjectionState {
    runtime_id: string;
    status: HandoffInjectionStatus;
    prompted_at: number;
    resolved_at?: number;
    context_file: string;
    format?: ChpHandoffFormat;
    /** Set on each new AI chat — skip/inject applies to this chat only. */
    chat_session_id?: string;
}
export interface PrepareHandoffOptions {
    /** New AI chat (MCP reconnect / new Agent window) — always re-prompt. */
    newChat?: boolean;
}
/** Active runtime = bootstrap marker + handoff available. */
export declare function checkActiveRuntime(workspaceRoot: string): Promise<{
    active: boolean;
    runtime_id?: string;
}>;
export declare function readHandoffInjectionState(workspaceRoot: string): Promise<HandoffInjectionState | undefined>;
export declare function readConfirmedHandoffContext(workspaceRoot: string): Promise<string | undefined>;
export declare function buildInjectionPromptMessage(projectHint: string, compactLine?: string): string;
/** Prepare semi-auto injection — pending only, does NOT write context file. */
export declare function prepareHandoffInjection(workspaceRoot: string, options?: PrepareHandoffOptions): Promise<{
    shouldPrompt: boolean;
    alreadyInjected: boolean;
    prompt?: string;
    state?: HandoffInjectionState;
    compact?: string;
}>;
/** User confirmed — write context file and mark injected. */
export declare function confirmHandoffInjection(workspaceRoot: string, format?: ChpHandoffFormat, opts?: {
    text?: string;
}): Promise<{
    ok: boolean;
    filePath?: string;
    text?: string;
    hint?: string;
}>;
/** User declined injection for this runtime session. */
export declare function skipHandoffInjection(workspaceRoot: string): Promise<{
    ok: boolean;
}>;
/** Reset pending state when runtime_id changes (new bootstrap). */
export declare function syncInjectionWithRuntime(workspaceRoot: string): Promise<void>;
//# sourceMappingURL=semiAutoHandoff.d.ts.map