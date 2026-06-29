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
        return {
          intent: 'decision',
          result: {
            answer: `${match.title}: ${match.reason}`,
            decision: match.title,
            why: match.reason,
            date: match.date,
            confidence: freshnessLabelText(match.freshness),
            graph_nodes: graph?.nodes.length ?? 0,
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
      if (routed.topic && routed.topic.length > 2 && !/what happened|history|replay/.test(routed.topic)) {
        trace.push(traceStep('module_projection', 'history'));
        const mod = await exploreModuleHistory(workspaceRoot, routed.topic);
        return {
          intent: 'history',
          result: {
            answer: `${mod.record?.events.length ?? 0} event(s) for "${routed.topic}"`,
            module: mod.module,
            formatted: mod.formatted,
          },
          trace,
        };
      }
      trace.push(traceStep('event_engine', 'history'));
      const history = await exploreHistory(workspaceRoot, routed.range ?? 'last_7_days');
      return {
        intent: 'history',
        result: {
          answer: `${history.count} cognitive event(s)`,
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
        return {
          intent: 'state',
          result: {
            answer: `Cognitive health: ${health.score}% (${health.warnings.length} warning(s))`,
            health,
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
          result: { answer: 'Specify a date (YYYY-MM-DD) for time travel query.' },
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
            ? `On ${date}, focus: ${travel.focus}`
            : `Project state on ${date} — ${travel.decisions.length} decisions, ${travel.events.length} events`,
          ...travel,
        },
        trace,
      };
    }
    case 'entity': {
      trace.push(traceStep('knowledge_graph', 'entity'));
      const topic = routed.topic ?? query.split(/\s+/).pop() ?? 'project';
      const entity = await exploreEntityKnowledge(workspaceRoot, topic);
      return {
        intent: 'entity',
        result: {
          answer: entity.record
            ? `Found ${entity.record.events.length} events, ${entity.record.decisions.length} decisions for "${entity.entity}"`
            : `No knowledge graph links for "${topic}"`,
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

    trace.push(traceStep('cognitive_health', 'compute'));
    await persistCognitiveHealth(workspaceRoot).catch(() => undefined);

    trace.push(traceStep('pik', 'ensure'));
    await ensureProjectIntentKernel(workspaceRoot).catch(() => undefined);

    await persistCilIndex(
      workspaceRoot,
      events.map((e) => e.id),
      adrs.map((a) => a.id),
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
    return { intent: 'decision', result: { ...center, graph }, trace };
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
    return { intent: 'state', result: health, trace };
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
