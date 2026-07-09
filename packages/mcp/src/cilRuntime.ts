import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  askProject,
  buildProjectJourney,
  exploreHistory,
  getBlastRadius,
  getModuleHistory,
  readDecisionGraph,
  getRecentEvents,
  runCognitiveKernel,
  syncCognitiveInteractionLayer,
  queryTimeTravel,
  readKnowledgeLifecycle,
  readDecisionLifecycleMeta,
  writeDecisionLifecycleMeta,
  persistKnowledgeLifecycle,
  type HistoryRange,
  type DecisionLifecycleMeta,
} from '@contora/state-core';

function textResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

const workspaceRootSchema = z.object({
  workspaceRoot: z.string().optional().describe('Override workspace root'),
});

const askSchema = workspaceRootSchema.extend({
  question: z.string().describe('Natural language question about the project'),
});

const moduleSchema = workspaceRootSchema.extend({
  module: z.string().describe('Module or file path'),
});

const historySchema = workspaceRootSchema.extend({
  range: z
    .enum(['today', 'yesterday', 'last_7_days', 'last_30_days', 'all'])
    .optional()
    .describe('Time range filter'),
  limit: z.number().optional().describe('Max events to return'),
});

/**
 * Contorium CIL v3 — Cognitive Interaction Layer MCP tools.
 * All paths route through Cognitive Kernel where applicable.
 */
export function registerCilRuntimeTools(
  server: McpServer,
  resolveRoot: () => Promise<string>,
): void {
  server.registerTool(
    'ask_project',
    {
      description:
        '[CIL · Query] Ask Contorium a natural language question (what happened, why, impact, next actions).',
      inputSchema: askSchema,
    },
    async ({ question, workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
      return textResult(await askProject(root, question));
    },
  );

  server.registerTool(
    'get_recent_events',
    {
      description: '[CIL · History] Recent cognitive events (unified Timeline + Decision + Why).',
      inputSchema: historySchema,
    },
    async ({ limit, workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
      return textResult({ events: await getRecentEvents(root, limit ?? 12) });
    },
  );

  server.registerTool(
    'get_project_history',
    {
      description: '[CIL · History Explorer] Project history feed for a time range.',
      inputSchema: historySchema,
    },
    async ({ range, workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
      return textResult(await exploreHistory(root, (range as HistoryRange) ?? 'last_7_days'));
    },
  );

  server.registerTool(
    'get_decisions',
    {
      description: '[CIL · Decision Center] ADR-style decision records with Why, Risk, Alternatives.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
      const out = await runCognitiveKernel(root, { mode: 'decisions' });
      return textResult(out.result);
    },
  );

  server.registerTool(
    'get_project_story',
    {
      description: '[CIL · Narrative] Combined project story — goal, events, decisions, journey.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
      const out = await runCognitiveKernel(root, { mode: 'story' });
      return textResult(out.result);
    },
  );

  server.registerTool(
    'get_next_actions',
    {
      description: '[CIL · Query] Suggested next actions from focus, handoff, and intent.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      const out = await runCognitiveKernel(root, { mode: 'next' });
      return textResult(out.result);
    },
  );

  server.registerTool(
    'get_module_history',
    {
      description: '[CIL · History] Cognitive events involving a module or file.',
      inputSchema: moduleSchema,
    },
    async ({ module, workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
      return textResult({ module, events: await getModuleHistory(root, module) });
    },
  );

  server.registerTool(
    'get_blast_radius',
    {
      description: '[CIL · Impact Explorer] Blast radius and affected nodes for a module/file.',
      inputSchema: moduleSchema,
    },
    async ({ module, workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      return textResult(await getBlastRadius(root, module));
    },
  );

  server.registerTool(
    'get_project_journey',
    {
      description: '[CIL · Evolution Journey] Project growth roadmap narrative.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      return textResult(await buildProjectJourney(root));
    },
  );

  server.registerTool(
    'transfer_story',
    {
      description:
        '[CIL · Transfer V2] Narrative export — summary, decisions, events, risks, next actions.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
      const out = await runCognitiveKernel(root, { mode: 'story' });
      return textResult(out.result);
    },
  );

  server.registerTool(
    'get_decision_graph',
    {
      description: '[CIL · Decision Center] Decision DAG (.contora/decisions/graph.json).',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
      return textResult(await readDecisionGraph(root));
    },
  );

  server.registerTool(
    'get_snapshot',
    {
      description: '[CIL · Snapshot] Project snapshot nearest a date (YYYY-MM-DD) or latest.',
      inputSchema: workspaceRootSchema.extend({
        date: z.string().optional().describe('Calendar date YYYY-MM-DD'),
        perspective: z
          .enum(['historical', 'retrospective'])
          .optional()
          .describe('historical = known then; retrospective = known now about then'),
      }),
    },
    async ({ date, perspective, workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
      if (date) {
        return textResult(
          await queryTimeTravel(root, date, { perspective: perspective ?? 'historical' }),
        );
      }
      const out = await runCognitiveKernel(root, { mode: 'snapshot' });
      return textResult(out.result);
    },
  );

  server.registerTool(
    'get_cognitive_health',
    {
      description: '[CIL · Health] Cognitive health score and warnings (missing WHY, stale ADR, conflicts).',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
      const out = await runCognitiveKernel(root, { mode: 'health' });
      return textResult(out.result);
    },
  );

  server.registerTool(
    'get_entity_knowledge',
    {
      description: '[CIL · Knowledge Graph] Everything related to an entity (MCP, auth, module name).',
      inputSchema: workspaceRootSchema.extend({
        entity: z.string().describe('Entity name or topic'),
      }),
    },
    async ({ entity, workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
      const out = await runCognitiveKernel(root, { mode: 'entity', topic: entity });
      return textResult(out.result);
    },
  );

  server.registerTool(
    'get_project_essence',
    {
      description: '[CIL · Memory Compression] Compressed project essence for AI transfer.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
      const out = await runCognitiveKernel(root, { mode: 'essence' });
      return textResult(out.result);
    },
  );

  server.registerTool(
    'get_handoff_replay',
    {
      description: '[CIL · Replay] Cognitive evolution replay timeline.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
      const out = await runCognitiveKernel(root, { mode: 'replay' });
      return textResult(out.result);
    },
  );

  server.registerTool(
    'get_project_dna',
    {
      description: '[CIL · DNA] Project identity fingerprint for AI handoff.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
      const out = await runCognitiveKernel(root, { mode: 'dna' });
      return textResult(out.result);
    },
  );

  server.registerTool(
    'transfer_project',
    {
      description:
        '[CIL · Transfer] Unified project export — mode: context | intelligence | story | essence | handoff.',
      inputSchema: workspaceRootSchema.extend({
        mode: z
          .enum(['context', 'intelligence', 'story', 'essence', 'handoff'])
          .optional()
          .describe('Transfer mode (default context)'),
      }),
    },
    async ({ mode, workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      const m = mode ?? 'context';
      if (m === 'context' || m === 'intelligence') {
        const { loadTransferExportInput, buildTransferContextSnapshot, buildFullIntelligenceMarkdown, formatTransferContextMarkdown } =
          await import('@contora/state-core');
        await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
        const input = await loadTransferExportInput(root);
        if (m === 'intelligence') {
          return textResult({ text: await buildFullIntelligenceMarkdown(input) });
        }
        const snap = await buildTransferContextSnapshot(input);
        return textResult({ text: formatTransferContextMarkdown(snap) });
      }
      await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
      if (m === 'handoff') {
        const { getProjectHandoff } = await import('@contora/state-core');
        const handoff = await getProjectHandoff(root, 'markdown');
        return textResult({ text: handoff.text ?? '' });
      }
      const kernelMode = m === 'story' ? 'story' : 'essence';
      const out = await runCognitiveKernel(root, { mode: kernelMode });
      return textResult(out.result);
    },
  );

  server.registerTool(
    'get_suggested_questions',
    {
      description: '[CIL · Onboarding] Top suggested Ask Contorium questions.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
      const out = await runCognitiveKernel(root, { mode: 'questions' });
      return textResult(out.result);
    },
  );

  server.registerTool(
    'get_knowledge_health',
    {
      description:
        '[CIL · Lifecycle] Knowledge Health score, freshness dimensions, and decision trust (.contora/lifecycle/).',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
      const out = await runCognitiveKernel(root, { mode: 'lifecycle' });
      return textResult(out.result);
    },
  );

  server.registerTool(
    'get_review_queue',
    {
      description:
        '[CIL · Lifecycle] Decisions needing review — stale, expired, conflict, missing owner, invalidation triggers.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
      const out = await runCognitiveKernel(root, { mode: 'review' });
      return textResult(out.result);
    },
  );

  const lifecycleMetaSchema = workspaceRootSchema.extend({
    decision_id: z.string().describe('ADR / decision id'),
    owner: z.string().optional().describe('Assign decision owner'),
    verified: z.boolean().optional().describe('Mark decision verified now'),
    verified_by: z.string().optional(),
    verification_type: z
      .enum(['manual', 'automatic', 'llm_assisted'])
      .optional()
      .describe('Verification method'),
    expire_after_days: z.number().optional().describe('Days until review required'),
  });

  server.registerTool(
    'set_decision_lifecycle_meta',
    {
      description:
        '[CIL · Lifecycle] Update decision owner, verification, or expiry — persists to .contora/lifecycle/decisions/.',
      inputSchema: lifecycleMetaSchema,
    },
    async ({
      decision_id,
      owner,
      verified,
      verified_by,
      verification_type,
      expire_after_days,
      workspaceRoot: override,
    }) => {
      const root = override ?? (await resolveRoot());
      await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
      const existing = (await readDecisionLifecycleMeta(root, decision_id)) ?? {};
      const patch: DecisionLifecycleMeta = { ...existing };
      if (owner) {
        const nextOwner = owner.trim();
        if (existing.owner?.trim() && existing.owner.trim() !== nextOwner) {
          patch.previous_owner = existing.owner;
          patch.owner_changed_at = new Date().toISOString();
        }
        patch.owner = nextOwner;
      }
      if (verified) {
        patch.verified_at = new Date().toISOString();
        patch.verified_by = verified_by ?? 'mcp';
        patch.verification_type = verification_type ?? 'manual';
      } else if (verification_type) {
        patch.verification_type = verification_type;
      }
      if (expire_after_days != null && Number.isFinite(expire_after_days)) {
        patch.expire_after_days = Math.round(expire_after_days);
      }
      await writeDecisionLifecycleMeta(root, decision_id, patch);
      await persistKnowledgeLifecycle(root);
      const index = await readKnowledgeLifecycle(root);
      const record = index?.decisions.find((d) => d.decision_id === decision_id);
      return textResult({ decision_id, meta: patch, record });
    },
  );
}
