import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ChangeSeverity, ChangeType } from './changeAnalyzer.js';
import type { ControlCheckResult } from '../control-core/types.js';
import type { GovernanceImpact, GovernanceRisk } from './riskEngine.js';
import { getRelevantGovernanceForFile } from '../prompt-engine/governanceInject.js';

const GOVERNANCE_DIR = '.contora/governance';
const REVIEW_FILE = 'review.json';
const LEGACY_REVIEW_FILE = 'governance-review.json';

export type ReviewSource = 'editor_diff' | 'git_staged' | 'git_commit' | 'static_file';
export type ReviewScope = 'current_file' | 'open_files' | 'git_staged' | 'git_commit';

function primaryReviewPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, GOVERNANCE_DIR, REVIEW_FILE);
}

function legacyReviewPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, GOVERNANCE_DIR, LEGACY_REVIEW_FILE);
}

export interface BuildReviewOptions {
  reviewSource?: ReviewSource;
  reviewScope?: ReviewScope;
  stagedFiles?: string[];
}

export interface GovernanceReviewArtifact {
  version: 2;
  generatedAt: number;
  file: string;
  status: 'pass' | 'warn' | 'block';
  risk: GovernanceRisk;
  change_type: ChangeType;
  severity: ChangeSeverity;
  impact: GovernanceImpact;
  confidence: number;
  recommendation: string;
  reason: string;
  reason_chain: string[];
  allow: boolean;
  protectedPath: boolean;
  protectedLevel?: 'normal' | 'high' | 'critical';
  truthImpact: boolean;
  lines_added: number;
  lines_removed: number;
  /** Internal score for sorting/trends — not shown in UI. */
  display_score: number;
  review_source: ReviewSource;
  review_timestamp: string;
  review_scope: ReviewScope;
  staged_files?: string[];
  /** @deprecated Use display_score */
  score?: number;
}

export function buildGovernanceReviewArtifact(
  result: ControlCheckResult,
  filePath: string,
  opts?: BuildReviewOptions,
): GovernanceReviewArtifact {
  const guard = result.guard;
  const allow = guard.allow !== false;
  const risk = guard.governance_risk ?? mapLegacyRisk(guard.action, guard.risk_level);
  const change = guard.change_analysis;
  const display_score = guard.display_score ?? displayScoreForRisk(risk);
  const now = new Date().toISOString();

  let status: GovernanceReviewArtifact['status'] = 'pass';
  if (guard.action === 'block') {
    status = 'block';
  } else if (guard.action === 'confirm' || guard.action === 'warn' || risk !== 'low') {
    status = risk === 'low' && guard.action === 'allow' ? 'pass' : 'warn';
  }

  const protectedPath = (guard.detections ?? []).some((d) => d.type === 'protected_path');
  const truthImpact = (guard.detections ?? []).some(
    (d) => d.type === 'truth_registry' || d.type === 'hardcode_snippet' || d.type === 'hardcoded_value',
  );

  const artifact: GovernanceReviewArtifact = {
    version: 2,
    generatedAt: Date.now(),
    file: filePath.replace(/\\/g, '/'),
    status,
    risk,
    change_type: change?.change_type ?? 'unknown',
    severity: change?.severity ?? 'low',
    impact: guard.governance_impact ?? 'none',
    confidence: guard.confidence ?? 0.55,
    recommendation: guard.recommendation ?? 'review_before_commit',
    reason: guard.reason ?? 'No governance violations detected',
    reason_chain: guard.reason_chain ?? [guard.reason ?? 'Review complete'],
    allow,
    protectedPath,
    protectedLevel: parseProtectedLevel(guard.reason_chain ?? []),
    truthImpact,
    lines_added: change?.lines_added ?? 0,
    lines_removed: change?.lines_removed ?? 0,
    display_score,
    review_source: opts?.reviewSource ?? 'static_file',
    review_timestamp: now,
    review_scope: opts?.reviewScope ?? 'current_file',
  };
  if (opts?.stagedFiles?.length) {
    artifact.staged_files = opts.stagedFiles.map((f) => f.replace(/\\/g, '/'));
  }
  return artifact;
}

function mapLegacyRisk(action: string, riskLevel: string): GovernanceRisk {
  if (action === 'block') {
    return 'critical';
  }
  if (riskLevel === 'high') {
    return 'high';
  }
  if (riskLevel === 'medium') {
    return 'medium';
  }
  return 'low';
}

function displayScoreForRisk(risk: GovernanceRisk): number {
  switch (risk) {
    case 'low':
      return 88;
    case 'medium':
      return 72;
    case 'high':
      return 52;
    case 'critical':
      return 28;
  }
}

function parseProtectedLevel(chain: string[]): 'normal' | 'high' | 'critical' | undefined {
  if (chain.some((l) => l.includes('critical protected'))) {
    return 'critical';
  }
  if (chain.some((l) => l.toLowerCase().includes('protected path'))) {
    return 'high';
  }
  return undefined;
}

function normalizeReviewArtifact(
  parsed: GovernanceReviewArtifact & { version?: number; score?: number },
): GovernanceReviewArtifact {
  if (parsed.display_score == null && parsed.score != null) {
    parsed.display_score = parsed.score;
  }
  if (!parsed.impact) {
    parsed.impact = 'none';
  }
  if (!parsed.review_source) {
    parsed.review_source = 'static_file';
  }
  if (!parsed.review_scope) {
    parsed.review_scope = 'current_file';
  }
  if (!parsed.review_timestamp) {
    parsed.review_timestamp = new Date(parsed.generatedAt ?? Date.now()).toISOString();
  }
  return parsed;
}

export async function writeGovernanceReview(
  workspaceRoot: string,
  artifact: GovernanceReviewArtifact,
): Promise<void> {
  const target = primaryReviewPath(workspaceRoot);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const payload = { ...artifact, review_timestamp: artifact.review_timestamp || new Date().toISOString() };
  await fs.writeFile(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export async function readGovernanceReview(
  workspaceRoot: string,
): Promise<GovernanceReviewArtifact | null> {
  for (const target of [primaryReviewPath(workspaceRoot), legacyReviewPath(workspaceRoot)]) {
    try {
      const raw = await fs.readFile(target, 'utf8');
      const parsed = JSON.parse(raw) as GovernanceReviewArtifact & { version?: number; score?: number };
      if (!parsed || typeof parsed.file !== 'string') {
        continue;
      }
      if (parsed.version === 2) {
        return normalizeReviewArtifact(parsed);
      }
      const migrated = migrateV1Review(parsed as unknown as Record<string, unknown>);
      if (migrated) {
        return migrated;
      }
    } catch {
      /* try next path */
    }
  }
  return null;
}

function migrateV1Review(old: Record<string, unknown>): GovernanceReviewArtifact | null {
  if (typeof old.file !== 'string') {
    return null;
  }
  const riskRaw = String(old.risk ?? 'low');
  const risk: GovernanceRisk =
    riskRaw === 'critical' ? 'critical' : riskRaw === 'high' ? 'high' : riskRaw === 'medium' ? 'medium' : 'low';
  const display_score =
    typeof old.display_score === 'number'
      ? old.display_score
      : typeof old.score === 'number'
        ? old.score
        : displayScoreForRisk(risk);
  return {
    version: 2,
    generatedAt: typeof old.generatedAt === 'number' ? old.generatedAt : Date.now(),
    file: old.file,
    status: (old.status as GovernanceReviewArtifact['status']) ?? 'pass',
    risk,
    change_type: (old.change_type as ChangeType) ?? 'unknown',
    severity: (old.severity as ChangeSeverity) ?? 'low',
    impact: (old.impact as GovernanceImpact) ?? 'none',
    confidence: typeof old.confidence === 'number' ? old.confidence : 0.55,
    recommendation: String(old.recommendation ?? 'review_before_commit'),
    reason: String(old.reason ?? ''),
    reason_chain: Array.isArray(old.reason_chain)
      ? (old.reason_chain as string[])
      : [String(old.reason ?? 'Migrated review')],
    allow: old.allow !== false,
    protectedPath: Boolean(old.protectedPath),
    truthImpact: Boolean(old.truthImpact),
    lines_added: typeof old.lines_added === 'number' ? old.lines_added : 0,
    lines_removed: typeof old.lines_removed === 'number' ? old.lines_removed : 0,
    display_score,
    review_source: (old.review_source as ReviewSource) ?? 'static_file',
    review_timestamp:
      typeof old.review_timestamp === 'string'
        ? old.review_timestamp
        : new Date(typeof old.generatedAt === 'number' ? old.generatedAt : Date.now()).toISOString(),
    review_scope: (old.review_scope as ReviewScope) ?? 'current_file',
    staged_files: Array.isArray(old.staged_files) ? (old.staged_files as string[]) : undefined,
  };
}

export function formatReviewForInject(review: GovernanceReviewArtifact): string {
  const lines = [
    'Review Result:',
    '',
    `Risk: ${review.risk.toUpperCase()}`,
    `Impact: ${review.impact}`,
    `Change type: ${review.change_type}`,
    `Recommendation: ${review.recommendation.replace(/_/g, ' ')}`,
    '',
    'Reason:',
    ...review.reason_chain.slice(0, 8),
    '',
    'Follow governance rules before proposing edits.',
  ];
  if (review.staged_files?.length) {
    lines.splice(
      6,
      0,
      `Staged files (${review.staged_files.length}): ${review.staged_files.slice(0, 6).join(', ')}`,
    );
  }
  return lines.join('\n');
}

export function formatGovernanceReviewYaml(review: GovernanceReviewArtifact): string {
  return [
    'GOVERNANCE REVIEW:',
    '',
    `current_file: ${review.file}`,
    `review_source: ${review.review_source}`,
    `review_timestamp: ${review.review_timestamp}`,
    `review_scope: ${review.review_scope}`,
    `status: ${review.status}`,
    `risk: ${review.risk}`,
    `change_type: ${review.change_type}`,
    `severity: ${review.severity}`,
    `impact: ${review.impact}`,
    `confidence: ${review.confidence.toFixed(2)}`,
    `display_score: ${(review.display_score / 100).toFixed(2)}`,
    `allow: ${review.allow}`,
    `lines_added: ${review.lines_added}`,
    `lines_removed: ${review.lines_removed}`,
    `protected_path: ${review.protectedPath}`,
    `truth_impact: ${review.truthImpact}`,
    `recommendation: ${review.recommendation}`,
    `reason: ${review.reason}`,
    ...(review.staged_files?.length
      ? ['', 'staged_files:', ...review.staged_files.slice(0, 12).map((f) => `- ${f}`)]
      : []),
    ...(review.reason_chain.length
      ? ['', 'reason_chain:', ...review.reason_chain.map((l) => `- ${l}`)]
      : []),
  ].join('\n');
}

export async function buildGovernanceRulesLines(
  workspaceRoot: string,
  activeFile?: string,
): Promise<string[]> {
  const relevant = await getRelevantGovernanceForFile(workspaceRoot, activeFile);
  const lines: string[] = [];
  if (relevant.isProtected && relevant.matchedProtectedPath) {
    lines.push(`Core path protected: ${relevant.matchedProtectedPath}`);
  }
  for (const rule of relevant.aiRules.slice(0, 5)) {
    lines.push(rule);
  }
  for (const p of relevant.principles.slice(0, 3)) {
    lines.push(p);
  }
  if (lines.length === 0) {
    lines.push('No file-specific governance constraints');
  }
  return lines;
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export async function formatGovernanceExportSection(
  workspaceRoot: string,
  review: GovernanceReviewArtifact | null,
): Promise<string> {
  const relevant = await getRelevantGovernanceForFile(workspaceRoot, review?.file);
  const lines: string[] = ['GOVERNANCE:', ''];

  if (relevant.protectedPaths.length) {
    lines.push('Protected paths:');
    for (const p of relevant.protectedPaths.slice(0, 8)) {
      lines.push(`- ${p}`);
    }
    lines.push('');
  }

  if (relevant.aiRules.length) {
    lines.push('Rules:');
    for (const rule of relevant.aiRules.slice(0, 6)) {
      lines.push(`- ${rule}`);
    }
    lines.push('');
  }

  if (review) {
    lines.push(formatGovernanceReviewYaml(review));
    lines.push('');
    lines.push('CURRENT IMPACT:');
    lines.push(review.impact);
    lines.push('');
    lines.push('RECOMMENDATION:');
    lines.push(review.recommendation.replace(/_/g, ' '));
  } else {
    lines.push('CURRENT REVIEW:', '(not run — open a file and export again)');
  }

  return lines.join('\n');
}

/** @deprecated Use display_score on artifact — kept for callers expecting numeric helper. */
export function computeGovernanceScore(input: {
  risk: GovernanceRisk;
  protectedPath: boolean;
  truthImpact: boolean;
  allow: boolean;
}): number {
  void input.protectedPath;
  void input.truthImpact;
  void input.allow;
  return displayScoreForRisk(input.risk);
}
