#!/usr/bin/env node
/**
 * Ensure devDependencies (typescript, @types/*) exist before compile.
 * npm prune --omit=dev (used before vsix pack) removes them — restore automatically.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tscBin = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');

if (fs.existsSync(tscBin)) {
  process.exit(0);
}

console.log('[ensure-dev-deps] typescript missing — running npm install (includes devDependencies)...');
const r = spawnSync('npm', ['install', '--include=dev', '--no-fund', '--no-audit'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

if (r.status !== 0) {
  process.exit(r.status ?? 1);
}

if (!fs.existsSync(tscBin)) {
  console.error('[ensure-dev-deps] typescript still missing after npm install.');
  process.exit(1);
}
