import type { AdapterPreWriteResult, ExecutionGuardResult, GuardSession, PreActionCheckInput } from './types.js';
/** Default freshness window for adapter guard sessions (15 minutes). */
export declare const GUARD_SESSION_TTL_MS: number;
export declare function isGuardSessionFresh(session: GuardSession | undefined, ttlMs?: number): boolean;
export declare function recordGuardSession(workspaceRoot: string, guard: ExecutionGuardResult, meta?: {
    source?: string;
    target_path?: string;
}): Promise<void>;
/**
 * Optional adapter entry point — call before file writes in IDE / CLI / MCP wrappers.
 * `strict: true` blocks when guard.action is confirm|block (harder than AI-only protocol).
 */
export declare function adapterPreWriteHook(workspaceRoot: string, input: PreActionCheckInput, opts?: {
    strict?: boolean;
    source?: string;
}): Promise<AdapterPreWriteResult>;
/** Soft reminder when no recent guard check (MCP handoff augmentation). */
export declare function getGuardReminder(workspaceRoot: string, ttlMs?: number): Promise<string | undefined>;
//# sourceMappingURL=adapterHook.d.ts.map