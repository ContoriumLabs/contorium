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
exports.COGNITION_SNAPSHOT_FILE = exports.COGNITION_ENGINE_STATE_FILE = exports.COGNITION_DIR = exports.REPOSITORY_SCHEMA_VERSION = exports.CONTORIUM_VERSION = exports.ARTIFACT_SCHEMA_VERSION = exports.REPOSITORY_RUNTIME_VERSION = exports.DECISION_LOG_FILE = exports.DECISION_DIR = exports.STATE_CANONICAL_FILE = exports.STATE_DIR = exports.INTELLIGENCE_VALIDATION_FILE = exports.INTELLIGENCE_HEALTH_FILE = exports.INTELLIGENCE_SNAPSHOT_FILE = exports.INTELLIGENCE_REPOSITORY_STATE_FILE = exports.INTELLIGENCE_DIR = exports.EVOLUTION_GRAPH_FILE = exports.EVOLUTION_DIR = exports.PROVENANCE_CHAIN_FILE = exports.PROVENANCE_DIR = exports.STABILITY_INDEX_FILE = exports.STABILITY_DIR = exports.CONFIDENCE_INDEX_FILE = exports.CONFIDENCE_DIR = exports.LEGACY_KNOWLEDGE_GRAPH_FILE = exports.KNOWLEDGE_GRAPH_FILE = exports.IMPACT_GRAPH_FILE = exports.GRAPH_DIR = exports.PROJECT_EVOLUTION_FILE = exports.TIMELINE_DIR = exports.DECISION_GRAPH_FILE = exports.LEGACY_INTENT_GRAPH = exports.WHY_FILE = exports.INTENT_NODES_FILE = exports.INTENT_GRAPH_FILE = exports.INTENT_DIR = exports.IDENTITY_FILE = exports.IDENTITY_DIR = void 0;
exports.contoraRoot = contoraRoot;
exports.identityPath = identityPath;
exports.intentDir = intentDir;
exports.intentGraphVNextPath = intentGraphVNextPath;
exports.intentNodesPath = intentNodesPath;
exports.whyLayerPath = whyLayerPath;
exports.decisionGraphPath = decisionGraphPath;
exports.legacyDecisionGraphPath = legacyDecisionGraphPath;
exports.decisionLogPath = decisionLogPath;
exports.stateCanonicalPath = stateCanonicalPath;
exports.legacyStatePath = legacyStatePath;
exports.intelligenceHealthPath = intelligenceHealthPath;
exports.intelligenceValidationPath = intelligenceValidationPath;
exports.legacyIntentGraphPath = legacyIntentGraphPath;
exports.projectEvolutionTimelinePath = projectEvolutionTimelinePath;
exports.impactGraphPath = impactGraphPath;
exports.knowledgeGraphCanonicalPath = knowledgeGraphCanonicalPath;
exports.legacyKnowledgeGraphPath = legacyKnowledgeGraphPath;
exports.confidenceIndexPath = confidenceIndexPath;
exports.stabilityIndexPath = stabilityIndexPath;
exports.legacyStabilityIndexPath = legacyStabilityIndexPath;
exports.provenanceChainPath = provenanceChainPath;
exports.evolutionGraphPath = evolutionGraphPath;
exports.intelligenceRepositoryStatePath = intelligenceRepositoryStatePath;
exports.intelligenceSnapshotPath = intelligenceSnapshotPath;
exports.cognitionEngineStatePath = cognitionEngineStatePath;
exports.cognitionSnapshotPath = cognitionSnapshotPath;
const path = __importStar(require("node:path"));
exports.IDENTITY_DIR = 'identity';
exports.IDENTITY_FILE = 'project_identity.json';
exports.INTENT_DIR = 'intent';
exports.INTENT_GRAPH_FILE = 'intent_graph.json';
exports.INTENT_NODES_FILE = 'intent_nodes.json';
exports.WHY_FILE = 'why.json';
exports.LEGACY_INTENT_GRAPH = 'intent-graph/graph.json';
exports.DECISION_GRAPH_FILE = 'decision_graph.json';
exports.TIMELINE_DIR = 'timeline';
exports.PROJECT_EVOLUTION_FILE = 'project_timeline.json';
exports.GRAPH_DIR = 'graph';
exports.IMPACT_GRAPH_FILE = 'impact_graph.json';
exports.KNOWLEDGE_GRAPH_FILE = 'knowledge_graph.json';
exports.LEGACY_KNOWLEDGE_GRAPH_FILE = 'knowledge.json';
exports.CONFIDENCE_DIR = 'confidence';
exports.CONFIDENCE_INDEX_FILE = 'confidence_index.json';
/** @deprecated use CONFIDENCE_DIR */
exports.STABILITY_DIR = 'confidence';
/** @deprecated use CONFIDENCE_INDEX_FILE */
exports.STABILITY_INDEX_FILE = 'confidence_index.json';
exports.PROVENANCE_DIR = 'provenance';
exports.PROVENANCE_CHAIN_FILE = 'provenance_chain.json';
exports.EVOLUTION_DIR = 'evolution';
exports.EVOLUTION_GRAPH_FILE = 'evolution_graph.json';
exports.INTELLIGENCE_DIR = 'intelligence';
exports.INTELLIGENCE_REPOSITORY_STATE_FILE = 'repository_state.json';
exports.INTELLIGENCE_SNAPSHOT_FILE = 'snapshot.json';
exports.INTELLIGENCE_HEALTH_FILE = 'health.json';
exports.INTELLIGENCE_VALIDATION_FILE = 'validation.json';
exports.STATE_DIR = 'state';
exports.STATE_CANONICAL_FILE = 'state.json';
exports.DECISION_DIR = 'decision';
exports.DECISION_LOG_FILE = 'decision_log.json';
exports.REPOSITORY_RUNTIME_VERSION = '1.1.3';
/** Unified artifact format version — aligned with release */
exports.ARTIFACT_SCHEMA_VERSION = exports.REPOSITORY_RUNTIME_VERSION;
/** Public Contorium release version */
exports.CONTORIUM_VERSION = exports.REPOSITORY_RUNTIME_VERSION;
/** @deprecated use REPOSITORY_RUNTIME_VERSION */
exports.REPOSITORY_SCHEMA_VERSION = exports.REPOSITORY_RUNTIME_VERSION;
/** @deprecated use INTELLIGENCE_DIR */
exports.COGNITION_DIR = 'intelligence';
/** @deprecated */
exports.COGNITION_ENGINE_STATE_FILE = 'repository_state.json';
/** @deprecated */
exports.COGNITION_SNAPSHOT_FILE = 'snapshot.json';
function contoraRoot(workspaceRoot) {
    return path.join(path.resolve(workspaceRoot), '.contora');
}
function identityPath(workspaceRoot) {
    return path.join(contoraRoot(workspaceRoot), exports.IDENTITY_DIR, exports.IDENTITY_FILE);
}
function intentDir(workspaceRoot) {
    return path.join(contoraRoot(workspaceRoot), exports.INTENT_DIR);
}
function intentGraphVNextPath(workspaceRoot) {
    return path.join(intentDir(workspaceRoot), exports.INTENT_GRAPH_FILE);
}
function intentNodesPath(workspaceRoot) {
    return path.join(intentDir(workspaceRoot), exports.INTENT_NODES_FILE);
}
function whyLayerPath(workspaceRoot) {
    return path.join(intentDir(workspaceRoot), exports.WHY_FILE);
}
function decisionGraphPath(workspaceRoot) {
    return path.join(contoraRoot(workspaceRoot), exports.DECISION_DIR, exports.DECISION_GRAPH_FILE);
}
function legacyDecisionGraphPath(workspaceRoot) {
    return path.join(contoraRoot(workspaceRoot), 'governance', exports.DECISION_GRAPH_FILE);
}
function decisionLogPath(workspaceRoot) {
    return path.join(contoraRoot(workspaceRoot), exports.DECISION_DIR, exports.DECISION_LOG_FILE);
}
function stateCanonicalPath(workspaceRoot) {
    return path.join(contoraRoot(workspaceRoot), exports.STATE_DIR, exports.STATE_CANONICAL_FILE);
}
function legacyStatePath(workspaceRoot) {
    return path.join(contoraRoot(workspaceRoot), exports.STATE_CANONICAL_FILE);
}
function intelligenceHealthPath(workspaceRoot) {
    return path.join(contoraRoot(workspaceRoot), exports.INTELLIGENCE_DIR, exports.INTELLIGENCE_HEALTH_FILE);
}
function intelligenceValidationPath(workspaceRoot) {
    return path.join(contoraRoot(workspaceRoot), exports.INTELLIGENCE_DIR, exports.INTELLIGENCE_VALIDATION_FILE);
}
function legacyIntentGraphPath(workspaceRoot) {
    return path.join(contoraRoot(workspaceRoot), exports.LEGACY_INTENT_GRAPH);
}
function projectEvolutionTimelinePath(workspaceRoot) {
    return path.join(contoraRoot(workspaceRoot), exports.TIMELINE_DIR, exports.PROJECT_EVOLUTION_FILE);
}
function impactGraphPath(workspaceRoot) {
    return path.join(contoraRoot(workspaceRoot), exports.GRAPH_DIR, exports.IMPACT_GRAPH_FILE);
}
function knowledgeGraphCanonicalPath(workspaceRoot) {
    return path.join(contoraRoot(workspaceRoot), exports.GRAPH_DIR, exports.KNOWLEDGE_GRAPH_FILE);
}
function legacyKnowledgeGraphPath(workspaceRoot) {
    return path.join(contoraRoot(workspaceRoot), exports.GRAPH_DIR, exports.LEGACY_KNOWLEDGE_GRAPH_FILE);
}
function confidenceIndexPath(workspaceRoot) {
    return path.join(contoraRoot(workspaceRoot), exports.CONFIDENCE_DIR, exports.CONFIDENCE_INDEX_FILE);
}
/** @deprecated use confidenceIndexPath */
function stabilityIndexPath(workspaceRoot) {
    return confidenceIndexPath(workspaceRoot);
}
function legacyStabilityIndexPath(workspaceRoot) {
    return path.join(contoraRoot(workspaceRoot), 'stability', 'stability_index.json');
}
function provenanceChainPath(workspaceRoot) {
    return path.join(contoraRoot(workspaceRoot), exports.PROVENANCE_DIR, exports.PROVENANCE_CHAIN_FILE);
}
function evolutionGraphPath(workspaceRoot) {
    return path.join(contoraRoot(workspaceRoot), exports.EVOLUTION_DIR, exports.EVOLUTION_GRAPH_FILE);
}
function intelligenceRepositoryStatePath(workspaceRoot) {
    return path.join(contoraRoot(workspaceRoot), exports.INTELLIGENCE_DIR, exports.INTELLIGENCE_REPOSITORY_STATE_FILE);
}
function intelligenceSnapshotPath(workspaceRoot) {
    return path.join(contoraRoot(workspaceRoot), exports.INTELLIGENCE_DIR, exports.INTELLIGENCE_SNAPSHOT_FILE);
}
/** @deprecated use intelligenceRepositoryStatePath */
function cognitionEngineStatePath(workspaceRoot) {
    return intelligenceRepositoryStatePath(workspaceRoot);
}
/** @deprecated use intelligenceSnapshotPath */
function cognitionSnapshotPath(workspaceRoot) {
    return intelligenceSnapshotPath(workspaceRoot);
}
