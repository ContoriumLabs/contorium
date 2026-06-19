import { preActionCheck } from './executionGuard.js';
import { readGuardSession, writeGuardSession } from './store.js';
import type {
  AdapterPreWriteResult,
  ExecutionGuardResult,
  GuardSession,
  PreActionCheckInput,
} from './types.js';

/** Default freshness window for adapter guard sessions (15 minutes). */
export const GUARD_SESSION_TTL_MS = 15 * 60 * 1000;

export function isGuardSessionFresh(
  session: GuardSession | undefined,
  ttlMs = GUARD_SESSION_TTL_MS,
): boolean {
  if (!session?.lastCheckAt) {
    return false;
  }
  return Date.now() - session.lastCheckAt < ttlMs;
}

export async function recordGuardSession(
  workspaceRoot: string,
  guard: ExecutionGuardResult,
  meta?: { source?: string; target_path?: string },
): Promise<void> {
  const session: GuardSession = {
    version: 1,
    lastCheckAt: Date.now(),
    lastAction: guard.action,
    lastAllow: guard.allow,
    source: meta?.source,
    target_path: meta?.target_path,
  };
  await writeGuardSession(workspaceRoot, session);
}

/**
 * Optional adapter entry point — call before file writes in IDE / CLI / MCP wrappers.
 * `strict: true` blocks when guard.action is confirm|block (harder than AI-only protocol).
 */
export async function adapterPreWriteHook(
  workspaceRoot: string,
  input: PreActionCheckInput,
  opts?: { strict?: boolean; source?: string },
): Promise<AdapterPreWriteResult> {
  const guard = await preActionCheck(workspaceRoot, input);
  await recordGuardSession(workspaceRoot, guard, {
    source: opts?.source ?? 'adapter-hook',
    target_path: input.target_path,
  });

  const enforced = opts?.strict === true;

  if (guard.action === 'block') {
    return { allowed: false, guard, enforced };
  }
  if (guard.action === 'confirm' && !input.user_confirmed) {
    return { allowed: enforced ? false : guard.allow, guard, enforced };
  }

  return {
    allowed: guard.allow || guard.action === 'warn',
    guard,
    enforced,
  };
}

/** Soft reminder when no recent guard check (MCP handoff augmentation). */
export async function getGuardReminder(
  workspaceRoot: string,
  ttlMs = GUARD_SESSION_TTL_MS,
): Promise<string | undefined> {
  const session = await readGuardSession(workspaceRoot);
  if (isGuardSessionFresh(session, ttlMs)) {
    return undefined;
  }
  return 'No recent check_action in this session — call check_action before editing protected paths or core logic.';
}
