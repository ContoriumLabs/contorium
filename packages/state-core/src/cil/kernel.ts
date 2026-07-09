/**
 * Cognitive Kernel — single dispatch center for CIL v3.
 * All engines are invoked only from here (Kernel First Principle).
 */
import type { AdapterKind } from '../types.js';
import { readStateJson } from '../bootstrap/bootstrapState.js';
import { readIntentGraphVNext } from '../intelligence/intentVNext.js';
import { freshnessLabelText } from './confidenceLabels.js';
import { deriveNextActions } from './actionEngine.js';
import { getDecisionCenter } from './decisionCenter.js';
import { persistDecisionGraph, readDecisionGraph } from './decisionGraph.js';
import {
  syncCognitiveEvents,
  syncDecisionCenter,
} from './eventEngine.js';
import { persistCilIndex, readAllAdrRecords, readAllCognitiveEvents } from './eventStore.js';
import { exploreHistory, getRecentEvents } from './historyExplorer.js';
import { getBlastRadius } from './impactExplorer.js';
import { buildProjectJourney } from './journeyBuilder.js';
import { exploreModuleHistory, syncModuleHistory } from './moduleHistory.js';
import { routeIntent } from '../ai/routeIntent.js';
import {
  generateStoryWithAi,
  generateEssenceWithAi,
  generateDnaWithAi,
} from '../ai/generators/index.js';
import {
  listProjectSnapshots,
  readProjectSnapshot,
  writeProjectSnapshot,
} from './snapshotEngine.js';
import { persistCognitiveHealth } from './cognitiveHealth.js';
import { exploreEntityKnowledge, syncKnowledgeGraph } from './knowledgeGraph.js';
import { buildHandoffReplay } from './handoffReplay.js';
import { resolveDecisionByTopic } from './decisionLifecycle.js';
import { buildSuggestedQuestions } from './suggestedQuestions.js';
import { queryTimeTravel } from './timeTravel.js';
import { prepareAskV2Context, buildDirectionKernelOutput } from './askV2.js';
import { ensureProjectIntentKernel } from './pik/generator.js';
import { extractWhatIsEntityTopic } from './semantic/directionQuery.js';
import { persistKnowledgeLifecycle, readKnowledgeLifecycle, formatReviewQueue, appendLifecycleTrustOverlay, formatSupersededDecisionPreamble, findDecisionLifecycle } from '../lifecycle/index.js';
import type {
  CilIntent,
  HistoryRange,
  KernelInput,
  KernelOutput,
  KernelTraceStep,
} from './types.js';

function traceStep(engine: string, phase: string): KernelTraceStep {
  return { engine, phase, at: new Date().toISOString() };
}

async function dispatchAsk(
  workspaceRoot: string,
  query: string,
  trace: KernelTraceStep[],
): Promise<KernelOutput> {
  const routed = await routeIntent(workspaceRoot, query);
  trace.push(traceStep('query_router', routed.intent));

  switch (routed.intent) {
    case 'direction': {
      trace.push(traceStep('pik', 'load'));
      const ctx = await prepareAskV2Context(workspaceRoot, query);
      trace.push(traceStep('semantic_fusion', 'fuse'));
      return buildDirectionKernelOutput(query, ctx);
    }
    case 'action': {
      trace.push(traceStep('action_engine', 'derive'));
      const items = await deriveNextActions(workspaceRoot);
      return {
        intent: 'action',
        result: {
          answer: items[0]?.task ?? 'No suggested actions',
          items,
          next_actions: items,
        },
        trace,
      };
    }
    case 'decision': {
      trace.push(traceStep('decision_engine', 'center'));
      const center = await getDecisionCenter(workspaceRoot);
      const graph = await readDecisionGraph(workspaceRoot);
      const needle = routed.topic?.toLowerCase();
      if (needle && (/^why not|why wasn't|why isn't/i.test(query.toLowerCase()) || needle.length > 2)) {
        const resolved = resolveDecisionByTopic(center.decisions, needle || query);
        if (resolved.adr) {
          return {
            intent: 'decision',
            result: {
              answer: resolved.answer,
              decision: resolved.adr.title,
              why: resolved.adr.reason,
              date: resolved.adr.date,
              chain: resolved.chain,
              confidence: freshnessLabelText(resolved.adr.freshness),
            },
            trace,
          };
        }
      }
      const match = needle
        ? center.decisions.find(
            (d) =>
              d.title.toLowerCase().includes(needle) ||
              d.reason.toLowerCase().includes(needle),
          )
        : center.decisions[0];
      if (match) {
        trace.push(traceStep('lifecycle', 'filter'));
        const lcIndex =
          (await readKnowledgeLifecycle(workspaceRoot)) ??
          (await persistKnowledgeLifecycle(workspaceRoot).catch(() => null));
        const lcRecord = lcIndex ? findDecisionLifecycle(lcIndex, match.id) : undefined;
        const supersededNote = lcRecord ? formatSupersededDecisionPreamble(lcRecord) : undefined;
        const baseAnswer = `${match.title}: ${match.reason}`;
        return {
          intent: 'decision',
          result: {
            answer: supersededNote ? `${supersededNote}\n\n${baseAnswer}` : baseAnswer,
            decision: match.title,
            why: match.reason,
            date: match.date,
            confidence: freshnessLabelText(match.freshness),
            graph_nodes: graph?.nodes.length ?? 0,
            lifecycle: lcRecord,
          },
          trace,
        };
      }
      const events = await readAllCognitiveEvents(workspaceRoot);
      const evt = events.find((e) => e.why);
      return {
        intent: 'decision',
        result: {
          answer: evt?.why ?? 'No matching decision found.',
          decision: evt?.decision,
          why: evt?.why,
        },
        trace,
      };
    }
    case 'history': {
      if (routed.topic === 'replay') {
        trace.push(traceStep('handoff_replay', 'timeline'));
        const replay = await buildHandoffReplay(workspaceRoot);
        return {
          intent: 'history',
          result: {
            answer: `${replay.stages.length} replay stage(s)`,
            ...replay,
          },
          trace,
        };
      }
      const moduleTopic = routed.topic?.trim();
      const looksLikeModule =
        moduleTopic &&
        moduleTopic.length >= 2 &&
        moduleTopic.length <= 64 &&
        !/\s/.test(moduleTopic) &&
        !/[?!]/.test(moduleTopic) &&
        !/what happened|history|replay/i.test(moduleTopic);
      if (looksLikeModule) {
        trace.push(traceStep('module_projection', 'history'));
        const mod = await exploreModuleHistory(workspaceRoot, moduleTopic);
        return {
          intent: 'history',
          result: {
            answer: `${mod.record?.events.length ?? 0} event(s) for "${moduleTopic}"`,
            module: mod.module,
            formatted: mod.formatted,
          },
          trace,
        };
      }
      trace.push(traceStep('event_engine', 'history'));
      const history = await exploreHistory(workspaceRoot, routed.range ?? 'last_7_days');
      const preview = history.formatted.slice(0, 10).join('\n');
      return {
        intent: 'history',
        result: {
          answer: history.count
            ? `${history.count} cognitive event(s)\n\n${preview}`
            : 'No cognitive events yet — run sync to build project history.',
          events: history.events.slice(0, 12),
          formatted: history.formatted.slice(0, 40),
        },
        trace,
      };
    }
    case 'state': {
      trace.push(traceStep('state_engine', 'read'));
      const dateMatch = routed.topic?.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        trace.push(traceStep('snapshot_engine', 'time_travel'));
        const travel = await queryTimeTravel(workspaceRoot, dateMatch[0]!, {
          perspective: routed.perspective ?? 'historical',
        });
        return {
          intent: 'time_travel',
          result: {
            answer: travel.focus
              ? `On ${travel.date}, focus was: ${travel.focus}`
              : `State on ${travel.date}: ${travel.events.length} event(s), ${travel.decisions.length} decision(s)`,
            ...travel,
          },
          trace,
        };
      }
      const [state, intents] = await Promise.all([
        readStateJson(workspaceRoot),
        readIntentGraphVNext(workspaceRoot),
      ]);
      if (routed.topic === 'health') {
        trace.push(traceStep('cognitive_health', 'read'));
        const health = await persistCognitiveHealth(workspaceRoot);
        trace.push(traceStep('lifecycle', 'knowledge_health'));
        const lc =
          (await readKnowledgeLifecycle(workspaceRoot)) ??
          (await persistKnowledgeLifecycle(workspaceRoot).catch(() => null));
        const cognitiveLines = health.formatted.slice(0, 10).join('\n');
        const knowledgeLines = lc?.health.formatted.slice(0, 10).join('\n') ?? '';
        const answer = [
          `Cognitive health: ${health.score}% (${health.warnings.length} warning(s))`,
          lc ? `Knowledge health: ${lc.health.score}% (${lc.review_queue.length} review item(s))` : '',
          '',
          cognitiveLines,
          knowledgeLines ? `\n${knowledgeLines}` : '',
        ]
          .filter(Boolean)
          .join('\n');
        return {
          intent: 'state',
          result: {
            answer,
            health,
            knowledge_health: lc?.health,
            lifecycle_score: lc?.health.score,
            review_queue: lc?.review_queue,
            formatted: [...(health.formatted ?? []), '', ...(lc?.health.formatted ?? [])],
          },
          trace,
        };
      }
      if (routed.topic === 'review') {
        trace.push(traceStep('lifecycle', 'review_queue'));
        const index =
          (await readKnowledgeLifecycle(workspaceRoot)) ??
          (await persistKnowledgeLifecycle(workspaceRoot));
        const formatted = formatReviewQueue(index);
        return {
          intent: 'state',
          result: {
            answer: index.review_queue.length
              ? `${index.review_queue.length} decision(s) need review\n\n${formatted.slice(0, 20).join('\n')}`
              : 'Review queue clear — no stale, expired, or conflicting decisions.',
            review_queue: index.review_queue,
            knowledge_health: index.health,
            formatted,
          },
          trace,
        };
      }
      if (routed.topic === 'knowledge_health') {
        trace.push(traceStep('lifecycle', 'knowledge_health'));
        const index =
          (await readKnowledgeLifecycle(workspaceRoot)) ??
          (await persistKnowledgeLifecycle(workspaceRoot));
        return {
          intent: 'state',
          result: {
            answer: `Knowledge Health: ${index.health.score}%\n\n${index.health.formatted.join('\n')}`,
            knowledge_health: index.health,
            lifecycle: index,
            formatted: index.health.formatted,
          },
          trace,
        };
      }
      const focus = state?.currentTask?.trim();
      const goal = intents?.nodes?.[0]?.name;
      return {
        intent: 'state',
        result: {
          answer: focus ? `Current focus: ${focus}` : goal ? `Primary intent: ${goal}` : 'No focus set',
          focus,
          goal,
        },
        trace,
      };
    }
    case 'story': {
      trace.push(traceStep('narrative_layer', 'story_readonly'));
      const story = await generateStoryWithAi(workspaceRoot);
      if (story.llm_enhanced) {
        trace.push(traceStep('ai_layer', 'story'));
      }
      return {
        intent: 'story',
        result: {
          answer: story.project_summary,
          summary: story.project_summary,
          formatted: story.formatted_markdown,
          llm_enhanced: story.llm_enhanced ?? false,
        },
        trace,
      };
    }
    case 'time_travel': {
      trace.push(traceStep('snapshot_engine', 'time_travel'));
      const date = routed.topic?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      if (!date) {
        return {
          intent: 'time_travel',
          result: {
            answer:
              'Specify a date (YYYY-MM-DD) for time travel — e.g. "What was state on 2024-06-01?" or "Focus on 2024-06-01".',
          },
          trace,
        };
      }
      const travel = await queryTimeTravel(workspaceRoot, date, {
        perspective: routed.perspective ?? 'historical',
      });
      return {
        intent: 'time_travel',
        result: {
          answer: travel.focus
            ? `On ${date}, focus: ${travel.focus}\n\n${travel.formatted.slice(0, 14).join('\n')}`
            : `Project state on ${date} — ${travel.decisions.length} decisions, ${travel.events.length} events\n\n${travel.formatted.slice(0, 14).join('\n')}`,
          ...travel,
        },
        trace,
      };
    }
    case 'entity': {
      trace.push(traceStep('knowledge_graph', 'entity'));
      const topic = routed.topic ?? extractWhatIsEntityTopic(query) ?? query.split(/\s+/).pop() ?? 'project';
      const entity = await exploreEntityKnowledge(workspaceRoot, topic);
      const summary = entity.record
        ? `Knowledge Graph — "${entity.entity}": ${entity.record.events.length} event(s), ${entity.record.decisions.length} decision(s), ${entity.record.modules.length} module(s)`
        : `No knowledge graph links for "${topic}" — run sync to build .contora/cognitive/knowledge/`;
      return {
        intent: 'entity',
        result: {
          answer: `${summary}\n\n${entity.formatted.slice(0, 16).join('\n')}`,
          ...entity,
        },
        trace,
      };
    }
    case 'debug':
    default: {
      if (routed.topic === 'journey') {
        trace.push(traceStep('journey_builder', 'read'));
        const journey = await buildProjectJourney(workspaceRoot);
        return {
          intent: 'debug',
          result: {
            answer: journey.stages.map((s) => s.label).join(' → '),
            journey,
          },
          trace,
        };
      }
      if (routed.topic) {
        trace.push(traceStep('impact_engine', 'blast_radius'));
        const blast = await getBlastRadius(workspaceRoot, routed.topic);
        return {
          intent: 'debug',
          result: {
            answer: `Blast radius ${blast.blast_radius} (${blast.criticality})`,
            ...blast,
          },
          trace,
        };
      }
      trace.push(traceStep('event_engine', 'recent'));
      const recent = await getRecentEvents(workspaceRoot, 5);
      return {
        intent: 'history',
        result: {
          answer: recent.map((e) => e.title).join('; ') || 'Run sync to build events.',
          events: recent,
        },
        trace,
      };
    }
  }
}

/** Cognitive Kernel — the only orchestration entry for CIL. */
export async function runCognitiveKernel(
  workspaceRoot: string,
  input: KernelInput,
  writer: AdapterKind = 'cli',
): Promise<KernelOutput> {
  const trace: KernelTraceStep[] = [traceStep('kernel', input.mode)];

  if (input.mode === 'sync') {
    trace.push(traceStep('event_engine', 'sync'));
    const events = await syncCognitiveEvents(workspaceRoot, writer);

    trace.push(traceStep('decision_engine', 'sync'));
    const adrs = await syncDecisionCenter(workspaceRoot);

    trace.push(traceStep('snapshot_engine', 'write'));
    await writeProjectSnapshot(workspaceRoot, events, adrs).catch(() => undefined);

    trace.push(traceStep('module_projection', 'sync'));
    await syncModuleHistory(workspaceRoot, events).catch(() => undefined);

    trace.push(traceStep('decision_graph', 'persist'));
    await persistDecisionGraph(workspaceRoot, adrs).catch(() => undefined);

    trace.push(traceStep('knowledge_graph', 'sync'));
    const snapshots = await listProjectSnapshots(workspaceRoot).catch(() => [] as Awaited<
      ReturnType<typeof listProjectSnapshots>
    >);
    await syncKnowledgeGraph(workspaceRoot, events, adrs, snapshots).catch(() => undefined);

    trace.push(traceStep('lifecycle', 'persist'));
    const lifecycleIndex = await persistKnowledgeLifecycle(workspaceRoot).catch(() => null);

    trace.push(traceStep('cognitive_health', 'compute'));
    const healthReport = await persistCognitiveHealth(workspaceRoot).catch(() => null);

    trace.push(traceStep('pik', 'ensure'));
    await ensureProjectIntentKernel(workspaceRoot).catch(() => undefined);

    await persistCilIndex(
      workspaceRoot,
      events.map((e) => e.id),
      adrs.map((a) => a.id),
      {
        lifecycle: lifecycleIndex
          ? {
              path: '.contora/lifecycle/index.json',
              updated_at: lifecycleIndex.updated_at,
              score: lifecycleIndex.health.score,
              review_count: lifecycleIndex.review_queue.length,
            }
          : undefined,
        cognitive_health: healthReport
          ? {
              path: '.contora/cognitive/health.json',
              updated_at: healthReport.updated_at,
              score: healthReport.score,
            }
          : undefined,
      },
    );

    return { intent: 'sync', result: { events, adrs, event_count: events.length }, trace };
  }

  if (input.mode === 'next') {
    trace.push(traceStep('action_engine', 'derive'));
    const items = await deriveNextActions(workspaceRoot);
    return { intent: 'action', result: { items, next_actions: items }, trace };
  }

  if (input.mode === 'story') {
    trace.push(traceStep('narrative_layer', 'story_readonly'));
    const story = await generateStoryWithAi(workspaceRoot);
    if (story.llm_enhanced) {
      trace.push(traceStep('ai_layer', 'story'));
    }
    return { intent: 'story', result: story, trace };
  }

  if (input.mode === 'history') {
    trace.push(traceStep('event_engine', 'history'));
    const history = await exploreHistory(workspaceRoot, input.range ?? 'last_7_days');
    return { intent: 'history', result: history, trace };
  }

  if (input.mode === 'decisions') {
    trace.push(traceStep('decision_engine', 'center'));
    const center = await getDecisionCenter(workspaceRoot);
    const graph = await readDecisionGraph(workspaceRoot);
    trace.push(traceStep('lifecycle', 'overlay'));
    const lcIndex =
      (await readKnowledgeLifecycle(workspaceRoot)) ??
      (await persistKnowledgeLifecycle(workspaceRoot).catch(() => null));
    const formatted = appendLifecycleTrustOverlay(center.formatted, lcIndex);
    return {
      intent: 'decision',
      result: {
        ...center,
        graph,
        formatted,
        knowledge_health: lcIndex?.health,
        review_queue: lcIndex?.review_queue,
      },
      trace,
    };
  }

  if (input.mode === 'snapshot') {
    trace.push(traceStep('snapshot_engine', 'read'));
    if (input.topic) {
      const travel = await queryTimeTravel(workspaceRoot, input.topic, {
        perspective: input.perspective ?? 'historical',
      });
      return { intent: 'time_travel', result: travel, trace };
    }
    const snaps = await listProjectSnapshots(workspaceRoot);
    return { intent: 'state', result: { snapshots: snaps }, trace };
  }

  if (input.mode === 'health') {
    trace.push(traceStep('cognitive_health', 'read'));
    const health = await persistCognitiveHealth(workspaceRoot);
    trace.push(traceStep('lifecycle', 'knowledge_health'));
    const lifecycle = await readKnowledgeLifecycle(workspaceRoot).catch(() => null);
    if (!lifecycle) {
      await persistKnowledgeLifecycle(workspaceRoot).catch(() => undefined);
    }
    const lc = lifecycle ?? (await readKnowledgeLifecycle(workspaceRoot));
    const formatted = [
      ...(health.formatted ?? []),
      '',
      ...(lc?.health.formatted ?? []),
    ];
    return {
      intent: 'state',
      result: {
        ...health,
        knowledge_health: lc?.health,
        lifecycle_score: lc?.health.score,
        formatted,
      },
      trace,
    };
  }

  if (input.mode === 'lifecycle') {
    trace.push(traceStep('lifecycle', 'compute'));
    const index = await persistKnowledgeLifecycle(workspaceRoot);
    return {
      intent: 'state',
      result: {
        answer: `Knowledge Health: ${index.health.score}% · ${index.review_queue.length} review item(s)`,
        lifecycle: index,
        health: index.health,
        formatted: index.health.formatted,
      },
      trace,
    };
  }

  if (input.mode === 'review') {
    trace.push(traceStep('lifecycle', 'review_queue'));
    const index =
      (await readKnowledgeLifecycle(workspaceRoot)) ??
      (await persistKnowledgeLifecycle(workspaceRoot));
    const formatted = formatReviewQueue(index);
    return {
      intent: 'state',
      result: {
        answer: index.review_queue.length
          ? `${index.review_queue.length} decision(s) need review`
          : 'Review queue clear',
        review_queue: index.review_queue,
        knowledge_health: index.health,
        formatted,
      },
      trace,
    };
  }

  if (input.mode === 'entity' && input.topic) {
    trace.push(traceStep('knowledge_graph', 'entity'));
    const entity = await exploreEntityKnowledge(workspaceRoot, input.topic);
    return { intent: 'entity', result: entity, trace };
  }

  if (input.mode === 'essence') {
    trace.push(traceStep('memory_compression', 'essence'));
    const essence = await generateEssenceWithAi(workspaceRoot);
    if (essence.llm_enhanced) {
      trace.push(traceStep('ai_layer', 'essence'));
    }
    return { intent: 'story', result: essence, trace };
  }

  if (input.mode === 'replay') {
    trace.push(traceStep('handoff_replay', 'timeline'));
    const replay = await buildHandoffReplay(workspaceRoot);
    return { intent: 'history', result: replay, trace };
  }

  if (input.mode === 'dna') {
    trace.push(traceStep('project_dna', 'build'));
    const dna = await generateDnaWithAi(workspaceRoot);
    if (dna.llm_enhanced) {
      trace.push(traceStep('ai_layer', 'dna'));
    }
    return { intent: 'story', result: dna, trace };
  }

  if (input.mode === 'questions') {
    trace.push(traceStep('suggested_questions', 'build'));
    const questions = await buildSuggestedQuestions(workspaceRoot);
    return { intent: 'state', result: questions, trace };
  }

  if (input.mode === 'ask' && input.query) {
    return dispatchAsk(workspaceRoot, input.query, trace);
  }

  return {
    intent: 'history',
    result: { answer: 'Invalid kernel input' },
    trace,
  };
}

export async function syncCognitiveInteractionLayer(
  workspaceRoot: string,
  writer: AdapterKind = 'cli',
) {
  const out = await runCognitiveKernel(workspaceRoot, { mode: 'sync' }, writer);
  const result = out.result as { events: unknown[]; adrs: unknown[] };
  return { events: result.events, adrs: result.adrs };
}

export { readProjectSnapshot };
