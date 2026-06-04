#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { getMemory, searchMemory, storeMemory } from './memoryStore.js';
import { loadProjectIntelligence } from './intelligence.js';
import { activeIntentNodes, loadIntentGraph } from './intentGraph.js';
import { loadStateConflicts } from './conflicts.js';
import { loadProjectBuiltState, loadProjectSnapshotMarkdown } from './stateBuilder.js';
import { readChangeArtifact, readHandoffArtifact, readImpactArtifact, readIntentArtifact, readProjectGraph, readProjectKnowledgeGraph, readKnowledgeSnapshot, readProjectTimeline, filterMappingsByConfidence, } from './understanding.js';
import { findWorkspaceRoot, resolveWorkspaceRoot } from './paths.js';
import { ensureWorkspaceBootstrapped, startMcpLightSync } from './mcpBootstrap.js';
import { loadWorkspaceSnapshot } from './workspace.js';
function mcpPackageVersion() {
    const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    return JSON.parse(readFileSync(pkgPath, 'utf8')).version;
}
async function workspaceRootForTools() {
    const hint = resolveWorkspaceRoot();
    return findWorkspaceRoot(hint);
}
function textResult(data) {
    return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    };
}
const server = new McpServer({
    name: 'contorium',
    version: mcpPackageVersion(),
});
server.registerTool('store_memory', {
    description: 'Store important coding context into Contorium memory (persisted under .contora/mcp/).',
    inputSchema: z.object({
        key: z.string().min(1).describe('Unique memory key'),
        value: z.string().describe('Memory content'),
        type: z.enum(['note', 'decision', 'architecture']).optional().describe('Memory category'),
    }),
}, async ({ key, value, type }) => {
    const root = await workspaceRootForTools();
    const result = await storeMemory(root, key, value, type ?? 'note');
    return textResult({ ...result, workspaceRoot: root });
});
server.registerTool('search_memory', {
    description: 'Search Contorium MCP memory entries by keyword.',
    inputSchema: z.object({
        query: z.string().min(1).describe('Search text matched against keys and values'),
    }),
}, async ({ query }) => {
    const root = await workspaceRootForTools();
    const results = await searchMemory(root, query);
    return textResult({ workspaceRoot: root, results });
});
server.registerTool('get_memory', {
    description: 'Get a Contorium MCP memory entry by exact key.',
    inputSchema: z.object({
        key: z.string().min(1).describe('Memory key'),
    }),
}, async ({ key }) => {
    const root = await workspaceRootForTools();
    const entry = await getMemory(root, key);
    return textResult({ workspaceRoot: root, key, entry });
});
server.registerTool('get_workspace_context', {
    description: 'Read Contorium workspace snapshot from .contora/state.json (current focus, notes, files, Git) written by the VS Code/Cursor extension.',
    inputSchema: z.object({
        workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
}, async ({ workspaceRoot: override }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    await ensureWorkspaceBootstrapped(root);
    const snapshot = await loadWorkspaceSnapshot(root);
    if (!snapshot) {
        return textResult({
            workspaceRoot: root,
            found: false,
            hint: 'Workspace scan bootstrap failed — check workspace path and permissions.',
        });
    }
    return textResult({ workspaceRoot: root, found: true, snapshot });
});
server.registerTool('get_project_intelligence', {
    description: 'Read Contorium v0.7 derived project understanding from .contora/intelligence/state-summary.json (written by the extension cognition layer).',
    inputSchema: z.object({
        workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
}, async ({ workspaceRoot: override }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    const intelligence = await loadProjectIntelligence(root);
    if (!intelligence) {
        return textResult({
            workspaceRoot: root,
            found: false,
            hint: 'Open the workspace with Contorium extension active to generate state-summary.json.',
        });
    }
    return textResult({ workspaceRoot: root, found: true, intelligence });
});
server.registerTool('get_intent_graph', {
    description: 'Read the full Contorium intent graph from .contora/intent-graph/graph.json (multi-intent cognition layer).',
    inputSchema: z.object({
        workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
}, async ({ workspaceRoot: override }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    const graph = await loadIntentGraph(root);
    if (!graph) {
        return textResult({
            workspaceRoot: root,
            found: false,
            hint: 'Intent graph not generated yet — use Contorium extension in this workspace.',
        });
    }
    return textResult({ workspaceRoot: root, found: true, graph });
});
server.registerTool('get_active_intents', {
    description: 'Return ACTIVE / WEAKENING / PARTIAL intent nodes from the Contorium intent graph (compact summary for agents).',
    inputSchema: z.object({
        workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
        max: z.number().int().min(1).max(24).optional().describe('Max intent nodes (default 8)'),
    }),
}, async ({ workspaceRoot: override, max }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    const graph = await loadIntentGraph(root);
    if (!graph) {
        return textResult({
            workspaceRoot: root,
            found: false,
            intents: [],
            hint: 'Intent graph not generated yet.',
        });
    }
    const intents = activeIntentNodes(graph, max ?? 8);
    return textResult({ workspaceRoot: root, found: true, intents, graphUpdatedAt: graph.updatedAt });
});
server.registerTool('get_project_state', {
    description: 'Read Contorium State Builder structured project state from .contora/state-builder/project-state.json (goal, stage, decisions, problems, next actions).',
    inputSchema: z.object({
        workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
}, async ({ workspaceRoot: override }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    const projectState = await loadProjectBuiltState(root);
    if (!projectState) {
        return textResult({
            workspaceRoot: root,
            found: false,
            hint: 'State Builder not generated yet — use Contorium extension in this workspace.',
        });
    }
    return textResult({ workspaceRoot: root, found: true, projectState });
});
server.registerTool('get_project_snapshot', {
    description: 'Read Contorium PROJECT SNAPSHOT markdown from .contora/state-builder/project-snapshot.md for cross-AI project continuity.',
    inputSchema: z.object({
        workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
        format: z.enum(['markdown', 'json']).optional().describe('Return markdown (default) or structured JSON state'),
    }),
}, async ({ workspaceRoot: override, format }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    const projectState = await loadProjectBuiltState(root);
    const markdown = await loadProjectSnapshotMarkdown(root);
    if (!projectState && !markdown) {
        return textResult({
            workspaceRoot: root,
            found: false,
            hint: 'Project snapshot not generated yet.',
        });
    }
    if (format === 'json') {
        return textResult({ workspaceRoot: root, found: true, projectState });
    }
    return textResult({
        workspaceRoot: root,
        found: true,
        markdown: markdown ?? '',
        projectState,
    });
});
server.registerTool('get_state_conflicts', {
    description: 'Read Contorium v2 unresolved state conflicts from .contora/state-engine/conflicts.json (audit only — system does not auto-resolve).',
    inputSchema: z.object({
        workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
}, async ({ workspaceRoot: override }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    const artifact = await loadStateConflicts(root);
    if (!artifact || !artifact.conflicts.length) {
        return textResult({
            workspaceRoot: root,
            found: false,
            conflicts: [],
            hint: 'No unresolved conflicts — or cognition pipeline has not run yet.',
        });
    }
    return textResult({
        workspaceRoot: root,
        found: true,
        count: artifact.conflicts.length,
        generatedAt: artifact.generatedAt,
        conflicts: artifact.conflicts,
    });
});
server.registerTool('get_project_change', {
    description: 'Read Contorium V3.1 change semantics from .contora/change.json (changed files + key symbol changes).',
    inputSchema: z.object({
        workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
}, async ({ workspaceRoot: override }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    const change = await readChangeArtifact(root);
    if (!change) {
        return textResult({
            workspaceRoot: root,
            found: false,
            hint: 'Change artifact not generated yet — save code changes or run Contorium sync.',
        });
    }
    return textResult({ workspaceRoot: root, found: true, change });
});
server.registerTool('get_project_graph', {
    description: 'Read Contorium V3 change-neighborhood project graph from .contora/graph.json (functions, classes, imports around recent changes).',
    inputSchema: z.object({
        workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
}, async ({ workspaceRoot: override }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    const graph = await readProjectGraph(root);
    if (!graph) {
        return textResult({
            workspaceRoot: root,
            found: false,
            hint: 'Project graph not generated yet — save code changes or run Contorium sync.',
        });
    }
    return textResult({ workspaceRoot: root, found: true, graph });
});
server.registerTool('get_project_knowledge_graph', {
    description: 'Read Contorium V3.1 Project Knowledge Graph from .contora/graph/knowledge.json (Intent → Module → File → Function + intent mappings).',
    inputSchema: z.object({
        workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
        minConfidence: z
            .number()
            .min(0)
            .max(1)
            .optional()
            .describe('Optional filter — omit intent mappings below this confidence (default: 0.7 canonical threshold)'),
        includeInference: z
            .boolean()
            .optional()
            .describe('Include Cortex-only inferenceMappings (confidence < 0.7). Default false.'),
    }),
}, async ({ workspaceRoot: override, minConfidence, includeInference }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    const knowledge = await readProjectKnowledgeGraph(root);
    if (!knowledge) {
        return textResult({
            workspaceRoot: root,
            found: false,
            hint: 'Knowledge graph not generated yet — save code changes or run Contorium sync.',
        });
    }
    const threshold = minConfidence ?? 0.7;
    const { inferenceMappings, ...canonical } = knowledge;
    const payload = {
        ...canonical,
        intentMappings: filterMappingsByConfidence(knowledge.intentMappings, threshold),
        ...(includeInference ? { inferenceMappings } : {}),
    };
    return textResult({ workspaceRoot: root, found: true, knowledge: payload });
});
server.registerTool('get_project_graph_snapshot', {
    description: 'Read Contorium V3.1 cognitive snapshot from .contora/graph/snapshot.json — compact summary for AI Handoff (top intents, hotspots, functions).',
    inputSchema: z.object({
        workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
}, async ({ workspaceRoot: override }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    const snapshot = await readKnowledgeSnapshot(root);
    if (!snapshot) {
        return textResult({
            workspaceRoot: root,
            found: false,
            hint: 'Graph snapshot not generated yet — save code changes or run Contorium sync.',
        });
    }
    return textResult({ workspaceRoot: root, found: true, snapshot });
});
server.registerTool('get_project_impact', {
    description: '[Deprecated V3.1] Impact merged into handoff.json — returns impact_summary from handoff or legacy impact.json.',
    inputSchema: z.object({
        workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
}, async ({ workspaceRoot: override }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    const impact = await readImpactArtifact(root);
    if (!impact) {
        return textResult({
            workspaceRoot: root,
            found: false,
            hint: 'Impact not available — run cognition sync or use get_project_handoff.',
        });
    }
    return textResult({
        workspaceRoot: root,
        found: true,
        impact,
        deprecated: true,
        prefer: 'get_project_handoff',
    });
});
server.registerTool('get_project_intent', {
    description: '[Deprecated V3.1] Intent merged into handoff.json — returns current_focus from handoff or legacy intent.json.',
    inputSchema: z.object({
        workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
}, async ({ workspaceRoot: override }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    const intent = await readIntentArtifact(root);
    if (!intent) {
        return textResult({
            workspaceRoot: root,
            found: false,
            hint: 'Intent not available — use get_project_handoff.',
        });
    }
    return textResult({
        workspaceRoot: root,
        found: true,
        intent,
        deprecated: true,
        prefer: 'get_project_handoff',
    });
});
server.registerTool('get_project_handoff', {
    description: 'Read Contorium V3.1 AI handoff — sole recommended entry (.contora/handoff.json: goal, focus, changes, impact, next actions).',
    inputSchema: z.object({
        workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
}, async ({ workspaceRoot: override }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    const handoff = await readHandoffArtifact(root);
    if (!handoff) {
        return textResult({
            workspaceRoot: root,
            found: false,
            hint: 'Handoff artifact not generated yet.',
        });
    }
    return textResult({ workspaceRoot: root, found: true, handoff });
});
server.registerTool('get_project_timeline', {
    description: 'Read Contorium V3.1 code evolution timeline from .contora/timeline.json (recent commits + symbol changes).',
    inputSchema: z.object({
        workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
}, async ({ workspaceRoot: override }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    const timeline = await readProjectTimeline(root);
    if (!timeline) {
        return textResult({
            workspaceRoot: root,
            found: false,
            hint: 'Timeline not generated yet — requires git history and recent code changes.',
        });
    }
    return textResult({ workspaceRoot: root, found: true, timeline });
});
async function main() {
    try {
        const root = await workspaceRootForTools();
        const boot = await ensureWorkspaceBootstrapped(root);
        startMcpLightSync(root);
        console.error(`[contorium-mcp] workspace ${root} (mode: ${boot.mode})`);
    }
    catch (err) {
        console.error('[contorium-mcp] bootstrap skipped:', err instanceof Error ? err.message : err);
    }
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[contorium-mcp] ready on stdio');
}
main().catch((err) => {
    console.error('[contorium-mcp] fatal:', err);
    process.exit(1);
});
