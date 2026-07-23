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
exports.DECISION_DEPENDENCY_GRAPH_SCHEMA = void 0;
exports.buildDecisionDependencyGraph = buildDecisionDependencyGraph;
exports.persistDecisionDependencyGraph = persistDecisionDependencyGraph;
exports.readDecisionDependencyGraph = readDecisionDependencyGraph;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const eventStore_js_1 = require("../cil/eventStore.js");
const assumption_js_1 = require("./assumption.js");
const dependencyInventory_js_1 = require("./dependencyInventory.js");
const governanceGraphPaths_js_1 = require("./governanceGraphPaths.js");
const assumptionGraph_js_1 = require("./assumptionGraph.js");
exports.DECISION_DEPENDENCY_GRAPH_SCHEMA = 'contorium.decision_dependency_graph.v1';
function extractTechDependencies(text) {
    return (0, dependencyInventory_js_1.extractTechTerms)(text);
}
function modulesForDecision(adr, events) {
    const modules = new Set();
    for (const evt of events) {
        const linked = evt.linked_decision_id === adr.id ||
            evt.decision === adr.id ||
            evt.title.toLowerCase().includes(adr.title.toLowerCase().slice(0, 16));
        if (!linked) {
            continue;
        }
        for (const file of evt.files ?? []) {
            if (/\.(ts|tsx|js|jsx|py|go|rs)$/.test(file)) {
                modules.add(file.replace(/\\/g, '/'));
            }
        }
    }
    return [...modules].slice(0, 12);
}
function buildDecisionDependencyGraph(adrs, events, assumptionGraph) {
    const graph = assumptionGraph ?? (0, assumptionGraph_js_1.buildAssumptionGraph)(adrs);
    const byDecision = new Map();
    for (const node of graph.assumptions) {
        const list = byDecision.get(node.decision_id) ?? [];
        list.push(node.id);
        byDecision.set(node.decision_id, list);
    }
    const decisions = adrs
        .filter((a) => a.status !== 'rejected')
        .map((adr) => {
        const text = `${adr.title} ${adr.reason}`;
        const deps = extractTechDependencies(text);
        const assumptions = byDecision.get(adr.id) ?? [];
        if (!assumptions.length) {
            (0, assumption_js_1.extractAdrAssumptions)(adr).forEach((_, idx) => {
                assumptions.push(`A-${adr.id}-${idx + 1}`);
            });
        }
        return {
            decision: adr.id,
            depends_on: {
                assumptions,
                modules: modulesForDecision(adr, events),
                dependencies: deps,
                owners: [],
            },
        };
    });
    return {
        schema: exports.DECISION_DEPENDENCY_GRAPH_SCHEMA,
        updated_at: new Date().toISOString(),
        decisions,
    };
}
async function persistDecisionDependencyGraph(workspaceRoot, adrs) {
    const events = await (0, eventStore_js_1.readAllCognitiveEvents)(workspaceRoot).catch(() => []);
    const assumptionGraph = (0, assumptionGraph_js_1.buildAssumptionGraph)(adrs);
    const artifact = buildDecisionDependencyGraph(adrs, events, assumptionGraph);
    await fs.mkdir(path.dirname((0, governanceGraphPaths_js_1.decisionDependencyGraphPath)(workspaceRoot)), { recursive: true });
    await fs.writeFile((0, governanceGraphPaths_js_1.decisionDependencyGraphPath)(workspaceRoot), `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    return artifact;
}
async function readDecisionDependencyGraph(workspaceRoot) {
    try {
        const raw = JSON.parse(await fs.readFile((0, governanceGraphPaths_js_1.decisionDependencyGraphPath)(workspaceRoot), 'utf8'));
        if (raw?.schema === exports.DECISION_DEPENDENCY_GRAPH_SCHEMA && Array.isArray(raw.decisions)) {
            return raw;
        }
    }
    catch {
        // missing graph
    }
    return null;
}
