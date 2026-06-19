"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureGovernanceLayer = ensureGovernanceLayer;
exports.syncIdentityFocus = syncIdentityFocus;
const defaults_js_1 = require("./defaults.js");
const store_js_1 = require("./store.js");
/**
 * Seed `.contora/governance/` on first workspace bootstrap.
 * Never overwrites existing user-edited files.
 */
async function ensureGovernanceLayer(workspaceRoot) {
    const exists = await (0, store_js_1.governanceExists)(workspaceRoot);
    if (exists) {
        return { initialized: true, created: false };
    }
    await (0, store_js_1.writeConstitution)(workspaceRoot, (0, defaults_js_1.defaultConstitution)());
    await (0, store_js_1.writeTruthLayer)(workspaceRoot, (0, defaults_js_1.defaultTruthLayer)());
    await (0, store_js_1.writeIdentity)(workspaceRoot, await (0, defaults_js_1.defaultIdentity)(workspaceRoot));
    return { initialized: true, created: true };
}
/** Refresh identity.current_focus from handoff without overwriting user fields. */
async function syncIdentityFocus(workspaceRoot, focus) {
    const identity = await (0, store_js_1.readIdentity)(workspaceRoot);
    if (!identity || focus.length === 0) {
        return;
    }
    const merged = [...new Set([...identity.current_focus, ...focus])].slice(0, 8);
    if (JSON.stringify(merged) === JSON.stringify(identity.current_focus)) {
        return;
    }
    await (0, store_js_1.writeIdentity)(workspaceRoot, { ...identity, current_focus: merged });
}
