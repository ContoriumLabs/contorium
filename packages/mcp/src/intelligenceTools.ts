import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  readDecisionProvenanceGraph,
  readGovernanceDecision,
  readImpactGraph,
  readIntentGraphVNext,
  readProjectEvolutionTimeline,
  readProjectIdentity,
  readConfidenceIndex,
  readProvenanceChain,
  readEvolutionGraph,
  readWhyLayer,
  queryImpactGraph,
  queryProjectEvolutionTimeline,
  queryConfidenceIndex,
  queryProvenanceChain,
  queryEvolutionGraph,
  readProjectIntelligenceHealth,
  deriveProjectIntelligenceHealth,
  readDecisionLog,
  loadTransferExportInput,
  buildTransferContextSnapshot,
  buildFullIntelligenceMarkdown,
  formatTransferContextMarkdown,
  toTransferContextPayload,
  estimateGovernanceTokens,
  /** @deprecated legacy alias */
  readStabilityIndex,
  queryStabilityIndex,
} from '@contora/state-core';

function textResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

const workspaceRootSchema = z.object({
  workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
});

/**
 * Project Intelligence Layer v1.1.3 — read-only query API.
 * Capture · Structure · Preserve · Retrieve · Transfer — no recommendations.
 */
export function registerIntelligenceTools(
  server: McpServer,
  resolveRoot: () => Promise<string>,
): void {
  server.registerTool(
    'get_project_identity',
    {
      description:
        '[Project Intelligence · inspect] Cross-tool project identity (.contora/identity/project_identity.json).',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ? override : await resolveRoot();
      const identity = await readProjectIdentity(root);
      return textResult({ workspaceRoot: root, found: !!identity, identity });
    },
  );

  server.registerTool(
    'get_project_decision',
    {
      description:
        '[Project Intelligence · inspect] Decision provenance graph + latest governance decision record.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ? override : await resolveRoot();
      const [decision, graph] = await Promise.all([
        readGovernanceDecision(root),
        readDecisionProvenanceGraph(root),
      ]);
      return textResult({
        workspaceRoot: root,
        found: !!(decision || graph?.nodes?.length),
        decision,
        decision_graph: graph,
      });
    },
  );

  server.registerTool(
    'get_project_why',
    {
      description: '[Project Intelligence · inspect] Why layer (.contora/intent/why.json).',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ? override : await resolveRoot();
      const why = await readWhyLayer(root);
      return textResult({ workspaceRoot: root, found: !!why?.features?.length, why });
    },
  );

  server.registerTool(
    'get_project_intent_graph',
    {
      description: '[Project Intelligence · inspect] Intent graph (.contora/intent/intent_graph.json).',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ? override : await resolveRoot();
      const graph = await readIntentGraphVNext(root);
      return textResult({ workspaceRoot: root, found: !!graph?.nodes?.length, intent_graph: graph });
    },
  );

  const evolutionQuerySchema = z.object({
    workspaceRoot: z.string().optional(),
    from: z.number().optional().describe('Unix ms — filter events after'),
    to: z.number().optional().describe('Unix ms — filter events before'),
    type: z
      .enum(['state_change', 'intent_change', 'decision', 'refactor', 'milestone'])
      .optional()
      .describe('Event type filter'),
    intent: z.string().optional().describe('Filter by linked intent or entity id'),
  });

  server.registerTool(
    'get_project_evolution_timeline',
    {
      description:
        '[Dimension · TIMELINE · inspect] Structured evolution history (.contora/timeline/project_timeline.json). Descriptive — not a log dump.',
      inputSchema: evolutionQuerySchema,
    },
    async (args) => {
      const root = args.workspaceRoot ? args.workspaceRoot : await resolveRoot();
      const timeline = await readProjectEvolutionTimeline(root);
      const events = timeline
        ? queryProjectEvolutionTimeline(timeline, {
            from: args.from,
            to: args.to,
            type: args.type,
            intent: args.intent,
          })
        : [];
      return textResult({
        workspaceRoot: root,
        found: events.length > 0,
        schema: timeline?.schema,
        updated_at: timeline?.updated_at,
        events,
      });
    },
  );

  const entityQuerySchema = z.object({
    workspaceRoot: z.string().optional(),
    entity_id: z.string().optional().describe('Filter by source entity or impacted module'),
  });

  server.registerTool(
    'get_impact_graph',
    {
      description:
        '[Dimension · IMPACT · inspect] Scope and propagation model (.contora/graph/impact_graph.json). Descriptive — not risk prediction.',
      inputSchema: entityQuerySchema,
    },
    async (args) => {
      const root = args.workspaceRoot ? args.workspaceRoot : await resolveRoot();
      const graph = await readImpactGraph(root);
      const entries = graph ? queryImpactGraph(graph, args.entity_id) : [];
      return textResult({
        workspaceRoot: root,
        found: entries.length > 0,
        schema: graph?.schema,
        updated_at: graph?.updated_at,
        entries,
      });
    },
  );

  const confidenceHandler = async (args: { workspaceRoot?: string; entity_id?: string }) => {
    const root = args.workspaceRoot ? args.workspaceRoot : await resolveRoot();
    const index = await readConfidenceIndex(root);
    const entities = index ? queryConfidenceIndex(index, args.entity_id) : [];
    return textResult({
      workspaceRoot: root,
      found: entities.length > 0,
      schema: index?.schema,
      updated_at: index?.updated_at,
      entities,
    });
  };

  server.registerTool(
    'get_confidence_index',
    {
      description:
        '[Dimension · CONFIDENCE · inspect] Trustworthiness of recorded intelligence (.contora/confidence/confidence_index.json).',
      inputSchema: entityQuerySchema,
    },
    confidenceHandler,
  );

  server.registerTool(
    'get_stability_index',
    {
      description: '[Legacy alias] Same as get_confidence_index.',
      inputSchema: entityQuerySchema,
    },
    async (args) => {
      const root = args.workspaceRoot ? args.workspaceRoot : await resolveRoot();
      const index = await readStabilityIndex(root);
      const entities = index ? queryStabilityIndex(index, args.entity_id) : [];
      return textResult({
        workspaceRoot: root,
        found: entities.length > 0,
        schema: index?.schema,
        updated_at: index?.updated_at,
        entities,
        legacy: true,
      });
    },
  );

  const anchorQuerySchema = z.object({
    workspaceRoot: z.string().optional(),
    anchor: z.string().optional().describe('Trace-back query anchor (feature, decision, module)'),
  });

  server.registerTool(
    'get_provenance_chain',
    {
      description:
        '[System · PROVENANCE · inspect] Trace-back chains WHY → DECISION → INTENT → TIMELINE (.contora/provenance/provenance_chain.json).',
      inputSchema: anchorQuerySchema,
    },
    async (args) => {
      const root = args.workspaceRoot ? args.workspaceRoot : await resolveRoot();
      const chain = await readProvenanceChain(root);
      const entries = chain ? queryProvenanceChain(chain, args.anchor) : [];
      return textResult({
        workspaceRoot: root,
        found: entries.length > 0,
        schema: chain?.schema,
        updated_at: chain?.updated_at,
        entries,
      });
    },
  );

  server.registerTool(
    'get_evolution_graph',
    {
      description:
        '[System · EVOLUTION · inspect] Structured transformation chains (.contora/evolution/evolution_graph.json). Not chronological timeline.',
      inputSchema: anchorQuerySchema,
    },
    async (args) => {
      const root = args.workspaceRoot ? args.workspaceRoot : await resolveRoot();
      const graph = await readEvolutionGraph(root);
      const chains = graph ? queryEvolutionGraph(graph, args.anchor) : [];
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
    'get_project_intelligence_health',
    {
      description:
        '[v1.1.3 · inspect] Intelligence completeness, weighted health_score, knowledge_coverage (.contora/intelligence/health.json). Measures asset completeness — not project quality.',
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
    'get_decision_log',
    {
      description:
        '[v1.1.3 · inspect] Append-only decision log (.contora/decision/decision_log.json). Records selected alternatives — not recommendations.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ? override : await resolveRoot();
      const log = await readDecisionLog(root);
      return textResult({ workspaceRoot: root, found: !!log, log });
    },
  );

  const transferFormatSchema = workspaceRootSchema.extend({
    format: z
      .enum(['json', 'markdown'])
      .optional()
      .describe('Output format; default json (structured) with markdown companion'),
  });

  server.registerTool(
    'get_cognitive_snapshot',
    {
      description:
        '[Legacy alias · prefer transfer_context] Compressed Cognitive Snapshot (~300–800 tokens).',
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
        return {
          content: [{ type: 'text' as const, text: markdown }],
        };
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
    'get_full_intelligence',
    {
      description:
        '[Legacy alias · prefer transfer_intelligence] Full Project Intelligence export (~8000 tokens).',
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
}
