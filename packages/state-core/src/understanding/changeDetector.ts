import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { BootstrapStateJson, WorkspaceScanFacts } from '../types.js';
import { isCodeFile } from './extractor.js';

const execFileAsync = promisify(execFile);

function norm(p: string): string {
  return p.replace(/\\/g, '/');
}

function uniqueCodeFiles(paths: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of paths) {
    const n = norm(p);
    if (!n || seen.has(n) || !isCodeFile(n)) {
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
  return uniqueCodeFiles(merged).slice(0, max);
}

/** Git diff names (staged + unstaged vs HEAD) — best-effort. */
export async function gitDiffChangedFiles(workspaceRoot: string, max = 32): Promise<string[]> {
  try {
    const { stdout: unstaged } = await execFileAsync(
      'git',
      ['-C', workspaceRoot, 'diff', '--name-only', 'HEAD'],
      { timeout: 12_000, maxBuffer: 2 * 1024 * 1024 },
    );
    const { stdout: staged } = await execFileAsync(
      'git',
      ['-C', workspaceRoot, 'diff', '--name-only', '--cached', 'HEAD'],
      { timeout: 12_000, maxBuffer: 2 * 1024 * 1024 },
    );
    const all = [...unstaged.split('\n'), ...staged.split('\n')].map((l) => l.trim()).filter(Boolean);
    return uniqueCodeFiles(all).slice(0, max);
  } catch {
    return [];
  }
}

export async function resolveChangedFiles(
  workspaceRoot: string,
  state: BootstrapStateJson,
  scan?: WorkspaceScanFacts,
  extraPaths: string[] = [],
): Promise<string[]> {
  const fromGit = await gitDiffChangedFiles(workspaceRoot);
  const fromState = collectChangedFiles(state, extraPaths);
  const fromScan = scan
    ? uniqueCodeFiles([...scan.gitStaged, ...scan.gitWorking, ...scan.recentFiles.slice(0, 12)])
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
