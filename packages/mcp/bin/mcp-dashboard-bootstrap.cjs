#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const workspaceRoot = path.resolve(process.argv[2] ?? process.cwd());
const here = __dirname;

function findCli() {
  if (process.env.CONTORIUM_CLI_PATH && fs.existsSync(process.env.CONTORIUM_CLI_PATH)) {
    return process.env.CONTORIUM_CLI_PATH;
  }
  const repo = process.env.CONTORIUM_REPO;
  if (repo) {
    const cli = path.join(repo, 'packages', 'cli', 'bin', 'contorium.cjs');
    if (fs.existsSync(cli)) return cli;
  }
  for (const p of [
    path.join(here, '../../cli/bin/contorium.cjs'),
    path.join(here, 'contorium-cli.cjs'),
  ]) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

const cli = findCli();
if (!cli) {
  console.error('[contorium-mcp] dashboard bootstrap: contorium CLI not found');
  console.error('[contorium-mcp] run: node scripts/setup-codex-mcp-local.mjs');
  process.exit(1);
}

spawn(process.execPath, [cli, 'bootstrap', workspaceRoot, '--source', 'mcp', '--quiet'], {
  cwd: workspaceRoot,
  detached: true,
  stdio: 'ignore',
  windowsHide: true,
  shell: false,
  creationFlags: process.platform === 'win32' ? 0x08000000 : undefined,
}).unref();
