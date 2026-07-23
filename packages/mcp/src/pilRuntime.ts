import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  readStateJson,
  readWorkspaceStatus,
  readProjectBuiltState,
  readIntentGraphVNext,
  readGovernanceDecision,
  readDecisionProvenanceGraph,
  readProjectEvolutionTimeline,
  readProjectGraph,
  readConfidenceIndex,
  queryConfidenceIndex,
  readWhyLayer,
  readProjectIntelligenceHealth,
  deriveProjectIntelligenceHealth,
  readDecisionLog,
  loadTransferExportInput,
  buildTransferContextSnapshot,
  buildFullIntelligenceMarkdown,
  formatTransferContextMarkdown,
  toTransferContextPayload,
  estimateGovernanceTokens,
  getProjectHandoff,
  captureProjectFocus,
  captureProjectNote,
  captureProjectDecision,
  retrieveImpact,
  retrieveEvolution,
  retrieveProvenance,
} from '@contora/state-core';

function textResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

const workspaceRootSchema = z.object({
  workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
});

const transferFormatSchema = workspaceRootSchema.extend({
  format: z
    .enum(['json', 'markdown'])
    .optional()
    .describe('Output format; default json with markdown companion'),
});

/**
 * Contorium v3.0 — PIL Runtime Contract for MCP.
 * Three capability groups: Capture · Inspect · Transfer
 * Legacy get_project_* / get_cognitive_snapshot tools remain as aliases.
 */
export function registerPilRuntimeTools(
  server: McpServer,
  resolveRoot: () => Promise<string>,
): void {
  // ── Inspect ──────────────────────────────────────────────────────────────

  server.registerTool(
    'inspect_state',
    {
      description:
        '[PIL · Inspect] Workspace state — state.json, status, built project state. Call first when grounding on current focus/stage. Prefer ask_project for NL questions.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ? override : await resolveRoot();
      const [state, status, built] = await Promise.all([
        readStateJson(root),
        readWorkspaceStatus(root),
        readProjectBuiltState(root),
      ]);
      return textResult({
        workspaceRoot: root,
        found: !!(state || built),
        state,
        status,
        built_state: built,
      });
    },
  );

  server.registerTool(
    'inspect_intent',
    {
      description:
        '[PIL · Inspect · Prefer] vNext intent graph (.contora/intent/intent_graph.json). Prefer over legacy get_intent_graph / get_project_intent_graph.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ? override : await resolveRoot();
      const graph = await readIntentGraphVNext(root);
      return textResult({ workspaceRoot: root, found: !!graph?.nodes?.length, intent_graph: graph });
    },
  );

  server.registerTool(
    'inspect_decision',
    {
      description:
        '[PIL · Inspect · Prefer] Decision provenance + governance decision + decision log. Prefer over get_decision_graph / get_project_decision for a full decision picture.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ? override : await resolveRoot();
      const [decision, graph, log] = await Promise.all([
        readGovernanceDecision(root),
        readDecisionProvenanceGraph(root),
        readDecisionLog(root),
      ]);
      return textResult({
        workspaceRoot: root,
        found: !!(decision || graph?.nodes?.length || log?.entries?.length),
        decision,
        decision_graph: graph,
        decision_log: log,
      });
    },
  );

  server.registerTool(
    'inspect_timeline',
    {
      description: '[PIL · Inspect] Project evolution timeline (TIMELINE dimension).',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ? override : await resolveRoot();
      const timeline = await readProjectEvolutionTimeline(root);
      return textResult({
        workspaceRoot: root,
        found: !!(timeline?.events?.length),
        timeline,
      });
    },
  );

  server.registerTool(
    'inspect_graph',
    {
      description: '[PIL · Inspect] Change-neighborhood graph (.contora/graph.json).',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ? override : await resolveRoot();
      const graph = await readProjectGraph(root);
      return textResult({ workspaceRoot: root, found: !!graph, graph });
    },
  );

  server.registerTool(
    'inspect_confidence',
    {
      description: '[PIL · Inspect] Confidence index (CONFIDENCE dimension).',
      inputSchema: workspaceRootSchema.extend({
        entity_id: z.string().optional().describe('Filter by entity id'),
      }),
    },
    async ({ workspaceRoot: override, entity_id }) => {
      const root = override ? override : await resolveRoot();
      const index = await readConfidenceIndex(root);
      const entities = index ? queryConfidenceIndex(index, entity_id) : [];
      return textResult({
        workspaceRoot: root,
        found: entities.length > 0,
        schema: index?.schema,
        updated_at: index?.updated_at,
        entities,
      });
    },
  );

  server.registerTool(
    'inspect_health',
    {
      description: '[PIL · Inspect] Project intelligence health metrics.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ? override : await resolveRoot();
      let health = await readProjectIntelligenceHealth(root);
      if (!health) {
        health = await deriveProjectIntelligenceHealth(root).catch(() => null);
      }
      return textResult({ workspaceRoot: root, found: !!health, health });
    },
  );

  server.registerTool(
    'inspect_why',
    {
      description: '[PIL · Inspect] Why layer — feature rationale records.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ? override : await resolveRoot();
      const why = await readWhyLayer(root);
      return textResult({ workspaceRoot: root, found: !!why?.features?.length, why });
    },
  );

  const anchorSchema = workspaceRootSchema.extend({
    anchor: z.string().optional().describe('Filter by entity, topic, or module anchor'),
  });

  server.registerTool(
    'inspect_impact',
    {
      description: '[PIL · Inspect] Impact graph (IMPACT dimension).',
      inputSchema: anchorSchema.extend({
        entity_id: z.string().optional().describe('Alias for anchor — source entity id'),
      }),
    },
    async ({ workspaceRoot: override, anchor, entity_id }) => {
      const root = override ? override : await resolveRoot();
      const { graph, entries } = await retrieveImpact(root, entity_id ?? anchor);
      return textResult({
        workspaceRoot: root,
        found: entries.length > 0,
        schema: graph?.schema,
        updated_at: graph?.updated_at,
        entries,
      });
    },
  );

  server.registerTool(
    'inspect_evolution',
    {
      description: '[PIL · Inspect] Evolution graph — structured transformation chains (EVOLUTION system).',
      inputSchema: anchorSchema,
    },
    async ({ workspaceRoot: override, anchor }) => {
      const root = override ? override : await resolveRoot();
      const { graph, chains } = await retrieveEvolution(root, anchor);
      return textResult({
        workspaceRoot: root,
        found: chains.length > 0,
        schema: graph?.schema,
        updated_at: graph?.updated_at,
        chains,
      });
    },
  );

  server.registerTool(
    'inspect_provenance',
    {
      description: '[PIL · Inspect] Provenance chain — WHY → DECISION → INTENT trace-back (PROVENANCE system).',
      inputSchema: anchorSchema,
    },
    async ({ workspaceRoot: override, anchor }) => {
      const root = override ? override : await resolveRoot();
      const { chain, entries } = await retrieveProvenance(root, anchor);
      return textResult({
        workspaceRoot: root,
        found: entries.length > 0,
        schema: chain?.schema,
        updated_at: chain?.updated_at,
        entries,
      });
    },
  );

  // ── Transfer ─────────────────────────────────────────────────────────────

  server.registerTool(
    'transfer_context',
    {
      description:
        '[Legacy alias · prefer transfer_project mode=context] Intelligence Transfer Context (~300–800 tokens).',
      inputSchema: transferFormatSchema,
    },
    async ({ workspaceRoot: override, format }) => {
      const root = override ? override : await resolveRoot();
      const input = await loadTransferExportInput(root);
      const snapshot = await buildTransferContextSnapshot(input);
      const payload = toTransferContextPayload(snapshot);
      const markdown = formatTransferContextMarkdown(snapshot);
      const tokens = estimateGovernanceTokens(markdown);
      if (format === 'markdown') {
        return { content: [{ type: 'text' as const, text: markdown }] };
      }
      return textResult({
        workspaceRoot: root,
        mode: 'Transfer Context',
        tokens,
        snapshot: payload,
        markdown,
      });
    },
  );

  server.registerTool(
    'transfer_intelligence',
    {
      description:
        '[Legacy alias · prefer transfer_project mode=intelligence] Full Intelligence Transfer (~8000 tokens).',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ? override : await resolveRoot();
      const input = await loadTransferExportInput(root);
      const markdown = await buildFullIntelligenceMarkdown(input);
      const tokens = estimateGovernanceTokens(markdown);
      return textResult({
        workspaceRoot: root,
        mode: 'Transfer Intelligence',
        tokens,
        markdown,
      });
    },
  );

  const transferHandoffHandler = async ({ workspaceRoot: override }: { workspaceRoot?: string }) => {
    const root = override ? override : await resolveRoot();
    const handoff = await getProjectHandoff(root, 'compact');
    const tokens = handoff.text ? estimateGovernanceTokens(handoff.text) : 0;
    return textResult({
      workspaceRoot: root,
      mode: 'Transfer Handoff',
      found: handoff.found,
      tokens,
      text: handoff.text,
    });
  };

  server.registerTool(
    'transfer_handoff',
    {
      description:
        '[Legacy alias · prefer transfer_project mode=handoff] Compact handoff (~100–300 tokens) for new-chat continuity.',
      inputSchema: workspaceRootSchema,
    },
    transferHandoffHandler,
  );

  server.registerTool(
    'transfer_runtime',
    {
      description: '[Legacy alias · prefer transfer_handoff] Same as transfer_handoff.',
      inputSchema: workspaceRootSchema,
    },
    transferHandoffHandler,
  );

  // ── Capture ──────────────────────────────────────────────────────────────

  server.registerTool(
    'capture_focus',
    {
      description:
        '[PIL · Capture · Write] Set current project focus (state.json currentTask). Side effect: persists focus.',
      inputSchema: workspaceRootSchema.extend({
        focus: z.string().min(1).describe('Current project focus (one line)'),
      }),
    },
    async ({ workspaceRoot: override, focus }) => {
      const root = override ? override : await resolveRoot();
      const result = await captureProjectFocus(root, focus, 'mcp');
      return textResult(result);
    },
  );

  server.registerTool(
    'capture_note',
    {
      description:
        '[PIL · Capture · Write] Append a timestamped note to state.json. Side effect: persists note.',
      inputSchema: workspaceRootSchema.extend({
        text: z.string().min(1).describe('Note text'),
      }),
    },
    async ({ workspaceRoot: override, text }) => {
      const root = override ? override : await resolveRoot();
      const result = await captureProjectNote(root, text, 'mcp');
      return textResult(result);
    },
  );

  server.registerTool(
    'capture_decision',
    {
      description:
        '[PIL · Capture · Write] Record a decision (append-only log). Side effect: persists decision. Requires selected; optional reason / intent_id / decision_id.',
      inputSchema: workspaceRootSchema.extend({
        selected: z.string().min(1).describe('Selected decision / alternative'),
        reason: z.string().optional().describe('Why this was chosen'),
        intent_id: z.string().optional().describe('Linked intent id'),
        decision_id: z.string().optional().describe('Optional stable decision id'),
      }),
    },
    async ({ workspaceRoot: override, selected, reason, intent_id, decision_id }) => {
      const root = override ? override : await resolveRoot();
      const result = await captureProjectDecision(root, { selected, reason, intent_id, decision_id });
      return textResult(result);
    },
  );
}
