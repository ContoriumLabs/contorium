import * as path from 'node:path';
import type {
  Constitution,
  ForbiddenPatternRule,
  GovernanceAction,
  GovernanceBundle,
  HardcodedEntry,
  Identity,
  ProtectedPathLevel,
  ProtectedPathRule,
  TruthLayer,
  ValidationResult,
} from './types.js';
import {
  readConstitution,
  readIdentity,
  readTruthLayer,
} from './store.js';

function normalizeRelPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function normalizeProtectedPathRules(
  entries: Constitution['protected_paths'],
): ProtectedPathRule[] {
  return entries.map((entry) => {
    if (typeof entry === 'string') {
      return { path: entry, level: 'high' as ProtectedPathLevel };
    }
    return entry;
  });
}

export function defaultForbiddenPatterns(): ForbiddenPatternRule[] {
  return [
    { type: 'filesystem', pattern: 'rm -rf' },
    { type: 'database', pattern: 'drop table' },
    { type: 'database', pattern: 'drop database' },
    { type: 'database', pattern: 'truncate table' },
    { type: 'security', pattern: 'delete database' },
  ];
}

function pathMatchesGlob(filePath: string, pattern: string): boolean {
  const norm = normalizeRelPath(filePath);
  const pat = normalizeRelPath(pattern);
  if (pat.endsWith('/**')) {
    const prefix = pat.slice(0, -3);
    return norm === prefix || norm.startsWith(`${prefix}/`);
  }
  if (pat.startsWith('**/')) {
    const suffix = pat.slice(3);
    return norm.endsWith(suffix) || norm.includes(`/${suffix}`);
  }
  if (pat.includes('*')) {
    const escaped = pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
    return new RegExp(`^${escaped}$`).test(norm);
  }
  return norm === pat || norm.startsWith(`${pat}/`);
}

export function matchProtectedPath(
  filePath: string | undefined,
  constitution: Constitution,
): { path: string; level: ProtectedPathLevel } | undefined {
  if (!filePath) {
    return undefined;
  }
  const norm = normalizeRelPath(filePath);
  for (const rule of normalizeProtectedPathRules(constitution.protected_paths)) {
    const p = normalizeRelPath(rule.path);
    if (norm === p || norm.startsWith(`${p}/`) || norm.startsWith(p)) {
      return { path: rule.path, level: rule.level ?? 'high' };
    }
  }
  return undefined;
}

function isMockPath(filePath: string | undefined, truth: TruthLayer): boolean {
  if (!filePath) {
    return false;
  }
  return truth.mock_data.some((pattern) => pathMatchesGlob(filePath, pattern));
}

export function scanForbiddenPatterns(
  probe: string,
  constitution: Constitution,
): ForbiddenPatternRule | undefined {
  const patterns = constitution.forbidden_patterns?.length
    ? constitution.forbidden_patterns
    : defaultForbiddenPatterns();
  const lower = probe.toLowerCase();
  for (const rule of patterns) {
    if (lower.includes(rule.pattern.toLowerCase())) {
      return rule;
    }
  }
  return undefined;
}

function isSensitiveTruthHit(
  target: string | undefined,
  probe: string,
  truth: TruthLayer,
): HardcodedEntry | undefined {
  if (!target) {
    return undefined;
  }
  const norm = normalizeRelPath(target);
  const registered = truth.hardcoded_values.find((h) => normalizeRelPath(h.file) === norm);
  if (registered && registered.severity === 'high') {
    return registered;
  }

  const sensitiveNames = truth.sensitive_constants ?? [];
  for (const name of sensitiveNames) {
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(probe)) {
      return {
        file: norm,
        line: 0,
        reason: `Sensitive constant ${name} referenced in change`,
        severity: 'high',
      };
    }
  }
  return undefined;
}

export async function loadGovernanceBundle(workspaceRoot: string): Promise<GovernanceBundle | null> {
  const [constitution, truth, identity] = await Promise.all([
    readConstitution(workspaceRoot),
    readTruthLayer(workspaceRoot),
    readIdentity(workspaceRoot),
  ]);
  if (!constitution || !truth || !identity) {
    return null;
  }
  return { constitution, truth, identity };
}

export function validateActionWithBundle(
  bundle: GovernanceBundle,
  action: GovernanceAction & { code_snippet?: string; diff_text?: string },
): ValidationResult {
  const { constitution, truth } = bundle;
  const target = action.target_path ? normalizeRelPath(action.target_path) : undefined;
  const probe = [action.diff_text, action.code_snippet, action.description].filter(Boolean).join('\n');

  const forbiddenPattern = probe ? scanForbiddenPatterns(probe, constitution) : undefined;
  if (forbiddenPattern) {
    return {
      status: 'reject',
      reason: `Forbidden pattern detected (${forbiddenPattern.type}): ${forbiddenPattern.pattern}`,
      risk_level: 'high',
      matched_rules: [`forbidden_patterns:${forbiddenPattern.type}:${forbiddenPattern.pattern}`],
    };
  }

  const protectedMatch = matchProtectedPath(target, constitution);
  if (
    protectedMatch &&
    (action.type === 'file_write' || action.type === 'file_delete' || action.type === 'path_change')
  ) {
    return {
      status: 'allow',
      reason: `Path is under protected area (${protectedMatch.level}): ${protectedMatch.path} — severity depends on change`,
      risk_level: protectedMatch.level === 'critical' ? 'high' : 'medium',
      matched_rules: [`protected_paths:${protectedMatch.path}:${protectedMatch.level}`],
    };
  }

  if (target && isMockPath(target, truth) && action.type === 'file_write') {
    return {
      status: 'allow',
      reason: 'Target is marked mock data in truth layer',
      risk_level: 'low',
      matched_rules: ['truth:mock_data'],
    };
  }

  const truthHit = probe ? isSensitiveTruthHit(target, probe, truth) : undefined;
  if (truthHit && action.type === 'file_write') {
    return {
      status: 'allow',
      reason: truthHit.reason,
      risk_level: 'high',
      matched_rules: [`truth:sensitive:${target}`],
    };
  }

  return {
    status: 'allow',
    reason: 'No governance rule violation detected',
    risk_level: 'low',
  };
}

export async function validateAction(
  workspaceRoot: string,
  action: GovernanceAction,
): Promise<ValidationResult> {
  const bundle = await loadGovernanceBundle(workspaceRoot);
  if (!bundle) {
    return {
      status: 'allow',
      reason: 'Governance layer not initialized — validation skipped',
      risk_level: 'low',
    };
  }
  return validateActionWithBundle(bundle, action);
}

export function validatePathChange(
  bundle: GovernanceBundle,
  filePath: string,
  changeType: 'write' | 'delete' = 'write',
): ValidationResult {
  return validateActionWithBundle(bundle, {
    type: changeType === 'delete' ? 'file_delete' : 'file_write',
    target_path: filePath,
  });
}

export async function getGovernanceSummary(workspaceRoot: string): Promise<{
  found: boolean;
  workspaceRoot: string;
  constitution?: Constitution;
  truth?: TruthLayer;
  identity?: Identity;
  protected_path_count: number;
  mock_path_patterns: number;
}> {
  const resolved = path.resolve(workspaceRoot);
  const bundle = await loadGovernanceBundle(resolved);
  if (!bundle) {
    return {
      found: false,
      workspaceRoot: resolved,
      protected_path_count: 0,
      mock_path_patterns: 0,
    };
  }
  return {
    found: true,
    workspaceRoot: resolved,
    constitution: bundle.constitution,
    truth: bundle.truth,
    identity: bundle.identity,
    protected_path_count: normalizeProtectedPathRules(bundle.constitution.protected_paths).length,
    mock_path_patterns: bundle.truth.mock_data.length,
  };
}
