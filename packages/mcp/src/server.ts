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
import {
  readChangeArtifact,
  readHandoffArtifact,
  readImpactArtifact,
  readIntentArtifact,
  readProjectGraph,
  readProjectKnowledgeGraph,
  readKnowledgeSnapshot,
  readProjectTimeline,
  readUnderstandingGraph,
  filterMappingsByConfidence,
  getProjectHandoff,
} from './understanding.js';
import { findWorkspaceRoot, initWorkspaceFromArgv, resolveWorkspaceRoot } from './paths.js';
import { ensureWorkspaceBootstrapped, startMcpLightSync } from './mcpBootstrap.js';
import { ensureMcpDashboardAttached } from './runtimeAttach.js';
import { readMcpAutoContext } from './autoContext.js';
import {
  confirmHandoffInjection,
  prepareHandoffInjection,
  readHandoffInjectionState,
  setGitSubprocessAllowed,
  skipHandoffInjection,
  syncInjectionWithRuntime,
  getGuardReminder,
} from '@contora/state-core';
import { loadWorkspaceSnapshot } from './workspace.js';
import { readRuntimeState } from './runtimeState.js';
import { registerCognitiveTools } from './cognitive/cognitiveTools.js';
import { registerGovernanceAuxTools } from './governanceTools.js';
import { registerGovernanceV4Tools } from './governanceV4.js';
import { registerIntelligenceTools } from './intelligenceTools.js';
import { registerPilRuntimeTools } from './pilRuntime.js';
import { registerCilRuntimeTools } from './cilRuntime.js';
import { registerAiRuntimeTools } from './aiRuntime.js';
import { resolveMcpStartupConfig } from './workspaceConfig.js';

function mcpPackageVersion(): string {
  const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
  return JSON.parse(readFileSync(pkgPath, 'utf8')).version as string;
}

async function workspaceRootForTools(): Promise<string> {
  const hint = resolveWorkspaceRoot();
  return findWorkspaceRoot(hint);
}

function textResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

const MCP_SERVER_INSTRUCTIONS = `Contorium MCP — Project Intelligence for AI agents (PIL + CIL).

RULES
- Prefer the tools listed under PREFERRED. Many get_* / run_* / ensure_* names are legacy aliases.
- Contorium does NOT execute coding tasks or apply patches. Suggestions (get_next_actions, skill suggestions) are advisory only (is_executable: false).
- workspaceRoot is optional; omit unless targeting another folder.
- COST: tools marked [SLOW] may take 1–3 minutes on large repos. Prefer fast inspect_* / ask_project / transfer_project first. Call at most ONE slow governance cycle per turn unless the user explicitly asks for a full provenance derive.

WHEN TO CALL (route by user intent)
1) Natural-language question → ask_project(question)
2) New chat / continuity → get_handoff_injection_status; if pending → confirm_handoff_injection or skip_handoff_injection; else transfer_project(mode=context|handoff)
3) Export into this chat → transfer_project(mode: context | intelligence | story | essence | handoff)
4) Structured reads → inspect_state · inspect_intent · inspect_decision · inspect_why · inspect_timeline · inspect_impact · inspect_health · inspect_graph · inspect_confidence · inspect_evolution · inspect_provenance
5) Write memory → capture_focus · capture_note · capture_decision
6) Decision validity → get_knowledge_health · get_review_queue · set_decision_lifecycle_meta
7) History window → get_project_history(range) or get_recent_events(limit)
8) Module focus → get_module_history / get_blast_radius (require module)
9) Governance inject (advanced, SLOW) → inspect_cognition_ready → get_decision_context → derive_decision_provenance (once) → synthesize_context_payload. Do NOT also call run_governance_cycle / decision_snapshot / derive_decision_trace — they are aliases of the same cycle.

PREFERRED (~20)
ask_project · transfer_project · capture_focus · capture_note · capture_decision
inspect_state · inspect_intent · inspect_decision · inspect_why · inspect_health
get_knowledge_health · get_review_queue · set_decision_lifecycle_meta
get_next_actions · get_decisions · get_recent_events · get_project_history
get_handoff_injection_status · confirm_handoff_injection · skip_handoff_injection

SLOW / HIGH-COST (call sparingly; pass active_file + mode=advisory + persist=false when possible)
derive_decision_provenance · derive_decision_trace · decision_snapshot · build_decision_provenance · run_governance_cycle · trace_governance_cycle
inspect_cognition_ready · ensure_control_ready (and legacy ready aliases)

LEGACY (avoid unless caller already uses them)
get_project_* · get_cognitive_snapshot · get_full_intelligence · transfer_context · transfer_intelligence · transfer_handoff · transfer_story · transfer_runtime
run_governance_cycle · ensure_control_ready · get_intent_graph (legacy path; prefer inspect_intent)
get_ai_status · test_ai_connection (optional LLM layer status only)`;

const server = new McpServer(
  {
    name: 'contorium',
    version: mcpPackageVersion(),
  },
  { instructions: MCP_SERVER_INSTRUCTIONS },
);

const workspaceRootSchema = z.object({
  workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
});

registerCognitiveTools(server, workspaceRootForTools);
registerGovernanceAuxTools(server, workspaceRootForTools);
registerGovernanceV4Tools(server, workspaceRootForTools);
registerIntelligenceTools(server, workspaceRootForTools);
registerPilRuntimeTools(server, workspaceRootForTools);
registerCilRuntimeTools(server, workspaceRootForTools);
registerAiRuntimeTools(server, workspaceRootForTools);

server.registerTool(
  'store_memory',
  {
    description: 'Store important coding context into Contorium memory (persisted under .contora/mcp/).',
    inputSchema: z.object({
      key: z.string().min(1).describe('Unique memory key'),
      value: z.string().describe('Memory content'),
      type: z.enum(['note', 'decision', 'architecture']).optional().describe('Memory category'),
    }),
  },
  async ({ key, value, type }) => {
    const root = await workspaceRootForTools();
    const result = await storeMemory(root, key, value, type ?? 'note');
    return textResult({ ...result, workspaceRoot: root });
  },
);

server.registerTool(
  'search_memory',
  {
    description: 'Search Contorium MCP memory entries by keyword.',
    inputSchema: z.object({
      query: z.string().min(1).describe('Search text matched against keys and values'),
    }),
  },
  async ({ query }) => {
    const root = await workspaceRootForTools();
    const results = await searchMemory(root, query);
    return textResult({ workspaceRoot: root, results });
  },
);

server.registerTool(
  'get_memory',
  {
    description: 'Get a Contorium MCP memory entry by exact key.',
    inputSchema: z.object({
      key: z.string().min(1).describe('Memory key'),
    }),
  },
  async ({ key }) => {
    const root = await workspaceRootForTools();
    const entry = await getMemory(root, key);
    return textResult({ workspaceRoot: root, key, entry });
  },
);

server.registerTool(
  'get_workspace_context',
  {
    description:
      'Read Contorium workspace snapshot from .contora/state.json (current focus, notes, files, Git) written by the VS Code/Cursor extension.',
    inputSchema: z.object({
      workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
  },
  async ({ workspaceRoot: override }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    await ensureWorkspaceBootstrapped(root);
    const snapshot = await loadWorkspaceSnapshot(root);
    const injection = await readHandoffInjectionState(root);
    const confirmedContext = await readMcpAutoContext(root);
    if (!snapshot) {
      return textResult({
        workspaceRoot: root,
        found: false,
        hint: 'Workspace scan bootstrap failed — check workspace path and permissions.',
      });
    }
    return textResult({
      workspaceRoot: root,
      found: true,
      snapshot,
      handoffInjection: injection ?? undefined,
      confirmedContext: confirmedContext ?? undefined,
    });
  },
);

server.registerTool(
  'get_project_intelligence',
  {
    description:
      'Read Contorium v0.7 derived project understanding from .contora/intelligence/state-summary.json (written by the extension cognition layer).',
    inputSchema: z.object({
      workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
  },
  async ({ workspaceRoot: override }) => {
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
  },
);

server.registerTool(
  'get_intent_graph',
  {
    description:
      '[Legacy · prefer inspect_intent] Old intent graph at .contora/intent-graph/graph.json (not vNext). Use inspect_intent for .contora/intent/intent_graph.json.',
    inputSchema: z.object({
      workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
  },
  async ({ workspaceRoot: override }) => {
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
  },
);

server.registerTool(
  'get_active_intents',
  {
    description:
      'Return ACTIVE / WEAKENING / PARTIAL intent nodes from the Contorium intent graph (compact summary for agents).',
    inputSchema: z.object({
      workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
      max: z.number().int().min(1).max(24).optional().describe('Max intent nodes (default 8)'),
    }),
  },
  async ({ workspaceRoot: override, max }) => {
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
  },
);

server.registerTool(
  'get_project_state',
  {
    description:
      'Read Contorium State Builder structured project state from .contora/state-builder/project-state.json (goal, stage, decisions, problems, next actions).',
    inputSchema: z.object({
      workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
  },
  async ({ workspaceRoot: override }) => {
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
  },
);

server.registerTool(
  'get_project_snapshot',
  {
    description:
      'Read Contorium PROJECT SNAPSHOT markdown from .contora/state-builder/project-snapshot.md for cross-AI project continuity.',
    inputSchema: z.object({
      workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
      format: z.enum(['markdown', 'json']).optional().describe('Return markdown (default) or structured JSON state'),
    }),
  },
  async ({ workspaceRoot: override, format }) => {
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
  },
);

server.registerTool(
  'get_state_conflicts',
  {
    description:
      'Read Contorium v2 unresolved state conflicts from .contora/state-engine/conflicts.json (audit only — system does not auto-resolve).',
    inputSchema: z.object({
      workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
  },
  async ({ workspaceRoot: override }) => {
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
  },
);

server.registerTool(
  'get_project_change',
  {
    description:
      'Read Contorium V3.1 change semantics from .contora/change.json (changed files + key symbol changes).',
    inputSchema: z.object({
      workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
  },
  async ({ workspaceRoot: override }) => {
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
  },
);

server.registerTool(
  'get_project_graph',
  {
    description:
      'Read Contorium V3 change-neighborhood project graph from .contora/graph.json (functions, classes, imports around recent changes).',
    inputSchema: z.object({
      workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
  },
  async ({ workspaceRoot: override }) => {
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
  },
);

server.registerTool(
  'get_project_knowledge_graph',
  {
    description:
      'Read Contorium V3.1 Project Knowledge Graph from .contora/graph/knowledge.json (Intent → Module → File → Function + intent mappings).',
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
  },
  async ({ workspaceRoot: override, minConfidence, includeInference }) => {
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
  },
);

server.registerTool(
  'get_project_graph_snapshot',
  {
    description:
      'Read Contorium V3.1 cognitive snapshot from .contora/graph/snapshot.json — compact summary for AI Handoff (top intents, hotspots, functions).',
    inputSchema: z.object({
      workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
  },
  async ({ workspaceRoot: override }) => {
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
  },
);

server.registerTool(
  'get_project_impact',
  {
    description:
      '[Deprecated V3.1] Impact merged into handoff.json — returns impact_summary from handoff or legacy impact.json.',
    inputSchema: z.object({
      workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
  },
  async ({ workspaceRoot: override }) => {
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
  },
);

server.registerTool(
  'get_project_intent',
  {
    description:
      '[Legacy · prefer inspect_intent] Compact intent summary artifact. Prefer inspect_intent (vNext graph) or ask_project for NL.',
    inputSchema: z.object({
      workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
  },
  async ({ workspaceRoot: override }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    const intent = await readIntentArtifact(root);
    if (!intent) {
      return textResult({
        workspaceRoot: root,
        found: false,
        hint: 'Intent not available — use inspect_intent or get_project_handoff.',
      });
    }
    return textResult({
      workspaceRoot: root,
      found: true,
      intent,
      deprecated: true,
      prefer: 'inspect_intent',
    });
  },
);

server.registerTool(
  'get_handoff_injection_status',
  {
    description:
      '[Prefer · New chat] Call at the start of a new session: check if runtime handoff injection is pending. If pending=true, ask the user then call confirm_handoff_injection (Y) or skip_handoff_injection (N). Else use transfer_project(mode=context) if continuity is needed.',
    inputSchema: workspaceRootSchema,
  },
  async ({ workspaceRoot: override }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    await syncInjectionWithRuntime(root);
    const prep = await prepareHandoffInjection(root);
    const state = await readHandoffInjectionState(root);
    const confirmedContext = await readMcpAutoContext(root);
    return textResult({
      workspaceRoot: root,
      pending: prep.shouldPrompt,
      alreadyInjected: prep.alreadyInjected,
      prompt: prep.prompt,
      compact: prep.compact,
      state,
      confirmedContext: confirmedContext ? true : false,
      next: prep.shouldPrompt
        ? 'Ask the user, then call confirm_handoff_injection (Y) or skip_handoff_injection (N).'
        : prep.alreadyInjected
          ? 'Context already injected for this runtime — read .contora/mcp.auto-context.md or get_project_handoff.'
          : 'No active runtime or user skipped injection.',
    });
  },
);

server.registerTool(
  'confirm_handoff_injection',
  {
    description:
      '[Write · New chat] After user confirms (Y): write .contora/mcp.auto-context.md and mark injection done. Optional format: json | markdown | compact (default markdown). Side effect: persists context file.',
    inputSchema: z.object({
      workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
      format: z
        .enum(['json', 'markdown', 'compact'])
        .optional()
        .describe('Handoff format written to mcp.auto-context.md (default markdown)'),
    }),
  },
  async ({ workspaceRoot: override, format }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    const result = await confirmHandoffInjection(root, format ?? 'markdown');
    if (!result.ok) {
      return textResult({ workspaceRoot: root, ok: false, hint: result.hint });
    }
    return textResult({
      workspaceRoot: root,
      ok: true,
      filePath: result.filePath,
      contextFile: `.contora/mcp.auto-context.md`,
      hint: 'Injected — AI can read the context file or call get_project_handoff.',
      preview: result.text?.slice(0, 400),
    });
  },
);

server.registerTool(
  'skip_handoff_injection',
  {
    description:
      '[Write · New chat] User declined injection (N). Marks skip for this runtime session; get_project_handoff / transfer_project remain available on demand.',
    inputSchema: workspaceRootSchema,
  },
  async ({ workspaceRoot: override }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    const result = await skipHandoffInjection(root);
    return textResult({
      workspaceRoot: root,
      ok: result.ok,
      hint: 'Skipped — start chat without injected context; get_project_handoff remains available.',
    });
  },
);

server.registerTool(
  'get_project_handoff',
  {
    description:
      'CHP v1 get_handoff — read unified AI handoff from Contorium Runtime (.contora/handoff.json + state). For new chats prefer get_handoff_injection_status → user confirm → confirm_handoff_injection.',
    inputSchema: z.object({
      workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
      format: z
        .enum(['json', 'markdown', 'compact'])
        .optional()
        .describe('Output format: compact (default), markdown (AI chat), json (systems)'),
      filter: z.string().optional().describe('Optional symbol/file filter'),
    }),
  },
  async ({ workspaceRoot: override, format, filter }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    const handoff = await readHandoffArtifact(root);
    const result = await getProjectHandoff(root, format ?? 'compact', filter);
    if (!result.found) {
      return textResult({
        workspaceRoot: root,
        found: false,
        hint: 'Handoff artifact not generated yet — save code changes or run contorium sync.',
      });
    }
    const guardReminder =
      process.env.CONTORIUM_GUARD_REMIND === '1' ? await getGuardReminder(root) : undefined;
    const payload = {
      workspaceRoot: root,
      found: true as const,
      ...(guardReminder ? { governance_reminder: guardReminder } : {}),
    };
    if (format === 'markdown' || format === 'compact') {
      return textResult({
        ...payload,
        format,
        text: result.text,
        state: result.state,
      });
    }
    if (format === 'json') {
      return textResult({ ...payload, chp: result.state });
    }
    return textResult({
      ...payload,
      handoff,
      chp: result.state,
      compact: result.text,
    });
  },
);

server.registerTool(
  'get_project_timeline',
  {
    description:
      'Read Contorium V3.1 code evolution timeline from .contora/timeline.json (recent commits + symbol changes).',
    inputSchema: z.object({
      workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
    }),
  },
  async ({ workspaceRoot: override }) => {
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
  },
);

// ── MCP v1 standard tools (aliases + runtime graph) ──────────────────────────

server.registerTool(
  'get_recent_changes',
  {
    description:
      '[MCP v1 standard] Recent file/function changes from .contora/change.json — alias of get_project_change.',
    inputSchema: workspaceRootSchema,
  },
  async ({ workspaceRoot: override }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    const change = await readChangeArtifact(root);
    if (!change) {
      return textResult({
        workspaceRoot: root,
        found: false,
        hint: 'No recent changes — save code or run: contorium sync',
      });
    }
    return textResult({ workspaceRoot: root, found: true, recent_changes: change });
  },
);

server.registerTool(
  'get_understanding_graph',
  {
    description:
      '[MCP v1 standard] Runtime understanding graph — call chains + impact from .contora/understanding_graph.json.',
    inputSchema: workspaceRootSchema,
  },
  async ({ workspaceRoot: override }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    const graph = await readUnderstandingGraph(root);
    if (!graph) {
      return textResult({
        workspaceRoot: root,
        found: false,
        hint: 'Understanding graph pending — save code changes or run contorium sync.',
        fallback: 'Try get_project_graph for change-neighborhood graph.json',
      });
    }
    return textResult({ workspaceRoot: root, found: true, understanding_graph: graph });
  },
);

server.registerTool(
  'get_runtime_state',
  {
    description:
      '[MCP v1 standard] Runtime session view — bootstrap, dashboard worker, session marker (read-only).',
    inputSchema: workspaceRootSchema,
  },
  async ({ workspaceRoot: override }) => {
    const root = override ? path.resolve(override) : await workspaceRootForTools();
    const runtime = await readRuntimeState(root);
    return textResult({ workspaceRoot: root, found: true, runtime });
  },
);

/** Standard MCP server startup — used by bin/contorium-mcp.js and direct server.js entry. */
export async function startMcpServer(argv: string[] = process.argv.slice(2)): Promise<void> {
  const startup = resolveMcpStartupConfig(argv);
  initWorkspaceFromArgv(argv);
  console.error(`[contorium-mcp] workspace: ${startup.workspaceHint}`);

  setGitSubprocessAllowed(false);

  try {
    const root = await workspaceRootForTools();
    const boot = await ensureWorkspaceBootstrapped(root);
    startMcpLightSync(root);
    void ensureMcpDashboardAttached(root);
    console.error(`[contorium-mcp] runtime bootstrap scheduled (mode: ${boot.mode})`);
    setTimeout(() => {
      void (async () => {
        await syncInjectionWithRuntime(root);
        const prep = await prepareHandoffInjection(root, { newChat: true });
        if (prep.shouldPrompt && prep.prompt) {
          console.error('[contorium-mcp:handoff] ── New chat · semi-auto injection ──');
          for (const line of prep.prompt.split('\n')) {
            console.error(`[contorium-mcp:handoff] ${line}`);
          }
        } else if (prep.alreadyInjected) {
          console.error('[contorium-mcp:handoff] Context already confirmed for this chat.');
        }
      })();
    }, 1200);
  } catch (err) {
    console.error('[contorium-mcp] bootstrap skipped:', err instanceof Error ? err.message : err);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[contorium-mcp] ready on stdio');
}

function isDirectServerEntry(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  const base = path.basename(entry);
  return base === 'server.js' || base === 'server.ts';
}

if (isDirectServerEntry()) {
  startMcpServer().catch((err) => {
    console.error('[contorium-mcp] fatal:', err);
    process.exit(1);
  });
}
