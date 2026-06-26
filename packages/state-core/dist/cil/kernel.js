"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readProjectSnapshot = void 0;
exports.runCognitiveKernel = runCognitiveKernel;
exports.syncCognitiveInteractionLayer = syncCognitiveInteractionLayer;
const bootstrapState_js_1 = require("../bootstrap/bootstrapState.js");
const intentVNext_js_1 = require("../intelligence/intentVNext.js");
const confidenceLabels_js_1 = require("./confidenceLabels.js");
const actionEngine_js_1 = require("./actionEngine.js");
const decisionCenter_js_1 = require("./decisionCenter.js");
const decisionGraph_js_1 = require("./decisionGraph.js");
const eventEngine_js_1 = require("./eventEngine.js");
const eventStore_js_1 = require("./eventStore.js");
const historyExplorer_js_1 = require("./historyExplorer.js");
const impactExplorer_js_1 = require("./impactExplorer.js");
const journeyBuilder_js_1 = require("./journeyBuilder.js");
const moduleHistory_js_1 = require("./moduleHistory.js");
const routeIntent_js_1 = require("../ai/routeIntent.js");
const index_js_1 = require("../ai/generators/index.js");
const snapshotEngine_js_1 = require("./snapshotEngine.js");
Object.defineProperty(exports, "readProjectSnapshot", { enumerable: true, get: function () { return snapshotEngine_js_1.readProjectSnapshot; } });
const cognitiveHealth_js_1 = require("./cognitiveHealth.js");
const knowledgeGraph_js_1 = require("./knowledgeGraph.js");
const handoffReplay_js_1 = require("./handoffReplay.js");
const decisionLifecycle_js_1 = require("./decisionLifecycle.js");
const suggestedQuestions_js_1 = require("./suggestedQuestions.js");
const timeTravel_js_1 = require("./timeTravel.js");
function traceStep(engine, phase) {
    return { engine, phase, at: new Date().toISOString() };
}
async function dispatchAsk(workspaceRoot, query, trace) {
    const routed = await (0, routeIntent_js_1.routeIntent)(workspaceRoot, query);
    trace.push(traceStep('query_router', routed.intent));
    switch (routed.intent) {
        case 'action': {
            trace.push(traceStep('action_engine', 'derive'));
            const items = await (0, actionEngine_js_1.deriveNextActions)(workspaceRoot);
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
            const center = await (0, decisionCenter_js_1.getDecisionCenter)(workspaceRoot);
            const graph = await (0, decisionGraph_js_1.readDecisionGraph)(workspaceRoot);
            const needle = routed.topic?.toLowerCase();
            if (needle && (/^why not|why wasn't|why isn't/i.test(query.toLowerCase()) || needle.length > 2)) {
                const resolved = (0, decisionLifecycle_js_1.resolveDecisionByTopic)(center.decisions, needle || query);
                if (resolved.adr) {
                    return {
                        intent: 'decision',
                        result: {
                            answer: resolved.answer,
                            decision: resolved.adr.title,
                            why: resolved.adr.reason,
                            date: resolved.adr.date,
                            chain: resolved.chain,
                            confidence: (0, confidenceLabels_js_1.freshnessLabelText)(resolved.adr.freshness),
                        },
                        trace,
                    };
                }
            }
            const match = needle
                ? center.decisions.find((d) => d.title.toLowerCase().includes(needle) ||
                    d.reason.toLowerCase().includes(needle))
                : center.decisions[0];
            if (match) {
                return {
                    intent: 'decision',
                    result: {
                        answer: `${match.title}: ${match.reason}`,
                        decision: match.title,
                        why: match.reason,
                        date: match.date,
                        confidence: (0, confidenceLabels_js_1.freshnessLabelText)(match.freshness),
                        graph_nodes: graph?.nodes.length ?? 0,
                    },
                    trace,
                };
            }
            const events = await (0, eventStore_js_1.readAllCognitiveEvents)(workspaceRoot);
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
                const replay = await (0, handoffReplay_js_1.buildHandoffReplay)(workspaceRoot);
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
                const mod = await (0, moduleHistory_js_1.exploreModuleHistory)(workspaceRoot, routed.topic);
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
            const history = await (0, historyExplorer_js_1.exploreHistory)(workspaceRoot, routed.range ?? 'last_7_days');
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
                const travel = await (0, timeTravel_js_1.queryTimeTravel)(workspaceRoot, dateMatch[0], {
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
                (0, bootstrapState_js_1.readStateJson)(workspaceRoot),
                (0, intentVNext_js_1.readIntentGraphVNext)(workspaceRoot),
            ]);
            if (routed.topic === 'health') {
                trace.push(traceStep('cognitive_health', 'read'));
                const health = await (0, cognitiveHealth_js_1.persistCognitiveHealth)(workspaceRoot);
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
            const story = await (0, index_js_1.generateStoryWithAi)(workspaceRoot);
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
            const travel = await (0, timeTravel_js_1.queryTimeTravel)(workspaceRoot, date, {
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
            const entity = await (0, knowledgeGraph_js_1.exploreEntityKnowledge)(workspaceRoot, topic);
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
                const journey = await (0, journeyBuilder_js_1.buildProjectJourney)(workspaceRoot);
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
                const blast = await (0, impactExplorer_js_1.getBlastRadius)(workspaceRoot, routed.topic);
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
            const recent = await (0, historyExplorer_js_1.getRecentEvents)(workspaceRoot, 5);
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
async function runCognitiveKernel(workspaceRoot, input, writer = 'cli') {
    const trace = [traceStep('kernel', input.mode)];
    if (input.mode === 'sync') {
        trace.push(traceStep('event_engine', 'sync'));
        const events = await (0, eventEngine_js_1.syncCognitiveEvents)(workspaceRoot, writer);
        trace.push(traceStep('decision_engine', 'sync'));
        const adrs = await (0, eventEngine_js_1.syncDecisionCenter)(workspaceRoot);
        trace.push(traceStep('snapshot_engine', 'write'));
        await (0, snapshotEngine_js_1.writeProjectSnapshot)(workspaceRoot, events, adrs).catch(() => undefined);
        trace.push(traceStep('module_projection', 'sync'));
        await (0, moduleHistory_js_1.syncModuleHistory)(workspaceRoot, events).catch(() => undefined);
        trace.push(traceStep('decision_graph', 'persist'));
        await (0, decisionGraph_js_1.persistDecisionGraph)(workspaceRoot, adrs).catch(() => undefined);
        trace.push(traceStep('knowledge_graph', 'sync'));
        const snapshots = await (0, snapshotEngine_js_1.listProjectSnapshots)(workspaceRoot).catch(() => []);
        await (0, knowledgeGraph_js_1.syncKnowledgeGraph)(workspaceRoot, events, adrs, snapshots).catch(() => undefined);
        trace.push(traceStep('cognitive_health', 'compute'));
        await (0, cognitiveHealth_js_1.persistCognitiveHealth)(workspaceRoot).catch(() => undefined);
        await (0, eventStore_js_1.persistCilIndex)(workspaceRoot, events.map((e) => e.id), adrs.map((a) => a.id));
        return { intent: 'sync', result: { events, adrs, event_count: events.length }, trace };
    }
    if (input.mode === 'next') {
        trace.push(traceStep('action_engine', 'derive'));
        const items = await (0, actionEngine_js_1.deriveNextActions)(workspaceRoot);
        return { intent: 'action', result: { items, next_actions: items }, trace };
    }
    if (input.mode === 'story') {
        trace.push(traceStep('narrative_layer', 'story_readonly'));
        const story = await (0, index_js_1.generateStoryWithAi)(workspaceRoot);
        if (story.llm_enhanced) {
            trace.push(traceStep('ai_layer', 'story'));
        }
        return { intent: 'story', result: story, trace };
    }
    if (input.mode === 'history') {
        trace.push(traceStep('event_engine', 'history'));
        const history = await (0, historyExplorer_js_1.exploreHistory)(workspaceRoot, input.range ?? 'last_7_days');
        return { intent: 'history', result: history, trace };
    }
    if (input.mode === 'decisions') {
        trace.push(traceStep('decision_engine', 'center'));
        const center = await (0, decisionCenter_js_1.getDecisionCenter)(workspaceRoot);
        const graph = await (0, decisionGraph_js_1.readDecisionGraph)(workspaceRoot);
        return { intent: 'decision', result: { ...center, graph }, trace };
    }
    if (input.mode === 'snapshot') {
        trace.push(traceStep('snapshot_engine', 'read'));
        if (input.topic) {
            const travel = await (0, timeTravel_js_1.queryTimeTravel)(workspaceRoot, input.topic, {
                perspective: input.perspective ?? 'historical',
            });
            return { intent: 'time_travel', result: travel, trace };
        }
        const snaps = await (0, snapshotEngine_js_1.listProjectSnapshots)(workspaceRoot);
        return { intent: 'state', result: { snapshots: snaps }, trace };
    }
    if (input.mode === 'health') {
        trace.push(traceStep('cognitive_health', 'read'));
        const health = await (0, cognitiveHealth_js_1.persistCognitiveHealth)(workspaceRoot);
        return { intent: 'state', result: health, trace };
    }
    if (input.mode === 'entity' && input.topic) {
        trace.push(traceStep('knowledge_graph', 'entity'));
        const entity = await (0, knowledgeGraph_js_1.exploreEntityKnowledge)(workspaceRoot, input.topic);
        return { intent: 'entity', result: entity, trace };
    }
    if (input.mode === 'essence') {
        trace.push(traceStep('memory_compression', 'essence'));
        const essence = await (0, index_js_1.generateEssenceWithAi)(workspaceRoot);
        if (essence.llm_enhanced) {
            trace.push(traceStep('ai_layer', 'essence'));
        }
        return { intent: 'story', result: essence, trace };
    }
    if (input.mode === 'replay') {
        trace.push(traceStep('handoff_replay', 'timeline'));
        const replay = await (0, handoffReplay_js_1.buildHandoffReplay)(workspaceRoot);
        return { intent: 'history', result: replay, trace };
    }
    if (input.mode === 'dna') {
        trace.push(traceStep('project_dna', 'build'));
        const dna = await (0, index_js_1.generateDnaWithAi)(workspaceRoot);
        if (dna.llm_enhanced) {
            trace.push(traceStep('ai_layer', 'dna'));
        }
        return { intent: 'story', result: dna, trace };
    }
    if (input.mode === 'questions') {
        trace.push(traceStep('suggested_questions', 'build'));
        const questions = await (0, suggestedQuestions_js_1.buildSuggestedQuestions)(workspaceRoot);
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
async function syncCognitiveInteractionLayer(workspaceRoot, writer = 'cli') {
    const out = await runCognitiveKernel(workspaceRoot, { mode: 'sync' }, writer);
    const result = out.result;
    return { events: result.events, adrs: result.adrs };
}
