import type { BootstrapStateJson, WorkspaceScanFacts } from '../types.js';
import { runGit } from '../scanner/runGit.js';
import { isTrackableFile } from './extractor.js';

function norm(p: string): string {
  return p.replace(/\\/g, '/');
}

function uniqueTrackableFiles(paths: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of paths) {
    const n = norm(p);
    if (!n || seen.has(n) || !isTrackableFile(n)) {
      continue;
    }
    seen.add(n);
    out.push(n);
  }
  return out;
}

/** Collect candidate changed files from state + optional scan facts. */
export function collectChangedFiles(
  state: BootstrapStateJson,
  extraPaths: string[] = [],
  max = 32,
): string[] {
  const merged = [
    ...state.gitStaged,
    ...state.gitWorking,
    ...state.recentFiles.slice(0, 16),
    ...extraPaths,
  ];
  return uniqueTrackableFiles(merged).slice(0, max);
}

/** Git diff names (staged + unstaged vs HEAD) — best-effort. */
export async function gitDiffChangedFiles(workspaceRoot: string, max = 32): Promise<string[]> {
  try {
    const unstaged = await runGit(workspaceRoot, ['diff', '--name-only', 'HEAD'], {
      timeout: 12_000,
    });
    const staged = await runGit(workspaceRoot, ['diff', '--name-only', '--cached', 'HEAD'], {
      timeout: 12_000,
    });
    const all = [...unstaged.split('\n'), ...staged.split('\n')].map((l) => l.trim()).filter(Boolean);
    return uniqueTrackableFiles(all).slice(0, max);
  } catch {
    return [];
  }
}

export async function resolveChangedFiles(
  workspaceRoot: string,
  state: BootstrapStateJson,
  scan?: WorkspaceScanFacts,
  extraPaths: string[] = [],
  opts?: { allowGitDiff?: boolean },
): Promise<string[]> {
  const fromGit = scan || !opts?.allowGitDiff ? [] : await gitDiffChangedFiles(workspaceRoot);
  const fromState = collectChangedFiles(state, extraPaths);
  const fromScan = scan
    ? uniqueTrackableFiles([...scan.gitStaged, ...scan.gitWorking, ...scan.recentFiles.slice(0, 12)])
    : [];
  const merged = [...fromGit, ...fromState, ...fromScan];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of merged) {
    if (seen.has(f)) {
      continue;
    }
    seen.add(f);
    out.push(f);
    if (out.length >= 32) {
      break;
    }
  }
  return out;
}
