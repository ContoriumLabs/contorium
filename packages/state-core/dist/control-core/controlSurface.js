"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContoriumControlSurface = void 0;
exports.createControlSurface = createControlSurface;
const adapterSync_js_1 = require("../adapterSync.js");
const adapterHook_js_1 = require("../governance/adapterHook.js");
const executionGuard_js_1 = require("../governance/executionGuard.js");
const init_js_1 = require("../governance/init.js");
const internalApi_js_1 = require("../governance/internalApi.js");
const governanceEngine_js_1 = require("../governance/governanceEngine.js");
const changeTracker_js_1 = require("../governance/changeTracker.js");
/**
 * Contorium Control Surface — unified closed-loop entry for IDE / MCP / CLI.
 * Adapters call this layer; state-core remains the single truth engine.
 */
class ContoriumControlSurface {
    workspaceRoot;
    source;
    constructor(workspaceRoot, source) {
        this.workspaceRoot = workspaceRoot;
        this.source = source;
    }
    ctx() {
        return { workspaceRoot: this.workspaceRoot, source: this.source };
    }
    /** Ensure governance seed + lightweight sync (idempotent). */
    async ensureReady() {
        const gov = await (0, init_js_1.ensureGovernanceLayer)(this.workspaceRoot);
        const sync = await (0, adapterSync_js_1.syncWorkspaceState)(this.workspaceRoot, this.source, { skipGitScan: true }).catch(() => ({ updated: false }));
        return {
            governance_initialized: gov.initialized,
            synced: sync.updated === true,
        };
    }
    async getGovernance() {
        await (0, init_js_1.ensureGovernanceLayer)(this.workspaceRoot);
        const governance = await (0, governanceEngine_js_1.getGovernanceSummary)(this.workspaceRoot);
        return { ...this.ctx(), loop: 'governance', governance };
    }
    async checkAction(input) {
        await (0, init_js_1.ensureGovernanceLayer)(this.workspaceRoot);
        const guard = await (0, executionGuard_js_1.preActionCheck)(this.workspaceRoot, input);
        await (0, adapterHook_js_1.recordGuardSession)(this.workspaceRoot, guard, {
            source: `${this.source}:control`,
            target_path: input.target_path,
        });
        return {
            ...this.ctx(),
            loop: 'check',
            guard,
            label: (0, executionGuard_js_1.guardActionLabel)(guard.action),
        };
    }
    async updateIntent(userInput) {
        await (0, init_js_1.ensureGovernanceLayer)(this.workspaceRoot);
        const update = await (0, internalApi_js_1.updateCognitiveFromInput)(this.workspaceRoot, userInput);
        await (0, internalApi_js_1.refreshProjectCognitive)(this.workspaceRoot).catch(() => undefined);
        return { ...this.ctx(), loop: 'intent', update };
    }
    async analyze() {
        const snapshot = await (0, internalApi_js_1.analyzeProject)(this.workspaceRoot);
        return { ...this.ctx(), loop: 'analyze', snapshot };
    }
    async getState() {
        return (0, internalApi_js_1.getProjectState)(this.workspaceRoot);
    }
    /**
     * Full closed loop: governance check → optional audit → cognitive feedback sync.
     * Intent → State → Governance → Execution feedback
     */
    async executeAction(input) {
        await (0, init_js_1.ensureGovernanceLayer)(this.workspaceRoot);
        const hook = await (0, adapterHook_js_1.adapterPreWriteHook)(this.workspaceRoot, input, { strict: input.strict === true, source: `${this.source}:execute` });
        const guard = hook.guard;
        let tracked = false;
        let change_id;
        if (input.audit !== false) {
            const track = await (0, changeTracker_js_1.validateAndTrackChange)(this.workspaceRoot, input, `${this.source}:control-execute`);
            tracked = track.recorded;
            change_id = track.change_id;
        }
        await (0, internalApi_js_1.refreshProjectCognitive)(this.workspaceRoot).catch(() => undefined);
        return {
            ...this.ctx(),
            loop: 'execute',
            allowed: hook.allowed,
            guard,
            label: (0, executionGuard_js_1.guardActionLabel)(guard.action),
            tracked,
            change_id,
            feedback: {
                cognitive_synced: true,
                governance_ready: true,
            },
        };
    }
}
exports.ContoriumControlSurface = ContoriumControlSurface;
function createControlSurface(workspaceRoot, source) {
    return new ContoriumControlSurface(workspaceRoot, source);
}
