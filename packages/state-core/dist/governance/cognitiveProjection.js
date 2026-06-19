"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncCognitiveLayer = syncCognitiveLayer;
const store_js_1 = require("../understanding/store.js");
const init_js_1 = require("./init.js");
const store_js_2 = require("./store.js");
function estimateProgress(state, handoff) {
    const task = state?.currentTask?.trim();
    if (task && handoff?.next_actions?.length) {
        return 0.55;
    }
    if (handoff?.key_changes?.length) {
        return 0.4;
    }
    if (state?.recentFiles?.length) {
        return 0.25;
    }
    return 0.1;
}
function inferPhase(state, handoff) {
    if (state?.currentTask?.trim()) {
        return 'active_development';
    }
    if (handoff?.impact_summary?.risk === 'high') {
        return 'risk_mitigation';
    }
    if (handoff?.key_changes?.length) {
        return 'change_integration';
    }
    return 'exploration';
}
function graphToCognitive(graph) {
    const now = Date.now();
    if (!graph?.nodes?.length) {
        return { version: 1, generatedAt: now, nodes: [], edges: [] };
    }
    const moduleNodes = new Set();
    for (const n of graph.nodes) {
        const mod = n.file.split('/')[0] ?? n.name;
        moduleNodes.add(mod);
    }
    const nodes = [...moduleNodes].slice(0, 24);
    const edges = [];
    for (const e of graph.edges.slice(0, 32)) {
        const fromNode = graph.nodes.find((n) => n.id === e.from);
        const toNode = graph.nodes.find((n) => n.id === e.to);
        if (!fromNode || !toNode) {
            continue;
        }
        const fromMod = fromNode.file.split('/')[0] ?? fromNode.name;
        const toMod = toNode.file.split('/')[0] ?? toNode.name;
        if (fromMod !== toMod) {
            edges.push([fromMod, toMod]);
        }
    }
    return { version: 1, generatedAt: now, nodes, edges: edges.slice(0, 24) };
}
/**
 * Project V3.1 artifacts into `.contora/cognitive/` (derived cache, safe to regenerate).
 */
async function syncCognitiveLayer(workspaceRoot, state) {
    const handoff = await (0, store_js_1.readHandoffArtifact)(workspaceRoot);
    const graph = await (0, store_js_1.readProjectGraph)(workspaceRoot);
    const userOverlay = await (0, store_js_2.readUserRequestOverlay)(workspaceRoot);
    const now = Date.now();
    const cognitiveState = {
        version: 1,
        generatedAt: now,
        phase: userOverlay?.phase_hint ?? inferPhase(state, handoff),
        progress: estimateProgress(state, handoff),
        current_focus: userOverlay?.goal ?? handoff?.current_focus ?? state?.currentTask ?? '',
        active_tasks: (handoff?.next_actions ?? []).map((a) => `${a.action}:${a.target}`).slice(0, 8),
    };
    const intent = {
        version: 1,
        generatedAt: now,
        goal: userOverlay?.goal ?? handoff?.goal ?? state?.currentTask ?? '',
        constraints: userOverlay?.constraints ?? [],
        success_metrics: [],
    };
    const risks = {
        version: 1,
        generatedAt: now,
        risks: [],
    };
    if (handoff?.impact_summary) {
        risks.risks.push({
            type: 'impact_summary',
            level: handoff.impact_summary.risk,
            description: handoff.impact_summary.details.join('; ') || 'Impact from recent changes',
        });
    }
    if (handoff?.impact_summary?.affected_modules?.length) {
        risks.risks.push({
            type: 'affected_modules',
            level: handoff.impact_summary.risk,
            description: `Modules: ${handoff.impact_summary.affected_modules.slice(0, 6).join(', ')}`,
        });
    }
    await (0, store_js_2.writeCognitiveState)(workspaceRoot, cognitiveState);
    await (0, store_js_2.writeCognitiveIntent)(workspaceRoot, intent);
    await (0, store_js_2.writeCognitiveRisk)(workspaceRoot, risks);
    const baseGraph = graphToCognitive(graph);
    if (userOverlay?.module_hints?.length) {
        const nodes = [...new Set([...baseGraph.nodes, ...userOverlay.module_hints])].slice(0, 24);
        const edges = [...baseGraph.edges];
        const anchor = userOverlay.module_hints[0];
        if (anchor) {
            for (const hint of userOverlay.module_hints.slice(1)) {
                edges.push([anchor, hint]);
            }
        }
        await (0, store_js_2.writeCognitiveGraph)(workspaceRoot, {
            ...baseGraph,
            generatedAt: now,
            nodes,
            edges: edges.slice(0, 24),
        });
    }
    else {
        await (0, store_js_2.writeCognitiveGraph)(workspaceRoot, baseGraph);
    }
    if (handoff?.current_focus) {
        await (0, init_js_1.syncIdentityFocus)(workspaceRoot, [handoff.current_focus]);
    }
}
