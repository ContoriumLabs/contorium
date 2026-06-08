import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { WorkspaceScanFacts } from '../types.js';
import { scanGitPorcelain } from './gitScan.js';

export interface ScanWorkspaceOptions {
  /** Use cached git fields — no git.exe subprocess (MCP/Codex startup). */
  skipGitScan?: boolean;
  cachedGit?: { staged: string[]; working: string[]; isRepo: boolean };
}

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.contora',
  '.context-recall',
  'dist',
  'out',
  '.vscode',
  'coverage',
]);

const SKIP_EXT = /\.(png|jpg|jpeg|gif|ico|woff2?|ttf|eot|zip|vsix|map)$/i;

async function readReadmeHint(root: string): Promise<string | undefined> {
  for (const name of ['README.md', 'readme.md', 'Readme.md']) {
    try {
      const text = await fs.readFile(path.join(root, name), 'utf8');
      for (const line of text.split('\n')) {
        const t = line.replace(/^#+\s*/, '').trim();
        if (t.length >= 12 && !/^contorium|table of contents/i.test(t)) {
          return t.length > 160 ? t.slice(0, 157) + '…' : t;
        }
      }
    } catch {
      /* try next */
    }
  }
  return undefined;
}

async function listTopLevelModules(root: string): Promise<string[]> {
  const out: string[] = [];
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.') || SKIP_DIRS.has(e.name)) {
        continue;
      }
      out.push(e.name);
    }
  } catch {
    return out;
  }
  return out.slice(0, 12);
}

async function collectRecentFiles(root: string, maxFiles: number, maxDepth: number): Promise<string[]> {
  const scored: { rel: string; mtime: number }[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth || scored.length >= maxFiles * 3) {
      return;
    }
    let entries: { name: string; isDirectory(): boolean }[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const name = e.name;
      if (name.startsWith('.') && name !== '.env') {
        if (SKIP_DIRS.has(name)) {
          continue;
        }
      }
      const full = path.join(dir, name);
      const rel = path.relative(root, full).replace(/\\/g, '/');
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(name)) {
          await walk(full, depth + 1);
        }
        continue;
      }
      if (SKIP_EXT.test(name)) {
        continue;
      }
      try {
        const st = await fs.stat(full);
        scored.push({ rel, mtime: st.mtimeMs });
      } catch {
        /* skip */
      }
    }
  }

  await walk(root, 0);
  scored.sort((a, b) => b.mtime - a.mtime);
  return scored.slice(0, maxFiles).map((s) => s.rel);
}

/** Mode B — workspace filesystem scan (no IDE required). */
export async function scanWorkspace(
  workspaceRoot: string,
  opts?: ScanWorkspaceOptions,
): Promise<WorkspaceScanFacts> {
  const root = path.resolve(workspaceRoot);
  const now = Date.now();
  const gitPromise = opts?.skipGitScan
    ? Promise.resolve(
        opts.cachedGit ?? { staged: [] as string[], working: [] as string[], isRepo: false },
      )
    : scanGitPorcelain(root);
  const [git, topLevelModules, recentFiles, readmeHint] = await Promise.all([
    gitPromise,
    listTopLevelModules(root),
    collectRecentFiles(root, 24, 5),
    readReadmeHint(root),
  ]);
  return {
    workspaceRoot: root,
    scannedAt: now,
    topLevelModules,
    recentFiles,
    gitStaged: git.staged,
    gitWorking: git.working,
    readmeHint,
    isGitRepo: git.isRepo,
  };
}
