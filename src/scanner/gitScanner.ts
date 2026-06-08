import { scanGitPorcelain } from '@contora/state-core';

export interface GitScanResult {
  staged: string[];
  working: string[];
}

/**
 * Git scan for IDE extension — uses state-core (single `git status`, respects gitRuntime gate).
 * Do not use simple-git here (checkIsRepo + status = two visible git.exe windows on Windows).
 */
export async function scanGitState(workspaceRoot: string): Promise<GitScanResult> {
  try {
    const result = await scanGitPorcelain(workspaceRoot);
    return { staged: result.staged, working: result.working };
  } catch {
    return { staged: [], working: [] };
  }
}

/** Combined unique paths (sidebar flat list / legacy). */
export async function scanGitMerged(workspaceRoot: string): Promise<string[]> {
  const { staged, working } = await scanGitState(workspaceRoot);
  return [...new Set([...staged, ...working])];
}
