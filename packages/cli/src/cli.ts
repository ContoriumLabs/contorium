#!/usr/bin/env node
import * as path from 'node:path';
import {
  readProjectSnapshotMarkdown,
  readStateJson,
  readWorkspaceStatus,
  syncWorkspaceState,
} from '@contora/state-core';

const USAGE = `Contorium CLI — runtime adapter (same state-core as IDE / MCP)

Usage:
  contorium init [workspaceRoot]     Bootstrap or merge .contora/state.json
  contorium sync [workspaceRoot]     Rescan workspace and refresh state (one-shot)
  contorium snapshot [workspaceRoot] Print PROJECT SNAPSHOT markdown
  contorium status [workspaceRoot]   JSON summary (mode, source, git counts)
  contorium state [workspaceRoot]    Print state.json (pretty JSON)

Default workspaceRoot: current directory
`;

function workspaceArg(): string {
  const arg = process.argv[3];
  return path.resolve(arg || process.cwd());
}

async function cmdInit(root: string): Promise<void> {
  const result = await syncWorkspaceState(root, 'cli', { forceArtifacts: true });
  console.log(JSON.stringify({ workspaceRoot: root, ...result }, null, 2));
}

async function cmdSync(root: string): Promise<void> {
  const result = await syncWorkspaceState(root, 'cli');
  console.log(JSON.stringify({ workspaceRoot: root, ...result }, null, 2));
}

async function cmdSnapshot(root: string): Promise<void> {
  const existing = await readProjectSnapshotMarkdown(root);
  if (existing) {
    process.stdout.write(existing.endsWith('\n') ? existing : `${existing}\n`);
    return;
  }
  await syncWorkspaceState(root, 'cli', { forceArtifacts: true });
  const md = await readProjectSnapshotMarkdown(root);
  process.stdout.write(md ?? '');
}

async function cmdStatus(root: string): Promise<void> {
  const status = await readWorkspaceStatus(root);
  console.log(JSON.stringify(status, null, 2));
}

async function cmdState(root: string): Promise<void> {
  const state = await readStateJson(root);
  if (!state) {
    console.error('contorium state: no .contora/state.json — run: contorium init');
    process.exit(1);
  }
  console.log(JSON.stringify(state, null, 2));
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  const root = workspaceArg();
  switch (cmd) {
    case 'init':
      await cmdInit(root);
      return;
    case 'sync':
      await cmdSync(root);
      return;
    case 'snapshot':
      await cmdSnapshot(root);
      return;
    case 'status':
      await cmdStatus(root);
      return;
    case 'state':
      await cmdState(root);
      return;
    default:
      process.stderr.write(USAGE);
      process.exit(cmd ? 1 : 0);
  }
}

main().catch((err) => {
  console.error('contorium:', err);
  process.exit(1);
});
