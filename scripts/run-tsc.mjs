#!/usr/bin/env node
/**
 * Run TypeScript from repo root node_modules (works on Windows when sub-packages lack local tsc).
 * Usage: node scripts/run-tsc.mjs [projectDir]
 * Example: node scripts/run-tsc.mjs packages/runtime
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectArg = process.argv[2] ?? '.';
const extraArgs = process.argv.slice(3);
const projectDir = path.resolve(root, projectArg);
const tsconfig = path.join(projectDir, 'tsconfig.json');

if (!fs.existsSync(tsconfig)) {
  console.error(`[run-tsc] tsconfig.json not found: ${tsconfig}`);
  process.exit(1);
}

const tscBin = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
if (!fs.existsSync(tscBin)) {
  console.error(
    '[run-tsc] TypeScript not installed. Run from repo root:\n  npm install\n(devDependencies include typescript)',
  );
  process.exit(1);
}

const r = spawnSync(process.execPath, [tscBin, '-p', tsconfig, ...extraArgs], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
});

process.exit(r.status ?? 1);
