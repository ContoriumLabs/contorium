import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { GovernanceReviewArtifact } from './governanceReview.js';
import { readGovernanceReview } from './governanceReview.js';
import {
  appendDecisionProvenanceNode,
  deriveDecisionProvenanceNode,
} from '../intelligence/decisionProvenance.js';

export const GOVERNANCE_SCHEMA = 'governance.v1' as const;

export type GovernanceArtifactSource = 'ide' | 'cli' | 'mcp';
export type GovernanceDecisionAction = 'allow' | 'warn' | 'block' | 'inject_fix';
export type GovernanceCycleMode = 'strict' | 'soft' | 'advisory';

/** Unified header on every governance artifact. */
export interface GovernanceArtifactHeader {
  schema: typeof GOVERNANCE_SCHEMA;
  source: GovernanceArtifactSource;
  created_at: string;
}

export interface GovernanceScopeMap {
  primary_files: string[];
  related_files: string[];
  risk_files: string[];
  dependency_files: string[];
}

/** Result only — no scope duplication; rule details live on cycle.matched_rules. */
export interface GovernanceDecisionArtifact extends GovernanceArtifactHeader {
  allow: boolean;
  /** Normalized 0–1 risk (from display_score / 100). */
  risk: number;
  decision: GovernanceDecisionAction;
  mode_label: string;
  rule_count: number;
  recommendation: string;
}

export interface GovernanceScopeFiles {
  primary: string[];
  related: string[];
  risk: string[];
}

/** Context only — no decision fields. */
export interface GovernanceScopeArtifact extends GovernanceArtifactHeader {
  files: GovernanceScopeFiles;
  modules: string[];
  dependencies: string[];
}

/** Dashboard / export read this (bounded). */
export interface GovernanceTraceSummaryArtifact extends GovernanceArtifactHeader {
  steps: string[];
  step_count: number;
}

/** Optional detailed trace — capped; overwritten each cycle. */
export interface GovernanceTraceFullArtifact extends GovernanceArtifactHeader {
  steps: string[];
  reason_chain: string[];
  events: string[];
}

/** Governance cycle runtime record — refs + extension slots for V5. */
export interface GovernanceCycleArtifact extends GovernanceArtifactHeader {
  started_at: string;
  finished_at: string;
  decision: GovernanceDecisionAction;
  metrics: {
    risk_score?: number;
    confidence?: number;
    files_affected?: number;
  };
  votes: unknown[];
  matched_rules: string[];
  trace_ref: string;
  review_path: string;
  scope_ref: string;
  decision_ref: string;
  v4?: unknown;
}

export interface GovernanceArtifactBundle {
  review: GovernanceReviewArtifact | null;
  decision: GovernanceDecisionArtifact | null;
  scope: GovernanceScopeArtifact | null;
  trace: GovernanceTraceSummaryArtifact | null;
  cycle: GovernanceCycleArtifact | null;
}

export interface GovernanceDashboardSnapshot {
  review: GovernanceReviewArtifact | null;
  scope: GovernanceScopeMap;
  scope_full: GovernanceScopeMap;
  decision_action: GovernanceDecisionAction | '—';
  risk_score: number;
  mode_label: string;
  rule_count: number;
  files_affected: number;
}

const GOVERNANCE_SUBDIR = '.contora/governance';
const LEGACY_CYCLE = '.contora/mcp/governance-cycle.json';
const TRACE_SUMMARY_MAX = 12;
const TRACE_FULL_MAX = 64;

function governanceDir(workspaceRoot: string): string {
  return path.join(path.resolve(workspaceRoot), '.contora', 'governance');
}

function norm(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

function uniq(paths: string[]): string[] {
  return [...new Set(paths.map(norm).filter(Boolean))];
}

function header(source: GovernanceArtifactSource, at = Date.now()): GovernanceArtifactHeader {
  return {
    schema: GOVERNANCE_SCHEMA,
    source,
    created_at: new Date(at).toISOString(),
  };
}

function riskNormalized(displayScore: number): number {
  if (displayScore <= 0) {
    return 0;
  }
  return Math.min(1, displayScore / 100);
}

function riskScoreLabel(score: number): string {
  if (score <= 0) {
    return '—';
  }
  return (score / 100).toFixed(2);
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/** Validate artifact header schema — no separate schema.json manifest. */
export function validateArtifactSchema(
  artifact: unknown,
  expected: typeof GOVERNANCE_SCHEMA = GOVERNANCE_SCHEMA,
): artifact is GovernanceArtifactHeader {
  if (!artifact || typeof artifact !== 'object') {
    return false;
  }
  const schema = (artifact as { schema?: string }).schema;
  return schema === expected;
}

function ruleCountFromBundle(
  decision: GovernanceDecisionArtifact | null,
  cycle: GovernanceCycleArtifact | null,
  review: GovernanceReviewArtifact | null,
): number {
  if (typeof decision?.rule_count === 'number') {
    return decision.rule_count;
  }
  if (cycle?.matched_rules?.length) {
    return cycle.matched_rules.length;
  }
  return review?.reason_chain?.length ?? 0;
}

export function governanceModeLabel(review: GovernanceReviewArtifact | null): string {
  if (!review) {
    return 'ADVISORY';
  }
  if (review.review_scope === 'git_staged') {
    return 'GIT STAGED';
  }
  if (review.review_scope === 'git_commit') {
    return 'GIT COMMIT';
  }
  if (review.review_scope === 'open_files') {
    return 'OPEN FILES';
  }
  return 'SOFT';
}

export function mapGovernanceDecisionAction(
  review: GovernanceReviewArtifact | null,
  mode: GovernanceCycleMode = 'soft',
): GovernanceDecisionAction {
  if (!review) {
    return 'allow';
  }
  if (mode === 'advisory') {
    if (review.risk === 'critical' || review.risk === 'high') {
      return 'inject_fix';
    }
    if (review.risk === 'medium') {
      return 'warn';
    }
    return 'allow';
  }
  if (!review.allow || review.status === 'block') {
    return 'block';
  }
  if (review.risk === 'critical' || review.risk === 'high') {
    return mode === 'strict' ? 'block' : 'inject_fix';
  }
  if (review.risk === 'medium' || review.status === 'warn') {
    return 'warn';
  }
  return 'allow';
}

export function buildGovernanceScopeFromReview(
  review: GovernanceReviewArtifact | null,
  extra?: Partial<GovernanceScopeMap>,
  openFiles?: string[],
): GovernanceScopeMap {
  const primary: string[] = [...(extra?.primary_files ?? [])];
  const related: string[] = [...(extra?.related_files ?? [])];
  const risk: string[] = [...(extra?.risk_files ?? [])];
  const dependency: string[] = [...(extra?.dependency_files ?? [])];

  if (review?.file) {
    const f = norm(review.file);
    if (!primary.includes(f)) {
      primary.unshift(f);
    }
    if (review.protectedPath && !risk.includes(f)) {
      risk.push(f);
    }
  }

  if (review?.staged_files?.length) {
    for (const f of review.staged_files) {
      const n = norm(f);
      if (!primary.includes(n) && !related.includes(n)) {
        related.push(n);
      }
    }
  }

  for (const f of openFiles ?? []) {
    const n = norm(f);
    if (!primary.includes(n) && !related.includes(n)) {
      related.push(n);
    }
  }

  const primaryFull = uniq(primary);
  return {
    primary_files: primaryFull,
    related_files: uniq(related).filter((f) => !primaryFull.includes(f)),
    risk_files: uniq(risk),
    dependency_files: uniq(dependency),
  };
}

export function scopeMapToArtifact(
  source: GovernanceArtifactSource,
  map: GovernanceScopeMap,
  at = Date.now(),
): GovernanceScopeArtifact {
  return {
    ...header(source, at),
    files: {
      primary: map.primary_files,
      related: map.related_files,
      risk: map.risk_files,
    },
    modules: [],
    dependencies: map.dependency_files,
  };
}

export function scopeArtifactToMap(scope: GovernanceScopeArtifact | null): GovernanceScopeMap {
  if (!scope) {
    return { primary_files: [], related_files: [], risk_files: [], dependency_files: [] };
  }
  if ('files' in scope && scope.files) {
    return {
      primary_files: scope.files.primary ?? [],
      related_files: scope.files.related ?? [],
      risk_files: scope.files.risk ?? [],
      dependency_files: scope.dependencies ?? [],
    };
  }
  const legacy = scope as unknown as GovernanceScopeMap & GovernanceArtifactHeader;
  return {
    primary_files: legacy.primary_files ?? [],
    related_files: legacy.related_files ?? [],
    risk_files: legacy.risk_files ?? [],
    dependency_files: legacy.dependency_files ?? [],
  };
}

function countFilesAffected(scope: GovernanceScopeMap): number {
  return uniq([...scope.primary_files, ...scope.related_files, ...scope.risk_files]).length;
}

export function buildGovernanceTraceSteps(input: {
  review: GovernanceReviewArtifact | null;
  action: GovernanceDecisionAction;
  files_affected: number;
  rule_count: number;
  risk_score: number;
}): string[] {
  const injectRequired =
    Boolean(input.review?.recommendation.includes('inject')) || input.action === 'inject_fix';
  return [
    'diff / review ingested',
    `scope → ${input.files_affected} file(s)`,
    `rules → ${input.rule_count} reason(s)`,
    `risk engine → ${riskScoreLabel(input.risk_score)}`,
    `decision → ${input.action.toUpperCase()}`,
    injectRequired ? 'inject payload → YES' : 'inject payload → optional',
  ];
}

function normalizeDecision(raw: GovernanceDecisionArtifact | null): GovernanceDecisionArtifact | null {
  if (!raw) {
    return null;
  }
  const legacy = raw as GovernanceDecisionArtifact & {
    action?: GovernanceDecisionAction;
    risk_score?: number;
    rules_triggered?: number;
  };
  if (legacy.decision && typeof legacy.risk === 'number' && validateArtifactSchema(raw)) {
    return {
      ...raw,
      rule_count: raw.rule_count ?? legacy.rules_triggered ?? 0,
    };
  }
  return {
    ...header(raw.source ?? 'cli', Date.parse(raw.created_at) || Date.now()),
    allow: legacy.allow ?? true,
    risk: typeof legacy.risk === 'number' ? legacy.risk : riskNormalized(legacy.risk_score ?? 0),
    decision: legacy.decision ?? legacy.action ?? 'allow',
    mode_label: legacy.mode_label ?? 'SOFT',
    rule_count: legacy.rule_count ?? legacy.rules_triggered ?? 0,
    recommendation: legacy.recommendation ?? '',
  };
}

/**
 * Full governance cycle — writes decision, scope, trace, cycle (+ optional trace-full).
 * Review-only flows must NOT call this; use writeGovernanceReview only.
 */
export async function persistGovernanceCycleArtifacts(
  workspaceRoot: string,
  input: {
    source: GovernanceArtifactSource;
    review: GovernanceReviewArtifact | null;
    scope?: GovernanceScopeMap;
    decision_action?: GovernanceDecisionAction;
    cycle_mode?: GovernanceCycleMode;
    open_files?: string[];
    started_at?: number;
    v4_payload?: unknown;
  },
): Promise<GovernanceCycleArtifact | null> {
  const root = path.resolve(workspaceRoot);
  const review = input.review;
  if (!review) {
    return null;
  }

  const mode = input.cycle_mode ?? 'soft';
  const scopeMap = input.scope ?? buildGovernanceScopeFromReview(review, undefined, input.open_files);
  const action = input.decision_action ?? mapGovernanceDecisionAction(review, mode);
  const filesAffected = countFilesAffected(scopeMap) || 1;
  const ruleCount = review.reason_chain?.length ?? 0;
  const riskScore = review.display_score ?? 0;
  const started = input.started_at ?? Date.now();
  const finished = Date.now();
  const matchedRules = (review.reason_chain ?? []).slice(0, TRACE_FULL_MAX);

  const decision: GovernanceDecisionArtifact = {
    ...header(input.source, finished),
    allow: review.allow,
    risk: riskNormalized(riskScore),
    decision: action,
    mode_label: governanceModeLabel(review),
    rule_count: ruleCount,
    recommendation: review.recommendation,
  };

  const scope = scopeMapToArtifact(input.source, scopeMap, finished);
  const steps = buildGovernanceTraceSteps({
    review,
    action,
    files_affected: filesAffected,
    rule_count: ruleCount,
    risk_score: riskScore,
  });

  const traceSummary: GovernanceTraceSummaryArtifact = {
    ...header(input.source, finished),
    steps: steps.slice(0, TRACE_SUMMARY_MAX),
    step_count: steps.length,
  };

  const traceFull: GovernanceTraceFullArtifact = {
    ...header(input.source, finished),
    steps: steps.slice(0, TRACE_FULL_MAX),
    reason_chain: (review.reason_chain ?? []).slice(0, TRACE_FULL_MAX),
    events: [],
  };

  const cycle: GovernanceCycleArtifact = {
    ...header(input.source, finished),
    started_at: new Date(started).toISOString(),
    finished_at: new Date(finished).toISOString(),
    decision: action,
    metrics: {
      risk_score: riskScore,
      confidence: review.confidence,
      files_affected: filesAffected,
    },
    votes: [],
    matched_rules: matchedRules,
    trace_ref: 'trace.json',
    review_path: 'review.json',
    scope_ref: 'scope.json',
    decision_ref: 'decision.json',
    v4: input.v4_payload,
  };

  const dir = governanceDir(root);
  await Promise.all([
    writeJsonFile(path.join(dir, 'decision.json'), decision),
    writeJsonFile(path.join(dir, 'scope.json'), scope),
    writeJsonFile(path.join(dir, 'trace.json'), traceSummary),
    writeJsonFile(path.join(dir, 'trace-full.json'), traceFull),
    writeJsonFile(path.join(dir, 'cycle.json'), cycle),
  ]);

  const provenanceNode = deriveDecisionProvenanceNode({
    review,
    action,
    linked_intent: review.file.split('/')[0],
  });
  await appendDecisionProvenanceNode(root, provenanceNode).catch(() => undefined);

  return cycle;
}

/** @deprecated Use persistGovernanceCycleArtifacts — review-only must not call this. */
export async function persistGovernanceArtifacts(
  workspaceRoot: string,
  input: Parameters<typeof persistGovernanceCycleArtifacts>[1],
): Promise<GovernanceCycleArtifact | null> {
  return persistGovernanceCycleArtifacts(workspaceRoot, input);
}

export async function readGovernanceDecision(
  workspaceRoot: string,
): Promise<GovernanceDecisionArtifact | null> {
  const raw = await readJsonFile<GovernanceDecisionArtifact>(
    path.join(governanceDir(workspaceRoot), 'decision.json'),
  );
  return normalizeDecision(raw);
}

export async function readGovernanceScopeArtifact(
  workspaceRoot: string,
): Promise<GovernanceScopeArtifact | null> {
  const raw = await readJsonFile<GovernanceScopeArtifact>(
    path.join(governanceDir(workspaceRoot), 'scope.json'),
  );
  if (!raw) {
    return null;
  }
  if (raw.schema === GOVERNANCE_SCHEMA && raw.files) {
    return raw;
  }
  if (!validateArtifactSchema(raw) && !(raw as { primary_files?: string[] }).primary_files) {
    return null;
  }
  const map = scopeArtifactToMap(raw);
  return scopeMapToArtifact(raw.source ?? 'cli', map, Date.parse(raw.created_at) || Date.now());
}

export async function readGovernanceTraceSummary(
  workspaceRoot: string,
): Promise<GovernanceTraceSummaryArtifact | null> {
  const raw = await readJsonFile<GovernanceTraceSummaryArtifact & { steps?: string[] }>(
    path.join(governanceDir(workspaceRoot), 'trace.json'),
  );
  if (!raw) {
    return null;
  }
  if (raw.schema === GOVERNANCE_SCHEMA && typeof raw.step_count === 'number') {
    return raw;
  }
  const steps = raw.steps ?? [];
  if (!steps.length) {
    return null;
  }
  return {
    ...header((raw as { source?: GovernanceArtifactSource }).source ?? 'cli'),
    steps: steps.slice(0, TRACE_SUMMARY_MAX),
    step_count: steps.length,
  };
}

/** @deprecated Alias for readGovernanceTraceSummary */
export async function readGovernanceTrace(
  workspaceRoot: string,
): Promise<GovernanceTraceSummaryArtifact | null> {
  return readGovernanceTraceSummary(workspaceRoot);
}

async function readLegacyCycle(workspaceRoot: string): Promise<GovernanceCycleArtifact | null> {
  const legacy = await readJsonFile<{
    scope?: GovernanceScopeMap;
    decision?: { action?: GovernanceDecisionAction };
    metrics?: { display_score?: number };
  }>(path.join(path.resolve(workspaceRoot), LEGACY_CYCLE));

  if (!legacy) {
    return null;
  }

  const review = await readGovernanceReview(workspaceRoot);
  const action = legacy.decision?.action ?? mapGovernanceDecisionAction(review, 'soft');

  return {
    ...header('mcp'),
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    decision: action,
    metrics: {
      risk_score: review?.display_score ?? legacy.metrics?.display_score,
    },
    votes: [],
    matched_rules: review?.reason_chain?.slice(0, TRACE_SUMMARY_MAX) ?? [],
    trace_ref: 'trace.json',
    review_path: 'review.json',
    scope_ref: 'scope.json',
    decision_ref: 'decision.json',
    v4: legacy,
  };
}

export async function readGovernanceCycle(
  workspaceRoot: string,
): Promise<GovernanceCycleArtifact | null> {
  const current = await readJsonFile<GovernanceCycleArtifact>(
    path.join(governanceDir(workspaceRoot), 'cycle.json'),
  );
  if (current?.schema === GOVERNANCE_SCHEMA || validateArtifactSchema(current)) {
    return current;
  }
  if (current && 'review_path' in current) {
    return current;
  }
  return readLegacyCycle(workspaceRoot);
}

/** Single entry for all consumers (Dashboard, Export, IDE). */
export async function loadGovernanceArtifactBundle(
  workspaceRoot: string,
): Promise<GovernanceArtifactBundle> {
  const [review, decision, scope, trace, cycle] = await Promise.all([
    readGovernanceReview(workspaceRoot),
    readGovernanceDecision(workspaceRoot),
    readGovernanceScopeArtifact(workspaceRoot),
    readGovernanceTraceSummary(workspaceRoot),
    readGovernanceCycle(workspaceRoot),
  ]);

  return { review, decision, scope, trace, cycle };
}

function sliceScope(full: GovernanceScopeMap): GovernanceScopeMap {
  return {
    primary_files: full.primary_files.slice(0, 8),
    related_files: full.related_files.slice(0, 8),
    risk_files: full.risk_files.slice(0, 8),
    dependency_files: full.dependency_files.slice(0, 6),
  };
}

/** Dashboard snapshot — only via state-core bundle (no direct artifact dir reads in CLI). */
export async function loadGovernanceDashboardSnapshot(
  workspaceRoot: string,
): Promise<GovernanceDashboardSnapshot> {
  const bundle = await loadGovernanceArtifactBundle(workspaceRoot);
  const review = bundle.review;
  const scopeFull = scopeArtifactToMap(bundle.scope);
  if (!scopeFull.primary_files.length && !scopeFull.related_files.length && review) {
    Object.assign(scopeFull, buildGovernanceScopeFromReview(review));
  }

  const decision = bundle.decision;
  const action =
    decision?.decision ??
    bundle.cycle?.decision ??
    (review ? mapGovernanceDecisionAction(review, 'soft') : '—');

  const riskScore =
    (decision?.risk ?? 0) > 0
      ? Math.round(decision!.risk * 100)
      : review?.display_score ?? bundle.cycle?.metrics?.risk_score ?? 0;

  const filesAffected =
    bundle.cycle?.metrics?.files_affected ??
    (countFilesAffected(scopeFull) || (review ? 1 : 0));

  return {
    review,
    scope: sliceScope(scopeFull),
    scope_full: scopeFull,
    decision_action: action,
    risk_score: riskScore,
    mode_label: decision?.mode_label ?? governanceModeLabel(review),
    rule_count: ruleCountFromBundle(decision, bundle.cycle, review),
    files_affected: filesAffected || (review ? 1 : 0),
  };
}

function scopeListMd(label: string, files: string[]): string[] {
  const lines = [`### ${label}`, ''];
  if (!files.length) {
    lines.push('- (none)');
  } else {
    for (const f of files) {
      lines.push(`- ${f}`);
    }
  }
  return lines;
}

/** Markdown supplement — DECISION / SCOPE / TRACE (三端共用). */
export function buildGovernanceSupplement(bundle: GovernanceArtifactBundle): string {
  const review = bundle.review;
  const decision = bundle.decision;
  const scopeMap = scopeArtifactToMap(bundle.scope);
  const hasScope =
    scopeMap.primary_files.length +
      scopeMap.related_files.length +
      scopeMap.risk_files.length >
    0;

  if (!review && !decision) {
    return '';
  }

  const action =
    decision?.decision ??
    bundle.cycle?.decision ??
    mapGovernanceDecisionAction(review, 'soft');
  const modeLabel = decision?.mode_label ?? governanceModeLabel(review);
  const riskScore =
    (decision?.risk ?? 0) > 0
      ? Math.round(decision!.risk * 100)
      : review?.display_score ?? bundle.cycle?.metrics?.risk_score ?? 0;
  const ruleCount = ruleCountFromBundle(decision, bundle.cycle, review);
  const filesAffected =
    bundle.cycle?.metrics?.files_affected ??
    (countFilesAffected(hasScope ? scopeMap : buildGovernanceScopeFromReview(review)) ||
      (review ? 1 : 0));

  const effectiveScope = hasScope ? scopeMap : buildGovernanceScopeFromReview(review);
  const steps =
    bundle.trace?.steps ??
    buildGovernanceTraceSteps({
      review,
      action,
      files_affected: filesAffected,
      rule_count: ruleCount,
      risk_score: riskScore,
    });

  return [
    '',
    '## DECISION',
    '',
    `- action: ${action}`,
    `- allow: ${decision?.allow ?? review?.allow ?? true}`,
    `- risk: ${decision?.risk ?? riskNormalized(riskScore)}`,
    `- mode: ${modeLabel}`,
    `- files_affected: ${filesAffected}`,
    `- rule_count: ${ruleCount}`,
    '',
    '## SCOPE',
    '',
    ...scopeListMd('primary', effectiveScope.primary_files),
    '',
    ...scopeListMd('related', effectiveScope.related_files),
    '',
    ...scopeListMd('risk', effectiveScope.risk_files),
    '',
    ...scopeListMd('dependency', effectiveScope.dependency_files),
    '',
    '## TRACE',
    '',
    ...steps.slice(0, TRACE_SUMMARY_MAX).map((s, i) => `${i + 1}. ${s}`),
  ].join('\n');
}

export const GOVERNANCE_ARTIFACT_FILES = [
  'governance/review.json',
  'governance/decision.json',
  'governance/scope.json',
  'governance/trace.json',
  'governance/trace-full.json',
  'governance/decision_graph.json',
  'governance/cycle.json',
  'mcp/governance-cycle.json',
] as const;
