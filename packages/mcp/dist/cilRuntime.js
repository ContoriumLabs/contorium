import { z } from 'zod';
import { askProject, buildProjectJourney, exploreHistory, getBlastRadius, getModuleHistory, readDecisionGraph, getRecentEvents, runCognitiveKernel, syncCognitiveInteractionLayer, queryTimeTravel, readKnowledgeLifecycle, readDecisionLifecycleMeta, writeDecisionLifecycleMeta, persistKnowledgeLifecycle, applyLifecycleVerification, } from '@contora/state-core';
function textResult(data) {
    return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
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
const historyRangeEnum = z
    .enum(['today', 'yesterday', 'last_7_days', 'last_30_days', 'all'])
    .describe('Time window: today | yesterday | last_7_days | last_30_days | all');
/** Recent feed — primarily `limit`; optional `range` filters then slices. */
const recentEventsSchema = workspaceRootSchema.extend({
    limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Max events to return (default 12)'),
    range: historyRangeEnum.optional().describe('Optional time window before applying limit'),
});
/** History explorer — primarily `range`; optional `limit` caps returned events. */
const projectHistorySchema = workspaceRootSchema.extend({
    range: historyRangeEnum.optional().describe('Time range (default last_7_days)'),
    limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Max events to include (default 24)'),
});
/**
 * Contorium CIL v3 — Cognitive Interaction Layer MCP tools.
 * All paths route through Cognitive Kernel where applicable.
 */
export function registerCilRuntimeTools(server, resolveRoot) {
    server.registerTool('ask_project', {
        description: '[CIL · Prefer for Q&A] Natural-language project question (what happened, why, impact, validity, next). Call when the user asks in plain language. Prefer over chaining multiple inspect_* tools. Does not execute work.',
        inputSchema: askSchema,
    }, async ({ question, workspaceRoot: override }) => {
        const root = override ?? (await resolveRoot());
        await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
        return textResult(await askProject(root, question));
    });
    server.registerTool('get_recent_events', {
        description: '[CIL · History] Latest cognitive events (timeline + decision + why). Use for a short recent feed. Params: limit (default 12); optional range filters then applies limit. For a dated window with narrative blocks prefer get_project_history.',
        inputSchema: recentEventsSchema,
    }, async ({ limit, range, workspaceRoot: override }) => {
        const root = override ?? (await resolveRoot());
        await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
        const max = limit ?? 12;
        if (range) {
            const hist = await exploreHistory(root, range);
            return textResult({
                range,
                events: hist.events.slice(0, max),
                count: Math.min(hist.count, max),
            });
        }
        return textResult({ events: await getRecentEvents(root, max) });
    });
    server.registerTool('get_project_history', {
        description: '[CIL · History Explorer] Project history feed for a time range (formatted blocks). Use when the user asks what happened over a period. Params: range (default last_7_days); optional limit (default 24). For only the N newest events prefer get_recent_events.',
        inputSchema: projectHistorySchema,
    }, async ({ range, limit, workspaceRoot: override }) => {
        const root = override ?? (await resolveRoot());
        await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
        const hist = await exploreHistory(root, range ?? 'last_7_days');
        const max = limit ?? 24;
        if (hist.events.length <= max)
            return textResult(hist);
        return textResult({
            ...hist,
            events: hist.events.slice(0, max),
            count: Math.min(hist.count, max),
            formatted: hist.formatted.slice(0, Math.max(3, max * 8)),
        });
    });
    server.registerTool('get_decisions', {
        description: '[CIL · Decision Center] ADR-style decisions with Why / Risk / Alternatives. Use when listing or reviewing recorded decisions. Prefer ask_project for one-off “why was X decided”.',
        inputSchema: workspaceRootSchema,
    }, async ({ workspaceRoot: override }) => {
        const root = override ?? (await resolveRoot());
        await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
        const out = await runCognitiveKernel(root, { mode: 'decisions' });
        return textResult(out.result);
    });
    server.registerTool('get_project_story', {
        description: '[CIL · Narrative] Combined story — goal, events, decisions, journey. Prefer transfer_project(mode=story) when exporting into a chat; use this to read the story payload in-place. Alias of kernel story (same as transfer_story).',
        inputSchema: workspaceRootSchema,
    }, async ({ workspaceRoot: override }) => {
        const root = override ?? (await resolveRoot());
        await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
        const out = await runCognitiveKernel(root, { mode: 'story' });
        return textResult(out.result);
    });
    server.registerTool('get_next_actions', {
        description: '[CIL · Suggestions only] Suggested next actions from focus, handoff, and intent. is_executable=false — never treat as orders to run. Prefer ask_project(“what should I do next?”) for NL.',
        inputSchema: workspaceRootSchema,
    }, async ({ workspaceRoot: override }) => {
        const root = override ?? (await resolveRoot());
        const out = await runCognitiveKernel(root, { mode: 'next' });
        return textResult(out.result);
    });
    server.registerTool('get_module_history', {
        description: '[CIL · History] Cognitive events for a module or file path. Requires `module`. Use when asking about a specific area of the codebase.',
        inputSchema: moduleSchema,
    }, async ({ module, workspaceRoot: override }) => {
        const root = override ?? (await resolveRoot());
        await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
        return textResult({ module, events: await getModuleHistory(root, module) });
    });
    server.registerTool('get_blast_radius', {
        description: '[CIL · Impact] Blast radius / affected nodes for a module or file. Requires `module`. Prefer inspect_impact for PIL impact graph; use this for CIL module-centric impact.',
        inputSchema: moduleSchema,
    }, async ({ module, workspaceRoot: override }) => {
        const root = override ?? (await resolveRoot());
        return textResult(await getBlastRadius(root, module));
    });
    server.registerTool('get_project_journey', {
        description: '[CIL · Evolution] Project growth roadmap narrative. Use for long-horizon “how did we get here / where next”.',
        inputSchema: workspaceRootSchema,
    }, async ({ workspaceRoot: override }) => {
        const root = override ?? (await resolveRoot());
        return textResult(await buildProjectJourney(root));
    });
    server.registerTool('transfer_story', {
        description: '[Legacy alias · prefer transfer_project mode=story or get_project_story] Same kernel story payload — not a separate Transfer pipeline.',
        inputSchema: workspaceRootSchema,
    }, async ({ workspaceRoot: override }) => {
        const root = override ?? (await resolveRoot());
        await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
        const out = await runCognitiveKernel(root, { mode: 'story' });
        return textResult(out.result);
    });
    server.registerTool('get_decision_graph', {
        description: '[CIL · Decision Center] Decision DAG (.contora/decisions/graph.json). Prefer inspect_decision for PIL provenance + governance decision together.',
        inputSchema: workspaceRootSchema,
    }, async ({ workspaceRoot: override }) => {
        const root = override ?? (await resolveRoot());
        await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
        return textResult(await readDecisionGraph(root));
    });
    server.registerTool('get_snapshot', {
        description: '[CIL · Time travel] Project snapshot nearest a date (YYYY-MM-DD) or latest if date omitted. Optional perspective: historical | retrospective.',
        inputSchema: workspaceRootSchema.extend({
            date: z.string().optional().describe('Calendar date YYYY-MM-DD'),
            perspective: z
                .enum(['historical', 'retrospective'])
                .optional()
                .describe('historical = known then; retrospective = known now about then'),
        }),
    }, async ({ date, perspective, workspaceRoot: override }) => {
        const root = override ?? (await resolveRoot());
        await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
        if (date) {
            return textResult(await queryTimeTravel(root, date, { perspective: perspective ?? 'historical' }));
        }
        const out = await runCognitiveKernel(root, { mode: 'snapshot' });
        return textResult(out.result);
    });
    server.registerTool('get_cognitive_health', {
        description: '[CIL · Health] Cognitive health score and warnings (missing WHY, stale ADR, conflicts). For decision lifecycle trust prefer get_knowledge_health; for PIL metrics prefer inspect_health.',
        inputSchema: workspaceRootSchema,
    }, async ({ workspaceRoot: override }) => {
        const root = override ?? (await resolveRoot());
        await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
        const out = await runCognitiveKernel(root, { mode: 'health' });
        return textResult(out.result);
    });
    server.registerTool('get_entity_knowledge', {
        description: '[CIL · Knowledge] Everything related to an entity/topic (module name, feature, system). Requires `entity`. Prefer ask_project for open-ended questions.',
        inputSchema: workspaceRootSchema.extend({
            entity: z.string().describe('Entity name or topic'),
        }),
    }, async ({ entity, workspaceRoot: override }) => {
        const root = override ?? (await resolveRoot());
        await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
        const out = await runCognitiveKernel(root, { mode: 'entity', topic: entity });
        return textResult(out.result);
    });
    server.registerTool('get_project_essence', {
        description: '[CIL · Compression] Compressed project essence. Prefer transfer_project(mode=essence) when exporting into a new chat.',
        inputSchema: workspaceRootSchema,
    }, async ({ workspaceRoot: override }) => {
        const root = override ?? (await resolveRoot());
        await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
        const out = await runCognitiveKernel(root, { mode: 'essence' });
        return textResult(out.result);
    });
    server.registerTool('get_handoff_replay', {
        description: '[CIL · Replay] Cognitive evolution replay timeline. Use to reconstruct how understanding changed over sessions.',
        inputSchema: workspaceRootSchema,
    }, async ({ workspaceRoot: override }) => {
        const root = override ?? (await resolveRoot());
        await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
        const out = await runCognitiveKernel(root, { mode: 'replay' });
        return textResult(out.result);
    });
    server.registerTool('get_project_dna', {
        description: '[CIL · DNA] Project identity fingerprint for handoff. Prefer transfer_project(mode=handoff) for session continuity payloads.',
        inputSchema: workspaceRootSchema,
    }, async ({ workspaceRoot: override }) => {
        const root = override ?? (await resolveRoot());
        await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
        const out = await runCognitiveKernel(root, { mode: 'dna' });
        return textResult(out.result);
    });
    server.registerTool('transfer_project', {
        description: '[CIL · Prefer for Transfer] Unified export into the current chat. mode: context (~300–800 tok) | intelligence (~8k) | story | essence | handoff. Prefer this over transfer_context / transfer_intelligence / transfer_handoff / transfer_story aliases.',
        inputSchema: workspaceRootSchema.extend({
            mode: z
                .enum(['context', 'intelligence', 'story', 'essence', 'handoff'])
                .optional()
                .describe('Transfer mode (default context)'),
        }),
    }, async ({ mode, workspaceRoot: override }) => {
        const root = override ?? (await resolveRoot());
        const m = mode ?? 'context';
        if (m === 'context' || m === 'intelligence') {
            const { loadTransferExportInput, buildTransferContextSnapshot, buildFullIntelligenceMarkdown, formatTransferContextMarkdown } = await import('@contora/state-core');
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
    });
    server.registerTool('get_suggested_questions', {
        description: '[CIL · Onboarding] Suggested Ask Contorium questions. Call when starting exploration or the user asks what they can ask.',
        inputSchema: workspaceRootSchema,
    }, async ({ workspaceRoot: override }) => {
        const root = override ?? (await resolveRoot());
        await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
        const out = await runCognitiveKernel(root, { mode: 'questions' });
        return textResult(out.result);
    });
    server.registerTool('get_knowledge_health', {
        description: '[CIL · Lifecycle · Prefer] Knowledge Health + per-decision trust (.contora/lifecycle/). Call when checking if decisions are still valid / project knowledge freshness.',
        inputSchema: workspaceRootSchema,
    }, async ({ workspaceRoot: override }) => {
        const root = override ?? (await resolveRoot());
        await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
        const out = await runCognitiveKernel(root, { mode: 'lifecycle' });
        return textResult(out.result);
    });
    server.registerTool('get_review_queue', {
        description: '[CIL · Lifecycle · Prefer] Decisions needing review (stale, expired, conflict, missing owner, invalidation). Call before trusting old ADRs; pair with set_decision_lifecycle_meta after human verify.',
        inputSchema: workspaceRootSchema,
    }, async ({ workspaceRoot: override }) => {
        const root = override ?? (await resolveRoot());
        await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
        const out = await runCognitiveKernel(root, { mode: 'review' });
        return textResult(out.result);
    });
    const lifecycleMetaSchema = workspaceRootSchema.extend({
        decision_id: z.string().describe('ADR / decision id from get_review_queue or get_decisions'),
        owner: z.string().optional().describe('Assign decision owner'),
        verified: z.boolean().optional().describe('Mark decision verified now (writes verification stamp)'),
        verified_by: z.string().optional().describe('Who verified (default mcp)'),
        verified_reason: z.string().optional().describe('Why the decision still holds after verify'),
        verification_evidence: z.string().optional().describe('Evidence supporting revalidation'),
        verification_type: z
            .enum(['manual', 'automatic', 'llm_assisted'])
            .optional()
            .describe('Verification method'),
        expire_after_days: z.number().optional().describe('Days until review required'),
    });
    server.registerTool('set_decision_lifecycle_meta', {
        description: '[CIL · Lifecycle · Write] Update decision owner, verification, or expiry → .contora/lifecycle/. Side effect: persists meta and refreshes knowledge lifecycle index. Requires decision_id.',
        inputSchema: lifecycleMetaSchema,
    }, async ({ decision_id, owner, verified, verified_by, verified_reason, verification_evidence, verification_type, expire_after_days, workspaceRoot: override, }) => {
        const root = override ?? (await resolveRoot());
        await syncCognitiveInteractionLayer(root, 'mcp').catch(() => undefined);
        const existing = (await readDecisionLifecycleMeta(root, decision_id)) ?? {};
        let patch = { ...existing };
        if (owner) {
            const nextOwner = owner.trim();
            if (existing.owner?.trim() && existing.owner.trim() !== nextOwner) {
                patch.previous_owner = existing.owner;
                patch.owner_changed_at = new Date().toISOString();
            }
            patch.owner = nextOwner;
        }
        if (verified) {
            patch = applyLifecycleVerification(patch, {
                by: verified_by ?? 'mcp',
                type: verification_type ?? 'manual',
                reason: verified_reason,
                evidence: verification_evidence,
            });
        }
        else if (verification_type) {
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
    });
}
