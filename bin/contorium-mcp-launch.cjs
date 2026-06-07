#!/usr/bin/env node
/**
 * Monorepo launcher — delegates to @contorium/mcp standard bin.
 * Prefer: npx contorium-mcp  or  npx @contorium/mcp
 */
'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const pluginRoot = path.resolve(__dirname, '..');
const entry = path.join(pluginRoot, 'packages', 'mcp', 'bin', 'contorium-mcp.js');

const child = spawn(process.execPath, [entry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
  cwd: pluginRoot,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on('error', (err) => {
  console.error('[contorium-mcp] failed to start:', err.message);
  process.exit(1);
});
