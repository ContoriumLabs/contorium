import * as fs from 'node:fs/promises';
import * as path from 'node:path';
const CONTORA_DATA_DIR = '.contora';
const INTELLIGENCE_DIR = 'intelligence';
const INTENT_GRAPH_DIR = 'intent-graph';
async function readJsonFile(fp) {
    try {
        const text = await fs.readFile(fp, 'utf8');
        return JSON.parse(text);
    }
    catch {
        return undefined;
    }
}
export async function loadProjectIntelligence(workspaceRoot) {
    const fp = path.join(workspaceRoot, CONTORA_DATA_DIR, INTELLIGENCE_DIR, 'state-summary.json');
    const summary = await readJsonFile(fp);
    return { found: !!summary, summary, path: fp };
}
export async function loadIntentGraph(workspaceRoot) {
    const fp = path.join(workspaceRoot, CONTORA_DATA_DIR, INTENT_GRAPH_DIR, 'graph.json');
    const graph = await readJsonFile(fp);
    return { found: !!graph, graph, path: fp };
}
export function filterActiveIntentNodes(graph) {
    return graph.nodes
        .filter((n) => (n.status === 'ACTIVE' || n.status === 'WEAKENING') &&
        n.confidence >= 0.5 &&
        n.text.trim().length > 0)
        .sort((a, b) => b.confidence - a.confidence);
}
