"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.readProjectIdentity = readProjectIdentity;
exports.syncProjectIdentity = syncProjectIdentity;
const node_crypto_1 = require("node:crypto");
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const store_js_1 = require("../understanding/store.js");
const bootstrapState_js_1 = require("../bootstrap/bootstrapState.js");
const governanceArtifacts_js_1 = require("../governance/governanceArtifacts.js");
const decisionProvenance_js_1 = require("./decisionProvenance.js");
const intentVNext_js_1 = require("./intentVNext.js");
const paths_js_1 = require("./paths.js");
const types_js_1 = require("./types.js");
const version_js_1 = require("../version.js");
function hashPayload(payload) {
    return (0, node_crypto_1.createHash)('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}
async function readProjectIdentity(workspaceRoot) {
    try {
        const text = await fs.readFile((0, paths_js_1.identityPath)(workspaceRoot), 'utf8');
        const raw = JSON.parse(text);
        if (raw?.schema === types_js_1.PROJECT_INTELLIGENCE_SCHEMA) {
            return raw;
        }
        return null;
    }
    catch {
        return null;
    }
}
async function syncProjectIdentity(workspaceRoot, writer, syncMode = 'merged') {
    const root = path.resolve(workspaceRoot);
    const [state, handoff, decision, intentNodes, decisionGraph] = await Promise.all([
        (0, bootstrapState_js_1.readStateJson)(root),
        (0, store_js_1.readHandoffArtifact)(root),
        (0, governanceArtifacts_js_1.readGovernanceDecision)(root),
        (0, intentVNext_js_1.readIntentNodesVNext)(root),
        (0, decisionProvenance_js_1.readDecisionProvenanceGraph)(root),
    ]);
    const projectId = path.basename(root).replace(/[^\w.-]+/g, '_') || 'project';
    const hashSource = {
        task: state?.currentTask ?? '',
        focus: handoff?.current_focus ?? '',
        goal: handoff?.goal ?? '',
        gitStaged: state?.gitStaged?.length ?? 0,
        gitWorking: state?.gitWorking?.length ?? 0,
        decision: decision?.decision ?? null,
    };
    const activeIntents = intentNodes
        .filter((n) => n.intent_id)
        .slice(0, 12)
        .map((n) => n.intent_id);
    const activeDecisions = (decisionGraph?.nodes ?? [])
        .slice(-8)
        .map((n) => n.decision_id);
    if (decision && !activeDecisions.length) {
        activeDecisions.push(`gov_${decision.created_at}`);
    }
    const prev = await readProjectIdentity(root);
    const toolSources = [...(prev?.tool_sources ?? [])];
    const idx = toolSources.findIndex((t) => t.tool === writer);
    const seen = { tool: writer, last_seen: new Date().toISOString() };
    if (idx >= 0) {
        toolSources[idx] = seen;
    }
    else {
        toolSources.push(seen);
    }
    const identity = {
        schema: types_js_1.PROJECT_INTELLIGENCE_SCHEMA,
        project_id: projectId,
        current_state_hash: hashPayload(hashSource),
        active_intents: activeIntents,
        active_decisions: activeDecisions,
        last_tool_source: writer,
        runtime_version: (0, version_js_1.getContoriumPackageVersion)(),
        sync_mode: syncMode,
        updated_at: new Date().toISOString(),
        tool_sources: toolSources.slice(-8),
    };
    await fs.mkdir(path.join((0, paths_js_1.contoraRoot)(root), paths_js_1.IDENTITY_DIR), { recursive: true });
    await fs.writeFile((0, paths_js_1.identityPath)(root), `${JSON.stringify(identity, null, 2)}\n`, 'utf8');
    return identity;
}
