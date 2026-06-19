import { runGit } from '../scanner/runGit.js';
import { createControlSurface } from '../control-core/index.js';
import { analyzeChange } from './changeAnalyzer.js';
import {
  buildGovernanceReviewArtifact,
  type GovernanceReviewArtifact,
  type ReviewScope,
  type ReviewSource,
} from './governanceReview.js';
import type { GovernanceRisk } from './riskEngine.js';

export type ReviewScopePreference =
  | 'auto'
  | 'current_file'
  | 'open_files'
  | 'git_staged'
  | 'git_commit';

const MAX_FILES_PER_SCOPE = 48;

const RISK_RANK: Record<GovernanceRisk, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export interface ScopedFileReviewInput {
  relativePath: string;
  diff_text?: string;
  lines_added?: number;
  lines_removed?: number;
}

function normalizeRel(p: string): string {
  return p.trim().replace(/\\/g, '/');
}

function pickWorst(a: GovernanceReviewArtifact | null, b: GovernanceReviewArtifact | null): GovernanceReviewArtifact | null {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  if (RISK_RANK[b.risk] > RISK_RANK[a.risk]) {
    return b;
  }
  if (RISK_RANK[b.risk] === RISK_RANK[a.risk] && b.display_score < a.display_score) {
    return b;
  }
  return a;
}

/** Review a list of files in a scope; returns highest-risk artifact. */
export async function reviewScopedFiles(
  workspaceRoot: string,
  files: ScopedFileReviewInput[],
  opts: {
    reviewSource: ReviewSource;
    reviewScope: ReviewScope;
    scopeFiles?: string[];
    descriptionPrefix?: string;
  },
): Promise<GovernanceReviewArtifact | null> {
  const unique = [...new Map(files.map((f) => [normalizeRel(f.relativePath), f])).values()];
  if (!unique.length) {
    return null;
  }

  const control = createControlSurface(workspaceRoot, 'ide');
  const scopeFiles = (opts.scopeFiles ?? unique.map((f) => normalizeRel(f.relativePath))).map(normalizeRel);
  let worst: GovernanceReviewArtifact | null = null;
  const prefix = opts.descriptionPrefix ?? 'Scope review';

  for (const file of unique.slice(0, MAX_FILES_PER_SCOPE)) {
    const rel = normalizeRel(file.relativePath);
    const diff = file.diff_text ?? '';
    const change = analyzeChange({ target_path: rel, diff_text: diff });
    const result = await control.checkAction({
      type: 'file_write',
      target_path: rel,
      description: `${prefix}: ${rel}`,
      diff_text: diff || undefined,
      lines_added: file.lines_added ?? change.lines_added,
      lines_removed: file.lines_removed ?? change.lines_removed,
    });
    if (result.loop !== 'check') {
      continue;
    }
    const artifact = buildGovernanceReviewArtifact(result, rel, {
      reviewSource: opts.reviewSource,
      reviewScope: opts.reviewScope,
      stagedFiles: opts.reviewScope === 'git_staged' ? scopeFiles : undefined,
    });
    worst = pickWorst(worst, artifact);
  }

  if (worst && scopeFiles.length > 1 && opts.reviewScope !== 'git_staged') {
    worst = {
      ...worst,
      reason_chain: [
        ...worst.reason_chain,
        `${opts.reviewScope.replace(/_/g, ' ')}: ${scopeFiles.length} file(s) reviewed`,
      ],
    };
  }

  return worst;
}

export async function listGitStagedRelativePaths(workspaceRoot: string): Promise<string[]> {
  try {
    const stdout = await runGit(workspaceRoot, ['diff', '--name-only', '--cached'], { force: true });
    return stdout
      .split('\n')
      .map((l) => normalizeRel(l))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function getGitStagedDiff(workspaceRoot: string, relPath: string): Promise<string> {
  try {
    return await runGit(workspaceRoot, ['diff', '--cached', '--', relPath], { force: true });
  } catch {
    return '';
  }
}

export async function reviewGitStagedChanges(
  workspaceRoot: string,
): Promise<GovernanceReviewArtifact | null> {
  const files = await listGitStagedRelativePaths(workspaceRoot);
  if (!files.length) {
    return null;
  }
  const inputs: ScopedFileReviewInput[] = [];
  for (const rel of files.slice(0, MAX_FILES_PER_SCOPE)) {
    inputs.push({ relativePath: rel, diff_text: await getGitStagedDiff(workspaceRoot, rel) });
  }
  return reviewScopedFiles(workspaceRoot, inputs, {
    reviewSource: 'git_staged',
    reviewScope: 'git_staged',
    scopeFiles: files,
    descriptionPrefix: 'Git staged review',
  });
}

export async function reviewOpenFilesChanges(
  workspaceRoot: string,
  files: ScopedFileReviewInput[],
): Promise<GovernanceReviewArtifact | null> {
  return reviewScopedFiles(workspaceRoot, files, {
    reviewSource: 'editor_diff',
    reviewScope: 'open_files',
    scopeFiles: files.map((f) => normalizeRel(f.relativePath)),
    descriptionPrefix: 'Open files review',
  });
}

export async function listGitCommitRelativePaths(workspaceRoot: string): Promise<string[]> {
  try {
    await runGit(workspaceRoot, ['rev-parse', '--verify', 'HEAD'], { force: true });
    const stdout = await runGit(
      workspaceRoot,
      ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'],
      { force: true },
    );
    return stdout
      .split('\n')
      .map((l) => normalizeRel(l))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function getGitCommitFileDiff(workspaceRoot: string, relPath: string): Promise<string> {
  try {
    return await runGit(workspaceRoot, ['show', 'HEAD', '--', relPath], { force: true });
  } catch {
    return '';
  }
}

export async function reviewGitCommitChanges(
  workspaceRoot: string,
): Promise<GovernanceReviewArtifact | null> {
  const files = await listGitCommitRelativePaths(workspaceRoot);
  if (!files.length) {
    return null;
  }
  const inputs: ScopedFileReviewInput[] = [];
  for (const rel of files.slice(0, MAX_FILES_PER_SCOPE)) {
    inputs.push({ relativePath: rel, diff_text: await getGitCommitFileDiff(workspaceRoot, rel) });
  }
  return reviewScopedFiles(workspaceRoot, inputs, {
    reviewSource: 'git_commit',
    reviewScope: 'git_commit',
    scopeFiles: files,
    descriptionPrefix: 'Git commit review',
  });
}

export function pickHigherRiskReview(
  a: GovernanceReviewArtifact,
  b: GovernanceReviewArtifact,
): GovernanceReviewArtifact {
  return pickWorst(a, b) ?? a;
}

export function mergeReviewArtifacts(
  artifacts: Array<GovernanceReviewArtifact | null | undefined>,
): GovernanceReviewArtifact | null {
  let final: GovernanceReviewArtifact | null = null;
  const scopeNotes: string[] = [];

  for (const artifact of artifacts) {
    if (!artifact) {
      continue;
    }
    if (!final) {
      final = artifact;
      continue;
    }
    const before: GovernanceReviewArtifact = final;
    final = pickHigherRiskReview(final, artifact);
    if (final === artifact && final !== before) {
      scopeNotes.push(`${before.review_scope}: ${before.risk.toUpperCase()}`);
    } else if (final === before && artifact !== before) {
      scopeNotes.push(`${artifact.review_scope}: ${artifact.risk.toUpperCase()}`);
    }
    if (artifact.staged_files?.length) {
      final = { ...final, staged_files: artifact.staged_files };
    }
  }

  if (final && scopeNotes.length) {
    final = {
      ...final,
      reason_chain: [...final.reason_chain, ...scopeNotes.map((n) => `Also reviewed — ${n}`)],
    };
  }

  return final;
}

export { RISK_RANK, MAX_FILES_PER_SCOPE };
