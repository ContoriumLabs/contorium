"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildUnderstandingArtifacts = buildUnderstandingArtifacts;
exports.buildAndWriteUnderstandingArtifacts = buildAndWriteUnderstandingArtifacts;
const store_js_1 = require("../state-builder/store.js");
const bootstrapState_js_1 = require("../bootstrap/bootstrapState.js");
const changeDetector_js_1 = require("./changeDetector.js");
const graphBuilder_js_1 = require("./graphBuilder.js");
const impactAnalyzer_js_1 = require("./impactAnalyzer.js");
const intentFusion_js_1 = require("./intentFusion.js");
const handoffBuilder_js_1 = require("./handoffBuilder.js");
const timelineTracker_js_1 = require("./timelineTracker.js");
const gitFrequency_js_1 = require("./knowledgeGraph/gitFrequency.js");
const knowledgeGraphBuilder_js_1 = require("./knowledgeGraph/knowledgeGraphBuilder.js");
const store_js_2 = require("./knowledgeGraph/store.js");
const rebuildTrigger_js_1 = require("./knowledgeGraph/rebuildTrigger.js");
const understandingGraphBuilder_js_1 = require("./understandingGraphBuilder.js");
const store_js_3 = require("./store.js");
const version_js_1 = require("../version.js");
async function buildUnderstandingArtifacts(input) {
    const root = input.workspaceRoot;
    const state = input.state ?? (await (0, bootstrapState_js_1.readStateJson)(root));
    if (!state) {
        return undefined;
    }
    const changedFiles = await (0, changeDetector_js_1.resolveChangedFiles)(root, state, input.scan, input.extraChangedPaths ?? []);
    if (!changedFiles.length) {
        return undefined;
    }
    const now = Date.now();
    const built = input.built ?? (await (0, store_js_1.readProjectBuiltState)(root));
    const { graph, extractions } = await (0, graphBuilder_js_1.buildChangeNeighborhoodGraph)(root, changedFiles, now);
    const change = (0, graphBuilder_js_1.deriveChangeArtifact)(changedFiles, extractions, now);
    const impact = (0, impactAnalyzer_js_1.analyzeImpact)(graph, change);
    const intent = (0, intentFusion_js_1.fuseIntent)({ state, change, built });
    const goal = built?.project_goal?.trim() || state.currentTask.trim();
    const handoff = (0, handoffBuilder_js_1.buildHandoff)({ goal, intent, change, impact, graph, built, now });
    const timeline = await (0, timelineTracker_js_1.buildProjectTimeline)(root, changedFiles, change, graph, now);
    const editCounts = new Map();
    for (const p of [...changedFiles, ...(input.extraChangedPaths ?? [])]) {
        const k = p.replace(/\\/g, '/');
        editCounts.set(k, (editCounts.get(k) ?? 0) + 1);
    }
    const gitFrequency = (0, gitFrequency_js_1.buildGitFrequency)(timeline, state);
    const existing = await (0, store_js_2.readProjectKnowledgeGraph)(root);
    const latestCommit = timeline.recent[0]?.commit;
    const rebuildTrigger = (0, rebuildTrigger_js_1.resolveKnowledgeRebuildTrigger)({
        changedFileCount: changedFiles.length,
        intentChanged: goal !== (existing?.nodes.find((n) => n.type === 'intent')?.name ?? ''),
        lastBuildAt: existing?.meta.generatedAt,
        now,
        hasNewCommit: !!latestCommit && latestCommit !== existing?.meta.lastCommitHash,
        isInitial: !existing,
    });
    const knowledge = (0, knowledgeGraphBuilder_js_1.buildProjectKnowledgeGraph)({
        graph,
        change,
        intent,
        built,
        goal,
        workspaceRoot: root,
        sourceVersion: (0, version_js_1.getContoriumPackageVersion)(),
        now,
        editCounts,
        gitFrequency,
        rebuildTrigger,
        lastCommitHash: latestCommit,
    });
    return { graph, change, handoff, timeline, knowledge };
}
/** Build and persist V3.1 understanding artifacts (graph + change + handoff + timeline). */
async function buildAndWriteUnderstandingArtifacts(input) {
    const result = await buildUnderstandingArtifacts(input);
    if (!result) {
        return undefined;
    }
    const understandingGraph = (0, understandingGraphBuilder_js_1.buildUnderstandingGraph)({
        graph: result.graph,
        change: result.change,
        handoff: result.handoff,
        agent: input.state?.source?.lastWriter ?? 'runtime',
        now: Date.now(),
    });
    await (0, store_js_3.writeUnderstandingArtifacts)(input.workspaceRoot, { ...result, understandingGraph });
    await (0, store_js_2.writeProjectKnowledgeGraph)(input.workspaceRoot, result.knowledge);
    return result;
}
