import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { resolveMcpStartupConfig, setStartupWorkspace } from './workspaceConfig.js';

const CONTORA_DATA_DIR = '.contora';
const LEGACY_DATA_DIR = '.context-recall';

/** Apply CLI --workspace before other resolution (call once at startup). */
export function initWorkspaceFromArgv(argv: string[] = process.argv.slice(2)): string {
  const config = resolveMcpStartupConfig(argv);
  if (config.workspaceFromArgv) {
    setStartupWorkspace(config.workspaceHint);
  }
  return config.workspaceHint;
}

/** Workspace root for MCP (priority: startup override → env → .mcp.json → cwd). */
export function resolveWorkspaceRoot(): string {
  const config = resolveMcpStartupConfig();
  return config.workspaceHint;
}

export function contoraDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, CONTORA_DATA_DIR);
}

export function mcpMemoryFile(workspaceRoot: string): string {
  return path.join(contoraDir(workspaceRoot), 'mcp', 'memories.json');
}

export function stateSummaryFile(workspaceRoot: string): string {
  return path.join(contoraDir(workspaceRoot), 'intelligence', 'state-summary.json');
}

export function intentGraphFile(workspaceRoot: string): string {
  return path.join(contoraDir(workspaceRoot), 'intent-graph', 'graph.json');
}

export function projectStateFile(workspaceRoot: string): string {
  return path.join(contoraDir(workspaceRoot), 'state-builder', 'project-state.json');
}

export function projectSnapshotFile(workspaceRoot: string): string {
  return path.join(contoraDir(workspaceRoot), 'state-builder', 'project-snapshot.md');
}

export function conflictsFile(workspaceRoot: string): string {
  return path.join(contoraDir(workspaceRoot), 'state-engine', 'conflicts.json');
}

export async function findWorkspaceRoot(startDir: string): Promise<string> {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 12; i++) {
    const primary = path.join(dir, CONTORA_DATA_DIR, 'state.json');
    const legacy = path.join(dir, LEGACY_DATA_DIR, 'state.json');
    try {
      await fs.access(primary);
      return dir;
    } catch {
      /* continue */
    }
    try {
      await fs.access(legacy);
      return dir;
    } catch {
      /* continue */
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return path.resolve(startDir);
}
