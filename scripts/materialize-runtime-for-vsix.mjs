#!/usr/bin/env node
/**
 * Replace `file:packages/runtime` junction with a real npm install from tarball
 * so vsce does not ship broken symlinks (ELSPROBLEMS / invalid file: deps).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packDir = path.join(root, '.vscode-pack');
const runtimeDir = path.join(root, 'packages', 'runtime');

function run(cmd, args, cwd = root) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

if (!fs.existsSync(path.join(runtimeDir, 'dist', 'index.js'))) {
  console.error('[materialize-runtime] packages/runtime/dist missing — run npm run build:runtime first.');
  process.exit(1);
}

fs.mkdirSync(packDir, { recursive: true });
for (const f of fs.readdirSync(packDir)) {
  if (f.endsWith('.tgz')) {
    fs.unlinkSync(path.join(packDir, f));
  }
}

run('npm', ['pack', '--pack-destination', packDir], runtimeDir);

const tgz = fs.readdirSync(packDir).find((f) => f.endsWith('.tgz'));
if (!tgz) {
  console.error('[materialize-runtime] npm pack produced no tarball.');
  process.exit(1);
}

const tgzPath = path.join(packDir, tgz);
run('npm', ['install', tgzPath, '--omit=dev', '--no-audit', '--no-fund']);

const installed = path.join(root, 'node_modules', '@contora', 'runtime', 'dist', 'index.js');
if (!fs.existsSync(installed)) {
  console.error('[materialize-runtime] @contora/runtime dist not materialized after install.');
  process.exit(1);
}

console.log('[materialize-runtime] OK:', tgz);
