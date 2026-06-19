"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GUARD_SESSION_TTL_MS = void 0;
exports.isGuardSessionFresh = isGuardSessionFresh;
exports.recordGuardSession = recordGuardSession;
exports.adapterPreWriteHook = adapterPreWriteHook;
exports.getGuardReminder = getGuardReminder;
const executionGuard_js_1 = require("./executionGuard.js");
const store_js_1 = require("./store.js");
/** Default freshness window for adapter guard sessions (15 minutes). */
exports.GUARD_SESSION_TTL_MS = 15 * 60 * 1000;
function isGuardSessionFresh(session, ttlMs = exports.GUARD_SESSION_TTL_MS) {
    if (!session?.lastCheckAt) {
        return false;
    }
    return Date.now() - session.lastCheckAt < ttlMs;
}
async function recordGuardSession(workspaceRoot, guard, meta) {
    const session = {
        version: 1,
        lastCheckAt: Date.now(),
        lastAction: guard.action,
        lastAllow: guard.allow,
        source: meta?.source,
        target_path: meta?.target_path,
    };
    await (0, store_js_1.writeGuardSession)(workspaceRoot, session);
}
/**
 * Optional adapter entry point — call before file writes in IDE / CLI / MCP wrappers.
 * `strict: true` blocks when guard.action is confirm|block (harder than AI-only protocol).
 */
async function adapterPreWriteHook(workspaceRoot, input, opts) {
    const guard = await (0, executionGuard_js_1.preActionCheck)(workspaceRoot, input);
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
async function getGuardReminder(workspaceRoot, ttlMs = exports.GUARD_SESSION_TTL_MS) {
    const session = await (0, store_js_1.readGuardSession)(workspaceRoot);
    if (isGuardSessionFresh(session, ttlMs)) {
        return undefined;
    }
    return 'No recent check_action in this session — call check_action before editing protected paths or core logic.';
}
