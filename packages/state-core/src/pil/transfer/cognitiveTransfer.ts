import { readStateJson } from '../../bootstrap/bootstrapState.js';
import {
  buildGovernanceRulesLines,
  estimateTokens,
} from '../../governance/governanceReview.js';
import {
  getGovernanceSummary,
  normalizeProtectedPathRules,
} from '../../governance/governanceEngine.js';
import type { BootstrapStateJson } from '../../types.js';
import type { ProjectBuiltState } from '../../state-builder/types.js';
import type { HandoffArtifact } from '../../understanding/types.js';
import type { KnowledgeSnapshot } from '../../understanding/knowledgeGraph/types.js';
import { readProjectBuiltState } from '../../state-builder/store.js';
import { readHandoffArtifact } from '../../understanding/store.js';
import { readKnowledgeSnapshot } from '../../understanding/knowledgeGraph/store.js';
import { readConfidenceIndex } from '../../intelligence/dimensions/confidenceIndex.js';
import { readProjectEvolutionTimeline } from '../../intelligence/dimensions/projectTimeline.js';
import { readImpactGraph } from '../../intelligence/dimensions/impactGraph.js';
import { readDecisionProvenanceGraph } from '../../intelligence/decisionProvenance.js';
import { readIntentGraphVNext } from '../../intelligence/intentVNext.js';
import { readProjectIntelligenceHealth } from '../../intelligence/health/projectIntelligenceHealth.js';
import { readProvenanceChain } from '../../intelligence/systems/provenanceChain.js';
import { readEvolutionGraph } from '../../intelligence/systems/evolutionGraph.js';
import { readDecisionLog } from '../../intelligence/systems/decisionLog.js';
import { trimStringToTokenBudget } from './tokenBudget.js';

export { trimStringToTokenBudget };

/** v2.3 Transfer Context — target ~300–800 tokens. */
export const TRANSFER_CONTEXT_TOKEN_TARGET = 800;
export const FULL_INTELLIGENCE_TOKEN_TARGET = 8000;

export interface TransferContextSnapshot {
  focus: string;
  goal: string;
  stage: string;
  changes: string[];
  constraints: {
    protected: string[];
    rules: string[];
  };
  continuation: string[];
  confidence: number | null;
}

export type TransferExportMode = 'cognitive-snapshot' | 'full-intelligence';

export interface TransferExportInput {
  workspaceRoot: string;
  state?: BootstrapStateJson | null;
  handoff?: HandoffArtifact;
  builtState?: ProjectBuiltState;
  knowledgeSnapshot?: KnowledgeSnapshot;
  /** Legacy intent-graph text fallback (IDE-only graph). */
  legacyIntentText?: string;
}

function emptyBootstrapState(): BootstrapStateJson {
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

function oneLine(text: string | undefined | null, max = 120): string {
  const s = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!s) {
    return '—';
  }
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function basenameOf(rel: string): string {
  const parts = rel.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1]! : rel;
}

function uniqLines(lines: string[], max: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
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

function formatConfidence(score: number | null): string {
  if (score == null || !Number.isFinite(score)) {
    return '—';
  }
  if (score <= 1) {
    return score.toFixed(2);
  }
  return (score / 100).toFixed(2);
}

function section(title: string, body: string[]): string[] {
  return [`## ${title}`, ...(body.length ? body : ['—']), ''];
}

function bulletLines(items: string[], max: number): string[] {
  return items.slice(0, max).map((item) => `- ${item}`);
}

export async function loadTransferExportInput(workspaceRoot: string): Promise<TransferExportInput> {
  const [state, handoff, builtState, knowledgeSnapshot] = await Promise.all([
    readStateJson(workspaceRoot),
    readHandoffArtifact(workspaceRoot),
    readProjectBuiltState(workspaceRoot),
    readKnowledgeSnapshot(workspaceRoot),
  ]);
  return {
    workspaceRoot,
    state: state ?? emptyBootstrapState(),
    handoff,
    builtState,
    knowledgeSnapshot,
  };
}

export async function buildTransferContextSnapshot(
  input: TransferExportInput,
): Promise<TransferContextSnapshot> {
  const root = input.workspaceRoot;
  const state = input.state ?? emptyBootstrapState();
  const handoff = input.handoff;
  const built = input.builtState;

  const [confidence, timeline, govSummary, intentVNext] = await Promise.all([
    readConfidenceIndex(root),
    readProjectEvolutionTimeline(root),
    getGovernanceSummary(root),
    readIntentGraphVNext(root),
  ]);

  const focus = oneLine(state.currentTask, 160);
  const goal = oneLine(
    built?.project_goal ??
      intentVNext?.nodes[0]?.title ??
      intentVNext?.nodes[0]?.name ??
      input.legacyIntentText ??
      handoff?.goal,
    160,
  );
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

  const protectedPaths =
    govSummary?.constitution ?
      normalizeProtectedPathRules(govSummary.constitution.protected_paths)
        .map((r) => r.path)
        .slice(0, 3)
    : [];

  const govRules = (await buildGovernanceRulesLines(root, state.openFiles[0])).slice(0, 3);
  const identityConstraints = govSummary?.identity?.non_goals?.slice(0, 2) ?? [];
  const decisionConstraints =
    (await readDecisionLog(root))?.entries
      .slice(-2)
      .map((e) => e.selected)
      .filter(Boolean) ?? [];

  const rules = uniqLines([...govRules, ...identityConstraints, ...decisionConstraints], 5);

  const continuation = uniqLines(
    [
      ...(built?.next_actions ?? []),
      ...(handoff?.next_actions ?? []).map((a) => a.action || `${a.action}:${a.target}`),
    ],
    5,
  );

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

export function formatTransferContextMarkdown(snapshot: TransferContextSnapshot): string {
  const lines: string[] = ['# COGNITIVE SNAPSHOT', ''];

  lines.push('## CURRENT FOCUS', snapshot.focus, '');
  lines.push('## PROJECT', `Goal:`, snapshot.goal, `Stage:`, snapshot.stage, '');

  lines.push('## RECENT CHANGES');
  if (snapshot.changes.length) {
    for (const c of snapshot.changes) {
      lines.push(`- ${c}`);
    }
  } else {
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
  } else {
    lines.push('- (set Current focus to continue)');
  }
  lines.push('');

  lines.push('## CONFIDENCE', formatConfidence(snapshot.confidence));
  return lines.join('\n').trim();
}

export function formatTransferContextJson(snapshot: TransferContextSnapshot): string {
  return JSON.stringify(toTransferContextPayload(snapshot), null, 2);
}

export function toTransferContextPayload(snapshot: TransferContextSnapshot): {
  focus: string;
  goal: string;
  stage: string;
  changes: string[];
  constraints: string[];
  continuation: string[];
  confidence: number | null;
} {
  return {
    focus: snapshot.focus === '—' ? '' : snapshot.focus,
    goal: snapshot.goal === '—' ? '' : snapshot.goal,
    stage: snapshot.stage === '—' ? '' : snapshot.stage,
    changes: snapshot.changes,
    constraints: [...snapshot.constraints.protected, ...snapshot.constraints.rules],
    continuation: snapshot.continuation,
    confidence:
      snapshot.confidence == null ?
        null
      : snapshot.confidence <= 1 ?
        snapshot.confidence
      : snapshot.confidence / 100,
  };
}

export function finalizeTransferContextText(text: string, asJson: boolean): string {
  const budget = TRANSFER_CONTEXT_TOKEN_TARGET;
  if (estimateTokens(text) <= budget) {
    return text;
  }
  const trimmed = trimStringToTokenBudget(text, budget);
  if (asJson) {
    return trimmed;
  }
  return `${trimmed}\n\n<!-- trimmed to ~${budget} tokens -->`;
}

export async function buildFullIntelligenceMarkdown(input: TransferExportInput): Promise<string> {
  const root = input.workspaceRoot;
  const state = input.state ?? emptyBootstrapState();
  const handoff = input.handoff;
  const built = input.builtState;
  const kg = input.knowledgeSnapshot;

  const [
    health,
    confidence,
    timeline,
    impact,
    provenance,
    evolution,
    decisionGraph,
    intentVNext,
    decisionLog,
    govSummary,
  ] = await Promise.all([
    readProjectIntelligenceHealth(root),
    readConfidenceIndex(root),
    readProjectEvolutionTimeline(root),
    readImpactGraph(root),
    readProvenanceChain(root),
    readEvolutionGraph(root),
    readDecisionProvenanceGraph(root),
    readIntentGraphVNext(root),
    readDecisionLog(root),
    getGovernanceSummary(root),
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
    ...(await buildGovernanceRulesLines(root, state.openFiles[0])),
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

  const provenanceLines = (provenance?.entries ?? []).slice(0, 6).flatMap((entry) =>
    entry.chain.slice(0, 5).map((link) => `- ${link.layer} → ${link.entity_id}`),
  );

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
  if (estimateTokens(text) > FULL_INTELLIGENCE_TOKEN_TARGET) {
    text = trimStringToTokenBudget(text, FULL_INTELLIGENCE_TOKEN_TARGET);
    text += `\n\n<!-- trimmed to ~${FULL_INTELLIGENCE_TOKEN_TARGET} tokens -->`;
  }
  return text;
}

export function transferExportModeLabel(mode: TransferExportMode): string {
  return mode === 'full-intelligence' ? 'Transfer Intelligence' : 'Transfer Context';
}
