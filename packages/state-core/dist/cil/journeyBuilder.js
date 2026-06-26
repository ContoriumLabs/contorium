"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProjectJourney = buildProjectJourney;
const evolutionGraph_js_1 = require("../intelligence/systems/evolutionGraph.js");
const projectIdentity_js_1 = require("../intelligence/projectIdentity.js");
const eventStore_js_1 = require("./eventStore.js");
const DEFAULT_JOURNEY = [
    { version: 'V1', label: 'Workspace Memory', summary: 'Persistent focus and notes in IDE' },
    { version: 'V2', label: 'Project Snapshot', summary: 'Shared workspace state across tools' },
    { version: 'V3', label: 'AI PIL', summary: 'Structured project intelligence layer' },
    { version: 'V4', label: 'Cognitive Interaction', summary: 'Ask · History · Decisions · Impact' },
];
async function buildProjectJourney(workspaceRoot) {
    const [evolution, identity, events] = await Promise.all([
        (0, evolutionGraph_js_1.readEvolutionGraph)(workspaceRoot),
        (0, projectIdentity_js_1.readProjectIdentity)(workspaceRoot),
        (0, eventStore_js_1.readAllCognitiveEvents)(workspaceRoot),
    ]);
    let stages = DEFAULT_JOURNEY;
    if (evolution?.chains?.length) {
        stages = evolution.chains.slice(0, 6).map((chain, i) => ({
            version: `Stage ${i + 1}`,
            label: chain.topic || chain.chain_id || `Evolution ${i + 1}`,
            summary: chain.nodes?.[chain.nodes.length - 1]?.stage || 'Project evolution milestone',
        }));
    }
    const formatted = ['Project Journey', ''];
    for (let i = 0; i < stages.length; i++) {
        const s = stages[i];
        formatted.push(s.version, '', s.label, '', s.summary, '');
        if (i < stages.length - 1) {
            formatted.push('↓', '');
        }
    }
    if (identity?.runtime_version) {
        formatted.push(`Runtime: ${identity.runtime_version}`, `Events recorded: ${events.length}`, '');
    }
    return { stages, formatted };
}
