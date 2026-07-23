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
exports.ASSUMPTION_GRAPH_SCHEMA = void 0;
exports.buildAssumptionGraph = buildAssumptionGraph;
exports.persistAssumptionGraph = persistAssumptionGraph;
exports.readAssumptionGraph = readAssumptionGraph;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const assumption_js_1 = require("./assumption.js");
const governanceGraphPaths_js_1 = require("./governanceGraphPaths.js");
exports.ASSUMPTION_GRAPH_SCHEMA = 'contorium.assumption_graph.v1';
function mapAssumptionType(type, statement) {
    const lower = statement.toLowerCase();
    if (/owner|team|maintainer/.test(lower)) {
        return 'ownership';
    }
    if (/traffic|scale|users?|cost|budget|revenue/.test(lower)) {
        return type === 'BUSINESS_ASSUMPTION' ? 'business' : 'cost';
    }
    if (/latency|performance|throughput|rps|qps/.test(lower)) {
        return 'performance';
    }
    if (/security|auth|encrypt|compliance/.test(lower)) {
        return 'security';
    }
    if (/monolith|microservice|architecture|service mesh/.test(lower)) {
        return 'architecture';
    }
    return 'technology';
}
function verificationSourcesFor(adr, statement) {
    const sources = ['adr'];
    const lower = `${adr.title} ${adr.reason} ${statement}`.toLowerCase();
    if (/redis|postgres|sqlite|jwt|oauth|graphql|mcp/.test(lower)) {
        sources.push('package.json');
    }
    if (/module|service|\.ts|\.js/.test(lower)) {
        sources.push('code');
    }
    return sources;
}
function buildAssumptionGraph(adrs) {
    const assumptions = [];
    for (const adr of adrs) {
        const extracted = (0, assumption_js_1.extractAdrAssumptions)(adr);
        extracted.forEach((a, idx) => {
            assumptions.push({
                id: `A-${adr.id}-${idx + 1}`,
                decision_id: adr.id,
                assumption: a.statement,
                type: mapAssumptionType(a.type, a.statement),
                verification_sources: verificationSourcesFor(adr, a.statement),
            });
        });
    }
    return {
        schema: exports.ASSUMPTION_GRAPH_SCHEMA,
        updated_at: new Date().toISOString(),
        assumptions,
    };
}
async function persistAssumptionGraph(workspaceRoot, adrs) {
    const artifact = buildAssumptionGraph(adrs);
    await fs.mkdir(path.dirname((0, governanceGraphPaths_js_1.assumptionGraphPath)(workspaceRoot)), { recursive: true });
    await fs.writeFile((0, governanceGraphPaths_js_1.assumptionGraphPath)(workspaceRoot), `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    return artifact;
}
async function readAssumptionGraph(workspaceRoot) {
    try {
        const raw = JSON.parse(await fs.readFile((0, governanceGraphPaths_js_1.assumptionGraphPath)(workspaceRoot), 'utf8'));
        if (raw?.schema === exports.ASSUMPTION_GRAPH_SCHEMA && Array.isArray(raw.assumptions)) {
            return raw;
        }
    }
    catch {
        // missing graph
    }
    return null;
}
