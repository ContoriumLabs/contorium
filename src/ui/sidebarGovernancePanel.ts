import type { ControlCheckResult, GovernanceReviewArtifact, ReviewScopePreference } from '@contora/state-core';
import {
  buildGovernanceRulesLines,
  getGovernanceSummary,
  getRelevantGovernanceForFile,
  normalizeProtectedPathRules,
  readGovernanceReview,
  readUserRequestOverlay,
} from '@contora/state-core';

/** Governance status strip shown in sidebar (workflow: rules → review → export). */
export interface SidebarGovernanceStatus {
  active: boolean;
  constitutionLoaded: boolean;
  truthLoaded: boolean;
  identityLoaded: boolean;
  protectedPathCount: number;
  forbiddenRuleCount: number;
  protectedPaths: string[];
  forbiddenActions: string[];
  projectDirection: string;
  directionUpdatedAt?: number;
  activeFile?: string;
  review: GovernanceReviewArtifact | null;
  reviewFile: string;
  reviewRisk: string;
  reviewChangeType: string;
  reviewSeverity: string;
  reviewImpact: string;
  reviewConfidence: string;
  reviewProtected: string;
  reviewTruthImpact: string;
  reviewRecommendation: string;
  reviewReasonChain: string[];
  reviewSource: string;
  reviewTimestamp: string;
  reviewScopePreference: string;
  reviewScopeValue: ReviewScopePreference;
  reviewWhyChain: string[];
  injectionRules: string[];
  injectionTokenEstimate: number;
  injectPreview: string;
}

export interface GovernanceOverviewOverlay {
  kind: 'governance';
  constitutionLoaded: boolean;
  truthLoaded: boolean;
  identityLoaded: boolean;
  protectedPaths: string[];
  forbiddenActions: string[];
  principles: string[];
}

export type ChangeReviewOverlay = {
  kind: 'review';
  file: string;
  risk: string;
  governance: string;
  changeType: string;
  severity: string;
  impact: string;
  protectedPath: string;
  truthImpact: string;
  recommendation: string;
  action: string;
  reason: string;
  reasonChain: string[];
  allow: boolean;
  confidence?: number;
  reviewSource?: string;
  reviewTimestamp?: string;
};

function formatRecommendationLabel(rec: string): string {
  return rec.replace(/_/g, ' ');
}

function formatReviewFileLabel(review: GovernanceReviewArtifact | null, activeFile?: string): string {
  if (!review) {
    return activeFile ?? '—';
  }
  if (review.review_scope === 'git_staged' || review.review_source === 'git_staged') {
    const count = review.staged_files?.length ?? 0;
    if (count > 1) {
      return `git staged · ${review.file} (+${count - 1})`;
    }
    return `git staged · ${review.file}`;
  }
  if (review.review_scope === 'open_files') {
    return `open files · ${review.file}`;
  }
  if (review.review_scope === 'git_commit' || review.review_source === 'git_commit') {
    return `git commit · ${review.file}`;
  }
  return review.file;
}

export function formatReviewScopeLabel(scope: ReviewScopePreference): string {
  switch (scope) {
    case 'current_file':
      return 'Current file';
    case 'open_files':
      return 'Open files';
    case 'git_staged':
      return 'Git staged';
    case 'git_commit':
      return 'Git commit';
    default:
      return 'Auto (merge all)';
  }
}

export function formatWhyChainLine(line: string): string {
  const lower = line.toLowerCase();
  if (
    lower.startsWith('no ') ||
    lower.includes('no violation') ||
    lower.includes('no sensitive') ||
    lower.includes('not ')
  ) {
    return `✗ ${line}`;
  }
  return `✓ ${line}`;
}

export function buildWhyChainDisplay(chain: string[], max = 6): string[] {
  return chain.slice(0, max).map(formatWhyChainLine);
}

function formatReviewSourceLabel(source: GovernanceReviewArtifact['review_source']): string {
  switch (source) {
    case 'editor_diff':
      return 'Editor diff';
    case 'git_staged':
      return 'Git staged';
    case 'git_commit':
      return 'Git commit';
    default:
      return 'Static file';
  }
}

function formatReviewTimestamp(iso: string | undefined): string {
  if (!iso) {
    return '—';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString();
}

export async function buildSidebarGovernanceStatus(
  workspaceRoot: string,
  activeFile?: string,
  scopePreference: ReviewScopePreference = 'auto',
): Promise<SidebarGovernanceStatus> {
  const [summary, overlay, relevant, review, rulesLines] = await Promise.all([
    getGovernanceSummary(workspaceRoot),
    readUserRequestOverlay(workspaceRoot),
    getRelevantGovernanceForFile(workspaceRoot, activeFile),
    readGovernanceReview(workspaceRoot),
    buildGovernanceRulesLines(workspaceRoot, activeFile),
  ]);

  const liveReview = review;

  const injectionPreview = buildInjectionPreview(relevant.active, liveReview, activeFile, rulesLines);
  const protectedPaths = summary.constitution
    ? normalizeProtectedPathRules(summary.constitution.protected_paths).map((r) =>
        r.level !== 'high' ? `${r.path} (${r.level})` : r.path,
      )
    : [];

  return {
    active: summary.found,
    constitutionLoaded: Boolean(summary.constitution),
    truthLoaded: Boolean(summary.truth),
    identityLoaded: Boolean(summary.identity),
    protectedPathCount: summary.protected_path_count,
    forbiddenRuleCount: summary.constitution?.forbidden_actions.length ?? 0,
    protectedPaths,
    forbiddenActions: summary.constitution?.forbidden_actions ?? [],
    projectDirection: overlay?.goal?.trim() ?? '',
    directionUpdatedAt: overlay?.generatedAt,
    activeFile: relevant.activeFile ?? activeFile,
    review: liveReview,
    reviewFile: formatReviewFileLabel(liveReview, activeFile),
    reviewRisk: liveReview ? liveReview.risk.toUpperCase() : '—',
    reviewChangeType: liveReview ? liveReview.change_type : '—',
    reviewSeverity: liveReview ? liveReview.severity : '—',
    reviewImpact: liveReview ? liveReview.impact.toUpperCase() : '—',
    reviewConfidence: liveReview ? `${Math.round(liveReview.confidence * 100)}%` : '—',
    reviewProtected: liveReview ? (liveReview.protectedPath ? 'Yes' : 'No') : '—',
    reviewTruthImpact: liveReview ? (liveReview.truthImpact ? 'Yes' : 'No') : '—',
    reviewRecommendation: liveReview
      ? formatRecommendationLabel(liveReview.recommendation)
      : 'Run Review change or switch files',
    reviewReasonChain: liveReview?.reason_chain ?? [],
    reviewSource: liveReview ? formatReviewSourceLabel(liveReview.review_source) : '—',
    reviewTimestamp: liveReview ? formatReviewTimestamp(liveReview.review_timestamp) : '—',
    reviewScopePreference: formatReviewScopeLabel(scopePreference),
    reviewScopeValue: scopePreference,
    reviewWhyChain: liveReview ? buildWhyChainDisplay(liveReview.reason_chain) : [],
    injectionRules: rulesLines,
    injectionTokenEstimate: Math.max(1, Math.ceil(injectionPreview.length / 4)),
    injectPreview: injectionPreview,
  };
}

function buildInjectionPreview(
  active: boolean,
  review: GovernanceReviewArtifact | null,
  activeFile: string | undefined,
  rules: string[],
): string {
  if (!active) {
    return 'Governance not initialized';
  }
  const file = review?.file ?? activeFile ?? '(no file open)';
  if (review) {
    const scopeHint =
      review.review_scope === 'git_staged'
        ? ' · git staged scope'
        : review.review_scope === 'open_files'
          ? ' · open files scope'
          : review.review_scope === 'git_commit'
            ? ' · git commit scope'
            : '';
    return `${file} · Risk ${review.risk.toUpperCase()} · Impact ${review.impact}${scopeHint} · ${rules.length} rule(s) in export`;
  }
  return `${file} · ${rules.length} rule(s) will be included in Export AI context`;
}

export function formatGovernanceOverview(result: {
  governance: Awaited<ReturnType<typeof getGovernanceSummary>>;
}): GovernanceOverviewOverlay {
  const g = result.governance;
  const c = g.constitution;
  return {
    kind: 'governance',
    constitutionLoaded: Boolean(c),
    truthLoaded: Boolean(g.truth),
    identityLoaded: Boolean(g.identity),
    protectedPaths: c ? normalizeProtectedPathRules(c.protected_paths).map((r) => r.path) : [],
    forbiddenActions: c?.forbidden_actions ?? [],
    principles: c?.principles ?? [],
  };
}

export function formatReviewArtifactOverlay(artifact: GovernanceReviewArtifact): ChangeReviewOverlay {
  let governance = 'Pass';
  if (artifact.status === 'block') {
    governance = 'Blocked';
  } else if (artifact.status === 'warn') {
    governance = 'Warning';
  }
  return {
    kind: 'review',
    file: artifact.file,
    risk: artifact.risk.toUpperCase(),
    governance,
    changeType: artifact.change_type,
    severity: artifact.severity,
    impact: artifact.impact.toUpperCase(),
    protectedPath: artifact.protectedPath ? 'Yes' : 'No',
    truthImpact: artifact.truthImpact ? 'Yes' : 'No',
    recommendation: formatRecommendationLabel(artifact.recommendation),
    action: artifact.allow ? 'allow' : 'block',
    reason: artifact.reason,
    reasonChain: artifact.reason_chain ?? [],
    allow: artifact.allow,
    confidence: artifact.confidence,
    reviewSource: formatReviewSourceLabel(artifact.review_source),
    reviewTimestamp: formatReviewTimestamp(artifact.review_timestamp),
  };
}

export function formatChangeReview(result: ControlCheckResult, filePath: string): ChangeReviewOverlay {
  const guard = result.guard;
  const change = guard.change_analysis;
  return {
    kind: 'review',
    file: filePath,
    risk: (guard.governance_risk ?? 'low').toUpperCase(),
    governance: guard.action === 'block' ? 'Blocked' : guard.action === 'allow' ? 'Pass' : 'Warning',
    changeType: change?.change_type ?? 'unknown',
    severity: change?.severity ?? 'low',
    impact: (guard.governance_impact ?? 'none').toUpperCase(),
    protectedPath: (guard.detections ?? []).some((d) => d.type === 'protected_path') ? 'Yes' : 'No',
    truthImpact: (guard.detections ?? []).some(
      (d) => d.type === 'truth_registry' || d.type === 'hardcode_snippet' || d.type === 'hardcoded_value',
    )
      ? 'Yes'
      : 'No',
    recommendation: formatRecommendationLabel(guard.recommendation ?? 'review_before_commit'),
    action: guard.action ?? 'allow',
    reason: guard.reason ?? 'No governance violations detected',
    reasonChain: guard.reason_chain ?? [],
    allow: guard.allow !== false,
    confidence: guard.confidence,
  };
}
