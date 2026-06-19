import { analyzeChange } from './changeAnalyzer.js';
import { detectHardcodingInSnippet } from './hardcodeDetector.js';
import {
  loadGovernanceBundle,
  matchProtectedPath,
  scanForbiddenPatterns,
  validateActionWithBundle,
} from './governanceEngine.js';
import { computeGovernanceRisk } from './riskEngine.js';
import type {
  ExecutionGuardResult,
  GuardAction,
  GuardDetection,
  PreActionCheckInput,
  ProtectedPathLevel,
  RiskSeverity,
} from './types.js';

function validationToDetections(
  matched_rules: string[] | undefined,
  reason: string,
): GuardDetection[] {
  if (!matched_rules?.length) {
    return [];
  }
  return matched_rules.map((rule) => {
    let type: GuardDetection['type'] = 'change_analysis';
    let severity: RiskSeverity = 'medium';
    if (rule.startsWith('protected_paths:')) {
      type = 'protected_path';
      severity = rule.includes(':critical') ? 'high' : 'medium';
    } else if (rule.startsWith('forbidden_patterns:')) {
      type = 'forbidden_pattern';
      severity = 'high';
    } else if (rule.startsWith('truth:sensitive:') || rule.startsWith('truth:hardcoded:')) {
      type = 'truth_registry';
      severity = 'high';
    } else if (rule.startsWith('truth:')) {
      type = 'truth_registry';
      severity = 'low';
    }
    return { type, detail: reason, severity };
  });
}

function riskToGuardAction(
  risk: import('./riskEngine.js').GovernanceRisk,
  userConfirmed: boolean,
): { action: GuardAction; allow: boolean; risk_level: RiskSeverity } {
  switch (risk) {
    case 'critical':
      return userConfirmed
        ? { action: 'warn', allow: true, risk_level: 'high' }
        : { action: 'block', allow: false, risk_level: 'high' };
    case 'high':
      return userConfirmed
        ? { action: 'warn', allow: true, risk_level: 'high' }
        : { action: 'confirm', allow: false, risk_level: 'high' };
    case 'medium':
      return { action: 'warn', allow: true, risk_level: 'medium' };
    default:
      return { action: 'allow', allow: true, risk_level: 'low' };
  }
}

function suggestionFor(recommendation: string): string {
  switch (recommendation) {
    case 'safe_to_modify':
      return 'Safe to proceed — low governance risk for this change';
    case 'review_before_commit':
      return 'Review before commit — protected path or moderate change';
    case 'manual_review_required':
      return 'Manual review required before applying this change';
    case 'explicit_approval_required':
      return 'Explicit approval required — critical governance risk';
    default:
      return recommendation;
  }
}

/**
 * V3.2 Execution Guard — change-aware risk engine (not path-only alerts).
 */
export async function preActionCheck(
  workspaceRoot: string,
  input: PreActionCheckInput,
): Promise<ExecutionGuardResult> {
  const bundle = await loadGovernanceBundle(workspaceRoot);
  if (!bundle) {
    return {
      allow: true,
      action: 'warn',
      reason: 'Governance layer not initialized',
      suggestion: 'Run workspace sync to seed .contora/governance/',
      risk_level: 'low',
      detections: [],
    };
  }

  const change = analyzeChange({
    target_path: input.target_path,
    code_snippet: input.code_snippet,
    diff_text: input.diff_text,
    lines_added: input.lines_added,
    lines_removed: input.lines_removed,
  });

  const validation = validateActionWithBundle(bundle, input);
  const detections: GuardDetection[] = validationToDetections(validation.matched_rules, validation.reason);

  if (validation.status === 'reject') {
    const riskResult = computeGovernanceRisk({
      protectedPath: Boolean(matchProtectedPath(input.target_path, bundle.constitution)),
      protectedLevel: matchProtectedPath(input.target_path, bundle.constitution)?.level,
      truthImpact: false,
      forbiddenHit: true,
      change,
    });
    return {
      allow: false,
      action: 'block',
      reason: validation.reason,
      suggestion: suggestionFor(riskResult.recommendation),
      risk_level: 'high',
      detections,
      governance_risk: riskResult.risk,
      governance_impact: riskResult.impact,
      change_analysis: change,
      reason_chain: riskResult.reason_chain,
      recommendation: riskResult.recommendation,
      confidence: riskResult.confidence,
      display_score: riskResult.display_score,
    };
  }

  const probe = [input.diff_text, input.code_snippet].filter(Boolean).join('\n');
  if (probe && scanForbiddenPatterns(probe, bundle.constitution)) {
    detections.push({
      type: 'forbidden_pattern',
      detail: 'Forbidden pattern in change content',
      severity: 'high',
    });
  }

  if (input.code_snippet?.trim()) {
    detections.push(...detectHardcodingInSnippet(input.code_snippet, input.target_path));
  }

  const protectedMatch = matchProtectedPath(input.target_path, bundle.constitution);
  const truthImpact = detections.some(
    (d) => d.type === 'truth_registry' || d.type === 'hardcoded_value' || d.type === 'hardcode_snippet',
  );
  const forbiddenHit = detections.some((d) => d.type === 'forbidden_pattern');

  const riskResult = computeGovernanceRisk({
    protectedPath: Boolean(protectedMatch),
    protectedLevel: protectedMatch?.level as ProtectedPathLevel | undefined,
    truthImpact,
    forbiddenHit,
    change,
  });

  const guardMeta = riskToGuardAction(riskResult.risk, input.user_confirmed === true);

  detections.push({
    type: 'change_analysis',
    detail: `Change ${change.change_type} (${change.severity}) +${change.lines_added}/-${change.lines_removed}`,
    severity: change.severity === 'critical' ? 'high' : change.severity === 'high' ? 'high' : 'medium',
  });

  return {
    allow: guardMeta.allow,
    action: guardMeta.action,
    reason: riskResult.reason_chain[riskResult.reason_chain.length - 1] ?? validation.reason,
    suggestion: suggestionFor(riskResult.recommendation),
    risk_level: guardMeta.risk_level,
    detections,
    governance_risk: riskResult.risk,
    governance_impact: riskResult.impact,
    change_analysis: change,
    reason_chain: riskResult.reason_chain,
    recommendation: riskResult.recommendation,
    confidence: riskResult.confidence,
    display_score: riskResult.display_score,
  };
}

export function guardActionLabel(action: GuardAction): string {
  switch (action) {
    case 'block':
      return 'BLOCK — do not proceed';
    case 'confirm':
      return 'CONFIRM — ask user before proceeding';
    case 'warn':
      return 'WARN — proceed with user notification';
    default:
      return 'ALLOW';
  }
}
