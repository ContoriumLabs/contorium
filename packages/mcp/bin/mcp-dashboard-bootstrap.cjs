#!/usr/bin/env node
'use strict';

/**
 * Spawn `contorium bootstrap` for MCP when @contora/cli is not on PATH.
 * Used from @contorium/mcp (published npm) and Codex plugin installs.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const workspaceRoot = path.resolve(process.argv[2] ?? process.cwd());
const here = __dirname;

const cliCandidates = [
  path.join(here, '../../cli/bin/contorium.cjs'),
  path.join(here, 'contorium-cli.cjs'),
];

const cli = cliCandidates.find((p) => fs.existsSync(p));
if (!cli) {
  console.error('[contorium-mcp] dashboard bootstrap: contorium CLI not found');
  console.error('[contorium-mcp] install from monorepo or set CONTORIUM_CLI_PATH');
  process.exit(1);
}

const args = [cli, 'bootstrap', workspaceRoot, '--source', 'mcp'];
const child = spawn(process.execPath, args, {
  cwd: workspaceRoot,
  detached: true,
  stdio: 'ignore',
  windowsHide: true,
  env: process.env,
});
child.unref();
