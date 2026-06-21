"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FULL_INTELLIGENCE_TOKEN_TARGET = exports.TRANSFER_CONTEXT_TOKEN_TARGET = exports.trimStringToTokenBudget = void 0;
exports.loadTransferExportInput = loadTransferExportInput;
exports.buildTransferContextSnapshot = buildTransferContextSnapshot;
exports.formatTransferContextMarkdown = formatTransferContextMarkdown;
exports.formatTransferContextJson = formatTransferContextJson;
exports.toTransferContextPayload = toTransferContextPayload;
exports.finalizeTransferContextText = finalizeTransferContextText;
exports.buildFullIntelligenceMarkdown = buildFullIntelligenceMarkdown;
exports.transferExportModeLabel = transferExportModeLabel;
const bootstrapState_js_1 = require("../../bootstrap/bootstrapState.js");
const governanceReview_js_1 = require("../../governance/governanceReview.js");
const governanceEngine_js_1 = require("../../governance/governanceEngine.js");
const store_js_1 = require("../../state-builder/store.js");
const store_js_2 = require("../../understanding/store.js");
const store_js_3 = require("../../understanding/knowledgeGraph/store.js");
const confidenceIndex_js_1 = require("../../intelligence/dimensions/confidenceIndex.js");
const projectTimeline_js_1 = require("../../intelligence/dimensions/projectTimeline.js");
const impactGraph_js_1 = require("../../intelligence/dimensions/impactGraph.js");
const decisionProvenance_js_1 = require("../../intelligence/decisionProvenance.js");
const intentVNext_js_1 = require("../../intelligence/intentVNext.js");
const projectIntelligenceHealth_js_1 = require("../../intelligence/health/projectIntelligenceHealth.js");
const provenanceChain_js_1 = require("../../intelligence/systems/provenanceChain.js");
const evolutionGraph_js_1 = require("../../intelligence/systems/evolutionGraph.js");
const decisionLog_js_1 = require("../../intelligence/systems/decisionLog.js");
const tokenBudget_js_1 = require("./tokenBudget.js");
Object.defineProperty(exports, "trimStringToTokenBudget", { enumerable: true, get: function () { return tokenBudget_js_1.trimStringToTokenBudget; } });
/** v2.3 Transfer Context — target ~300–800 tokens. */
exports.TRANSFER_CONTEXT_TOKEN_TARGET = 800;
exports.FULL_INTELLIGENCE_TOKEN_TARGET = 8000;
function emptyBootstrapState() {
    return {
        sessionId: '',
        currentTask: '',
        openFiles: [],
        recentFiles: [],
        gitStaged: [],
        gitWorking: [],
        notes: '',
        lastUpdated: Date.now(),
    };
}
function oneLine(text, max = 120) {
    const s = (text ?? '').replace(/\s+/g, ' ').trim();
    if (!s) {
        return '—';
    }
    return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
function basenameOf(rel) {
    const parts = rel.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : rel;
}
function uniqLines(lines, max) {
    const out = [];
    const seen = new Set();
    for (const raw of lines) {
        const line = raw.trim();
        if (!line || line === '—' || seen.has(line.toLowerCase())) {
            continue;
        }
        seen.add(line.toLowerCase());
        out.push(line);
        if (out.length >= max) {
            break;
        }
    }
    return out;
}
function formatConfidence(score) {
    if (score == null || !Number.isFinite(score)) {
        return '—';
    }
    if (score <= 1) {
        return score.toFixed(2);
    }
    return (score / 100).toFixed(2);
}
function section(title, body) {
    return [`## ${title}`, ...(body.length ? body : ['—']), ''];
}
function bulletLines(items, max) {
    return items.slice(0, max).map((item) => `- ${item}`);
}
async function loadTransferExportInput(workspaceRoot) {
    const [state, handoff, builtState, knowledgeSnapshot] = await Promise.all([
        (0, bootstrapState_js_1.readStateJson)(workspaceRoot),
        (0, store_js_2.readHandoffArtifact)(workspaceRoot),
        (0, store_js_1.readProjectBuiltState)(workspaceRoot),
        (0, store_js_3.readKnowledgeSnapshot)(workspaceRoot),
    ]);
    return {
        workspaceRoot,
        state: state ?? emptyBootstrapState(),
        handoff,
        builtState,
        knowledgeSnapshot,
    };
}
async function buildTransferContextSnapshot(input) {
    const root = input.workspaceRoot;
    const state = input.state ?? emptyBootstrapState();
    const handoff = input.handoff;
    const built = input.builtState;
    const [confidence, timeline, govSummary, intentVNext] = await Promise.all([
        (0, confidenceIndex_js_1.readConfidenceIndex)(root),
        (0, projectTimeline_js_1.readProjectEvolutionTimeline)(root),
        (0, governanceEngine_js_1.getGovernanceSummary)(root),
        (0, intentVNext_js_1.readIntentGraphVNext)(root),
    ]);
    const focus = oneLine(state.currentTask, 160);
    const goal = oneLine(built?.project_goal ??
        intentVNext?.nodes[0]?.title ??
        intentVNext?.nodes[0]?.name ??
        input.legacyIntentText ??
        handoff?.goal, 160);
    const stage = oneLine(built?.current_stage ?? handoff?.summary?.slice(0, 80), 120);
    const timelineLines = [...(timeline?.events ?? [])]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5)
        .map((e) => `${e.event_type}: ${basenameOf(e.entity_id)}`);
    const handoffChanges = (handoff?.key_changes ?? []).slice(0, 5).map((k) => {
        const sym = k.symbol.includes('/') || k.symbol.includes('\\') ? basenameOf(k.symbol) : k.symbol;
        return `${k.change_type} ${sym}`;
    });
    const gitLines = [
        ...state.gitStaged.slice(0, 3).map((p) => `Staged ${basenameOf(p)}`),
        ...state.gitWorking.slice(0, 3).map((p) => `Modified ${basenameOf(p)}`),
    ];
    const changes = uniqLines([...timelineLines, ...handoffChanges, ...gitLines], 10);
    const protectedPaths = govSummary?.constitution ?
        (0, governanceEngine_js_1.normalizeProtectedPathRules)(govSummary.constitution.protected_paths)
            .map((r) => r.path)
            .slice(0, 3)
        : [];
    const govRules = (await (0, governanceReview_js_1.buildGovernanceRulesLines)(root, state.openFiles[0])).slice(0, 3);
    const identityConstraints = govSummary?.identity?.non_goals?.slice(0, 2) ?? [];
    const decisionConstraints = (await (0, decisionLog_js_1.readDecisionLog)(root))?.entries
        .slice(-2)
        .map((e) => e.selected)
        .filter(Boolean) ?? [];
    const rules = uniqLines([...govRules, ...identityConstraints, ...decisionConstraints], 5);
    const continuation = uniqLines([
        ...(built?.next_actions ?? []),
        ...(handoff?.next_actions ?? []).map((a) => a.action || `${a.action}:${a.target}`),
    ], 5);
    const projectConf = confidence?.entities.find((e) => e.entity_id === 'project');
    return {
        focus,
        goal,
        stage,
        changes,
        constraints: { protected: protectedPaths, rules },
        continuation,
        confidence: projectConf?.confidence_score ?? null,
    };
}
function formatTransferContextMarkdown(snapshot) {
    const lines = ['# COGNITIVE SNAPSHOT', ''];
    lines.push('## CURRENT FOCUS', snapshot.focus, '');
    lines.push('## PROJECT', `Goal:`, snapshot.goal, `Stage:`, snapshot.stage, '');
    lines.push('## RECENT CHANGES');
    if (snapshot.changes.length) {
        for (const c of snapshot.changes) {
            lines.push(`- ${c}`);
        }
    }
    else {
        lines.push('- (no recent changes recorded)');
    }
    lines.push('');
    lines.push('## CONSTRAINTS');
    if (snapshot.constraints.protected.length) {
        lines.push('Protected:');
        for (const p of snapshot.constraints.protected) {
            lines.push(`- ${p}`);
        }
    }
    if (snapshot.constraints.rules.length) {
        lines.push('Constraints:');
        for (const r of snapshot.constraints.rules) {
            lines.push(`- ${r}`);
        }
    }
    if (!snapshot.constraints.protected.length && !snapshot.constraints.rules.length) {
        lines.push('- (none recorded)');
    }
    lines.push('');
    lines.push('## CONTINUATION');
    if (snapshot.continuation.length) {
        for (const step of snapshot.continuation) {
            lines.push(`- ${step}`);
        }
    }
    else {
        lines.push('- (set Current focus to continue)');
    }
    lines.push('');
    lines.push('## CONFIDENCE', formatConfidence(snapshot.confidence));
    return lines.join('\n').trim();
}
function formatTransferContextJson(snapshot) {
    return JSON.stringify(toTransferContextPayload(snapshot), null, 2);
}
function toTransferContextPayload(snapshot) {
    return {
        focus: snapshot.focus === '—' ? '' : snapshot.focus,
        goal: snapshot.goal === '—' ? '' : snapshot.goal,
        stage: snapshot.stage === '—' ? '' : snapshot.stage,
        changes: snapshot.changes,
        constraints: [...snapshot.constraints.protected, ...snapshot.constraints.rules],
        continuation: snapshot.continuation,
        confidence: snapshot.confidence == null ?
            null
            : snapshot.confidence <= 1 ?
                snapshot.confidence
                : snapshot.confidence / 100,
    };
}
function finalizeTransferContextText(text, asJson) {
    const budget = exports.TRANSFER_CONTEXT_TOKEN_TARGET;
    if ((0, governanceReview_js_1.estimateTokens)(text) <= budget) {
        return text;
    }
    const trimmed = (0, tokenBudget_js_1.trimStringToTokenBudget)(text, budget);
    if (asJson) {
        return trimmed;
    }
    return `${trimmed}\n\n<!-- trimmed to ~${budget} tokens -->`;
}
async function buildFullIntelligenceMarkdown(input) {
    const root = input.workspaceRoot;
    const state = input.state ?? emptyBootstrapState();
    const handoff = input.handoff;
    const built = input.builtState;
    const kg = input.knowledgeSnapshot;
    const [health, confidence, timeline, impact, provenance, evolution, decisionGraph, intentVNext, decisionLog, govSummary,] = await Promise.all([
        (0, projectIntelligenceHealth_js_1.readProjectIntelligenceHealth)(root),
        (0, confidenceIndex_js_1.readConfidenceIndex)(root),
        (0, projectTimeline_js_1.readProjectEvolutionTimeline)(root),
        (0, impactGraph_js_1.readImpactGraph)(root),
        (0, provenanceChain_js_1.readProvenanceChain)(root),
        (0, evolutionGraph_js_1.readEvolutionGraph)(root),
        (0, decisionProvenance_js_1.readDecisionProvenanceGraph)(root),
        (0, intentVNext_js_1.readIntentGraphVNext)(root),
        (0, decisionLog_js_1.readDecisionLog)(root),
        (0, governanceEngine_js_1.getGovernanceSummary)(root),
    ]);
    const stateLines = [
        `Focus: ${oneLine(state.currentTask)}`,
        `Stage: ${oneLine(built?.current_stage)}`,
        `Open files: ${state.openFiles.slice(0, 5).map(basenameOf).join(', ') || '—'}`,
        `Session: ${state.sessionId ?? '—'}`,
    ];
    const intentLines = [
        `Project intent: ${oneLine(intentVNext?.nodes[0]?.title ?? input.legacyIntentText ?? handoff?.goal)}`,
        ...(intentVNext?.nodes ?? []).slice(0, 6).map((n) => `- ${n.name ?? n.title ?? n.intent_id}`),
    ];
    const decisionLines = [
        ...(decisionGraph?.nodes ?? []).slice(-6).map((n) => `- ${n.selected ?? n.decision_id}`),
        ...(decisionLog?.entries ?? []).slice(-4).map((e) => `- ${e.decision_id}: ${e.selected}`),
    ];
    const whyLines = [
        ...(await (0, governanceReview_js_1.buildGovernanceRulesLines)(root, state.openFiles[0])),
        ...(govSummary?.identity?.non_goals ?? []).slice(0, 4),
    ].filter(Boolean);
    const timelineLines = [...(timeline?.events ?? [])]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 12)
        .map((e) => `- ${e.timestamp}: ${e.event_type} · ${e.entity_id}`);
    const impactLines = (impact?.entries ?? []).slice(-8).map((e) => {
        const radius = e.impact_radius ?? e.blast_radius;
        return `- ${e.source_entity}${radius != null ? ` (radius ${radius})` : ''}`;
    });
    const evolutionLines = (evolution?.chains ?? []).slice(0, 4).flatMap((chain) => [
        `- ${chain.topic}: ${chain.nodes.map((n) => n.label).join(' → ')}`,
    ]);
    const provenanceLines = (provenance?.entries ?? []).slice(0, 6).flatMap((entry) => entry.chain.slice(0, 5).map((link) => `- ${link.layer} → ${link.entity_id}`));
    const healthScore = health?.metrics.health_score;
    const healthLines = [
        healthScore != null ?
            `Health: ${Math.round(healthScore * 100)}% (${health?.metrics.health_category ?? '—'})`
            : 'Health: —',
        health?.metrics.knowledge_coverage != null ?
            `Knowledge coverage: ${Math.round(health.metrics.knowledge_coverage * 100)}%`
            : '',
        ...(confidence?.entities ?? []).slice(0, 5).map((e) => `- ${e.entity_id}: ${formatConfidence(e.confidence_score ?? null)}`),
    ].filter(Boolean);
    const kgLines = [
        ...(kg?.topIntents ?? []).slice(0, 6).map((i) => `- intent: ${i}`),
        ...(kg?.topHotspots ?? []).slice(0, 6).map((h) => `- hotspot: ${h}`),
        ...(kg?.nextActions ?? []).slice(0, 4).map((a) => `- next: ${a}`),
        kg?.graphSummary ?
            `- graph: ${kg.graphSummary.nodeCount} nodes · avg conf ${kg.graphSummary.avgConfidence.toFixed(2)}`
            : '',
    ].filter(Boolean);
    const parts = [
        '# FULL INTELLIGENCE EXPORT',
        '',
        ...section('STATE', stateLines),
        ...section('INTENT', intentLines),
        ...section('DECISION', decisionLines.length ? decisionLines : ['—']),
        ...section('WHY', whyLines.length ? bulletLines(whyLines, 8) : ['—']),
        ...section('TIMELINE', timelineLines.length ? timelineLines : ['—']),
        ...section('IMPACT', impactLines.length ? impactLines : ['—']),
        ...section('EVOLUTION', evolutionLines.length ? evolutionLines : ['—']),
        ...section('PROVENANCE', provenanceLines.length ? provenanceLines : ['—']),
        ...section('HEALTH', healthLines),
        ...section('KNOWLEDGE GRAPH', kgLines.length ? kgLines : ['—']),
    ];
    let text = parts.join('\n').trim();
    if ((0, governanceReview_js_1.estimateTokens)(text) > exports.FULL_INTELLIGENCE_TOKEN_TARGET) {
        text = (0, tokenBudget_js_1.trimStringToTokenBudget)(text, exports.FULL_INTELLIGENCE_TOKEN_TARGET);
        text += `\n\n<!-- trimmed to ~${exports.FULL_INTELLIGENCE_TOKEN_TARGET} tokens -->`;
    }
    return text;
}
function transferExportModeLabel(mode) {
    return mode === 'full-intelligence' ? 'Transfer Intelligence' : 'Transfer Context';
}
