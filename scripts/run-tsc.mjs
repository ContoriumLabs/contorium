#!/usr/bin/env node
/**
 * Run TypeScript from repo root node_modules (works on Windows when sub-packages lack local tsc).
 * Usage: node scripts/run-tsc.mjs [projectDir] [--no-clean]
 * Example: node scripts/run-tsc.mjs packages/runtime
 *
 * For packages/*, runs clean-dist before tsc (avoids TS5033 when MCP/CLI locks dist/ on Windows).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawArgs = process.argv.slice(2);
const noClean = rawArgs.includes('--no-clean');
const extraArgs = rawArgs.filter((a) => a !== '--no-clean');
const projectArg = extraArgs[0] ?? '.';
const tscArgs = extraArgs.slice(1);
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

const isWin = process.platform === 'win32';
const isWatch = tscArgs.includes('-watch') || tscArgs.includes('--watch');
const relProject = path.relative(root, projectDir).replace(/\\/g, '/');
const shouldClean =
  !noClean &&
  !isWatch &&
  (relProject === 'packages' || relProject.startsWith('packages/'));

function runCleanDist() {
  const cleanScript = path.join(root, 'scripts', 'clean-dist.mjs');
  const r = spawnSync(process.execPath, [cleanScript, relProject], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  return r.status === 0;
}

function runTsc() {
  return spawnSync(process.execPath, [tscBin, '-p', tsconfig, ...tscArgs], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
}

if (shouldClean) {
  if (!runCleanDist()) {
    console.error(
      '[run-tsc] clean-dist failed — stop Contorium MCP / dashboard attach / CLI workers, then retry.',
    );
    process.exit(1);
  }
}

let result = runTsc();

if (result.status !== 0 && shouldClean && isWin) {
  console.error('[run-tsc] tsc failed — retrying after clean-dist (Windows file lock recovery)…');
  if (runCleanDist()) {
    result = runTsc();
  }
}

process.exit(result.status ?? 1);
