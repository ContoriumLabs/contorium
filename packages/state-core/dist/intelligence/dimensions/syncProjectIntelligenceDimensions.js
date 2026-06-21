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
exports.syncCognitiveDimensions = void 0;
exports.syncProjectIntelligenceDimensions = syncProjectIntelligenceDimensions;
const path = __importStar(require("node:path"));
const bootstrapState_js_1 = require("../../bootstrap/bootstrapState.js");
const governanceArtifacts_js_1 = require("../../governance/governanceArtifacts.js");
const impactAnalyzer_js_1 = require("../../understanding/impactAnalyzer.js");
const store_js_1 = require("../../understanding/store.js");
const decisionProvenance_js_1 = require("../decisionProvenance.js");
const intentVNext_js_1 = require("../intentVNext.js");
const projectIdentity_js_1 = require("../projectIdentity.js");
const provenanceChain_js_1 = require("../systems/provenanceChain.js");
const evolutionGraph_js_1 = require("../systems/evolutionGraph.js");
const paths_js_1 = require("../paths.js");
const impactGraph_js_1 = require("./impactGraph.js");
const projectTimeline_js_1 = require("./projectTimeline.js");
const confidenceIndex_js_1 = require("./confidenceIndex.js");
const io_js_1 = require("./io.js");
function moduleOf(pathLike) {
    return pathLike.replace(/\\/g, '/').split('/')[0] ?? pathLike;
}
async function deriveTimelineEvents(workspaceRoot, writer, prevIdentity, nextIdentity, decisionGraph, intentGraph) {
    const events = [];
    const existing = await (0, projectTimeline_js_1.readProjectEvolutionTimeline)(workspaceRoot);
    const knownIds = new Set((existing?.events ?? []).map((e) => e.event_id));
    if (prevIdentity && prevIdentity.current_state_hash !== nextIdentity.current_state_hash) {
        const evt = (0, projectTimeline_js_1.makeEvolutionEvent)({
            event_type: 'state_change',
            entity_id: nextIdentity.project_id,
            before_snapshot: { state_hash: prevIdentity.current_state_hash },
            after_snapshot: { state_hash: nextIdentity.current_state_hash },
            trigger_source: writer,
            impact_summary: 'workspace state hash changed',
        });
        if (!knownIds.has(evt.event_id)) {
            events.push(evt);
        }
    }
    for (const node of decisionGraph?.nodes ?? []) {
        const evt = (0, projectTimeline_js_1.makeEvolutionEvent)({
            event_type: 'decision',
            entity_id: node.decision_id,
            before_snapshot: {},
            after_snapshot: {
                title: node.title,
                selected: node.selected,
                linked_intent: node.linked_intent,
            },
            trigger_source: writer,
            linked_intent: node.linked_intent,
            linked_decision: node.decision_id,
            impact_summary: node.reason.slice(0, 120),
            timestamp: Date.parse(node.timestamp) || Date.now(),
        });
        if (!knownIds.has(evt.event_id)) {
            events.push(evt);
        }
    }
    for (const node of intentGraph?.nodes ?? []) {
        const evt = (0, projectTimeline_js_1.makeEvolutionEvent)({
            event_type: 'intent_change',
            entity_id: node.intent_id,
            before_snapshot: {},
            after_snapshot: { name: node.name, why: node.why },
            trigger_source: writer,
            linked_intent: node.intent_id,
            impact_summary: node.description.slice(0, 120),
            timestamp: Date.parse(node.updated_at) || Date.now(),
        });
        if (!knownIds.has(evt.event_id)) {
            events.push(evt);
        }
    }
    const gitTimeline = await (0, store_js_1.readProjectTimeline)(workspaceRoot);
    for (const entry of (gitTimeline?.recent ?? []).slice(0, 8)) {
        const eventType = entry.impact_level === 'high' ? 'milestone' : 'refactor';
        const evt = (0, projectTimeline_js_1.makeEvolutionEvent)({
            event_type: eventType,
            entity_id: entry.file,
            before_snapshot: { commit: entry.commit },
            after_snapshot: { type: entry.type, impact_level: entry.impact_level },
            trigger_source: 'Git',
            impact_summary: `${entry.type} ${entry.file}`,
            timestamp: entry.timestamp * 1000 || Date.now(),
        });
        if (!knownIds.has(evt.event_id)) {
            events.push(evt);
        }
    }
    return events;
}
async function deriveImpactFromChange(workspaceRoot) {
    const [change, graph, handoff, decision] = await Promise.all([
        (0, store_js_1.readChangeArtifact)(workspaceRoot),
        (0, store_js_1.readProjectGraph)(workspaceRoot),
        (0, store_js_1.readHandoffArtifact)(workspaceRoot),
        (0, governanceArtifacts_js_1.readGovernanceDecision)(workspaceRoot),
    ]);
    if (!change && !handoff) {
        return;
    }
    const sourceEntity = decision?.decision ??
        change?.key_changes[0]?.symbol ??
        change?.changed_files[0] ??
        handoff?.current_focus ??
        'recent_change';
    let seedModules = [];
    let relatedModules = [];
    let riskHint = 'low';
    if (graph && change) {
        const impact = (0, impactAnalyzer_js_1.analyzeImpact)(graph, change);
        seedModules = impact.affected_modules.map(moduleOf);
        relatedModules = impact.affected_functions.map(moduleOf);
        riskHint = impact.risk;
    }
    else if (handoff) {
        seedModules = handoff.impact_summary.affected_modules.map(moduleOf);
        relatedModules = handoff.impact_summary.affected_functions.map(moduleOf);
        riskHint = handoff.impact_summary.risk;
    }
    const entry = (0, impactGraph_js_1.deriveImpactPropagation)({
        source_entity: String(sourceEntity),
        change_type: change?.key_changes[0]?.change_type ?? 'workspace_update',
        seed_modules: seedModules.length ? seedModules : ['project'],
        related_modules: relatedModules,
        risk_hint: riskHint,
    });
    await (0, impactGraph_js_1.upsertImpactGraphEntry)(workspaceRoot, entry);
}
async function deriveConfidenceEntities(workspaceRoot, decisionGraph, intentGraph) {
    const state = await (0, bootstrapState_js_1.readStateJson)(workspaceRoot);
    const gitTimeline = await (0, store_js_1.readProjectTimeline)(workspaceRoot);
    const changeFreq = (gitTimeline?.recent?.length ?? 0) + (state?.gitWorking.length ?? 0) * 0.5;
    const decisionVolatility = decisionGraph?.nodes.length ?? 0;
    const intentChanges = intentGraph?.nodes.length ?? 0;
    const entities = [];
    const now = new Date().toISOString();
    const projectDerived = (0, confidenceIndex_js_1.deriveConfidenceFromSignals)({
        change_frequency: changeFreq,
        decision_volatility: decisionVolatility,
        intent_changes: intentChanges,
    });
    entities.push({
        entity_id: 'project',
        ...projectDerived.entry,
        updated_at: now,
    });
    for (const node of intentGraph?.nodes ?? []) {
        const derived = (0, confidenceIndex_js_1.deriveConfidenceFromSignals)({
            change_frequency: node.related_modules.length * 0.4,
            decision_volatility: node.linked_decisions.length,
            intent_changes: 1,
        });
        entities.push({
            entity_id: node.intent_id,
            ...derived.entry,
            updated_at: now,
        });
    }
    for (const node of decisionGraph?.nodes ?? []) {
        const derived = (0, confidenceIndex_js_1.deriveConfidenceFromSignals)({
            change_frequency: node.impact_scope.length * 0.3,
            decision_volatility: 1,
            intent_changes: 0,
        });
        entities.push({
            entity_id: node.decision_id,
            ...derived.entry,
            updated_at: now,
        });
    }
    return entities;
}
async function embedConfidenceOnArtifacts(workspaceRoot, entities) {
    const byId = new Map(entities.map((e) => [e.entity_id, e]));
    const intentGraph = await (0, intentVNext_js_1.readIntentGraphVNext)(workspaceRoot);
    if (intentGraph) {
        const patched = {
            ...intentGraph,
            nodes: intentGraph.nodes.map((n) => {
                const conf = byId.get(n.intent_id);
                if (!conf) {
                    return n;
                }
                return {
                    ...n,
                    cognition: {
                        confidence: conf.confidence_score,
                        category: conf.category,
                        freshness: conf.freshness,
                    },
                };
            }),
        };
        await (0, io_js_1.writeJsonFile)((0, paths_js_1.intentGraphVNextPath)(workspaceRoot), patched);
    }
    const decisionGraph = await (0, decisionProvenance_js_1.readDecisionProvenanceGraph)(workspaceRoot);
    if (decisionGraph) {
        const patched = {
            ...decisionGraph,
            nodes: decisionGraph.nodes.map((n) => {
                const conf = byId.get(n.decision_id);
                if (!conf) {
                    return n;
                }
                return {
                    ...n,
                    cognition: {
                        confidence: conf.confidence_score,
                        category: conf.category,
                        freshness: conf.freshness,
                    },
                };
            }),
        };
        await (0, io_js_1.writeJsonFile)((0, paths_js_1.decisionGraphPath)(workspaceRoot), patched);
    }
    const projectConf = byId.get('project');
    const identity = await (0, projectIdentity_js_1.readProjectIdentity)(workspaceRoot);
    if (identity && projectConf) {
        const patched = {
            ...identity,
            cognition: {
                confidence: projectConf.confidence_score,
                category: projectConf.category,
                freshness: projectConf.freshness,
            },
        };
        await (0, io_js_1.writeJsonFile)((0, paths_js_1.identityPath)(workspaceRoot), patched);
    }
    const state = await (0, bootstrapState_js_1.readStateJson)(workspaceRoot);
    if (state && projectConf) {
        const patched = {
            ...state,
            cognition: {
                confidence: projectConf.confidence_score,
                category: projectConf.category,
                freshness: projectConf.freshness,
            },
        };
        const statePath = path.join((0, paths_js_1.contoraRoot)(workspaceRoot), 'state.json');
        await (0, io_js_1.writeJsonFile)(statePath, patched);
    }
}
/** Capture · Structure · Preserve — descriptive intelligence dimensions only. */
async function syncProjectIntelligenceDimensions(workspaceRoot, writer, _mode = 'merged', prevIdentity = null) {
    const prior = prevIdentity ?? (await (0, projectIdentity_js_1.readProjectIdentity)(workspaceRoot));
    const [decisionGraph, intentGraph] = await Promise.all([
        (0, decisionProvenance_js_1.readDecisionProvenanceGraph)(workspaceRoot),
        (0, intentVNext_js_1.readIntentGraphVNext)(workspaceRoot),
    ]);
    const nextIdentity = (await (0, projectIdentity_js_1.readProjectIdentity)(workspaceRoot)) ??
        {
            project_id: 'project',
            current_state_hash: '',
        };
    const timelineEvents = await deriveTimelineEvents(workspaceRoot, writer, prior, nextIdentity, decisionGraph, intentGraph);
    if (timelineEvents.length) {
        await (0, projectTimeline_js_1.appendProjectEvolutionEvents)(workspaceRoot, timelineEvents);
    }
    await deriveImpactFromChange(workspaceRoot);
    const confidenceEntities = await deriveConfidenceEntities(workspaceRoot, decisionGraph, intentGraph);
    await (0, confidenceIndex_js_1.writeConfidenceIndex)(workspaceRoot, confidenceEntities);
    await embedConfidenceOnArtifacts(workspaceRoot, confidenceEntities);
    await (0, provenanceChain_js_1.deriveProvenanceChains)(workspaceRoot);
    await (0, evolutionGraph_js_1.deriveEvolutionGraph)(workspaceRoot);
}
/** @deprecated use syncProjectIntelligenceDimensions */
exports.syncCognitiveDimensions = syncProjectIntelligenceDimensions;
