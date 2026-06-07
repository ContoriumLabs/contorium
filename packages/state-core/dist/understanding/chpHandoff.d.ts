import type { AdapterKind } from '../types.js';
import type { ChangeArtifact, HandoffArtifact, KeyChange, ProjectTimeline } from './types.js';
/** Contorium Handoff Protocol v1 — shared AI state shape. */
export declare const CHP_VERSION: 1;
export interface ChpRecentChange {
    type: 'function_update' | 'class_update' | 'file_update';
    name: string;
    file?: string;
    timestamp?: string;
    change_type?: KeyChange['change_type'];
}
export interface ChpAgentContext {
    active_agent: string;
    last_action: string;
}
export interface ChpHandoffState {
    version: typeof CHP_VERSION;
    project: string;
    workspace_root: string;
    current_task: string;
    goal: string;
    recent_changes: ChpRecentChange[];
    agent_context: ChpAgentContext;
    summary: string;
    last_updated: string;
}
export type ChpHandoffFormat = 'json' | 'markdown' | 'compact';
export interface BuildChpHandoffInput {
    workspaceRoot: string;
    handoff?: HandoffArtifact | null;
    change?: ChangeArtifact | null;
    currentTask?: string;
    lastWriter?: AdapterKind | string;
}
/** Build CHP v1 from in-memory runtime slices (sync — dashboard / IDE status bar). */
export declare function buildChpHandoffStateSync(input: BuildChpHandoffInput): ChpHandoffState | null;
/** Build CHP v1 state from runtime artifacts (single read model). */
export declare function buildChpHandoffState(input: BuildChpHandoffInput): Promise<ChpHandoffState | null>;
/** CHP compact one-liner for Passive CLI / IDE status bar. */
export declare function formatChpCompact(state: ChpHandoffState, filter?: string): string;
/** CHP markdown — AI chat injection (wraps V3.1 handoff block when available). */
export declare function formatChpMarkdown(chp: ChpHandoffState, handoff?: HandoffArtifact | null, timeline?: ProjectTimeline): string;
/** Unified get_handoff — read runtime artifacts and format. */
export declare function getProjectHandoff(workspaceRoot: string, format?: ChpHandoffFormat, filter?: string): Promise<{
    found: boolean;
    text?: string;
    state?: ChpHandoffState;
}>;
//# sourceMappingURL=chpHandoff.d.ts.map