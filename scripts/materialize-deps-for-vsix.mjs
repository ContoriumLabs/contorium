#!/usr/bin/env node
/**
 * Pack workspace packages into .vscode-pack/*.tgz and install into node_modules
 * so vsce does not ship broken file: symlinks.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packDir = path.join(root, '.vscode-pack');

const PACKAGES = [
  { name: '@contora/runtime', dir: 'packages/runtime', dist: 'dist/index.js' },
  { name: '@contora/state-core', dir: 'packages/state-core', dist: 'dist/index.js' },
];

function run(cmd, args, cwd = root) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

fs.mkdirSync(packDir, { recursive: true });
for (const f of fs.readdirSync(packDir)) {
  if (f.endsWith('.tgz')) {
    fs.unlinkSync(path.join(packDir, f));
  }
}

const tarballs = [];

for (const pkg of PACKAGES) {
  const pkgDir = path.join(root, pkg.dir);
  const distFile = path.join(pkgDir, pkg.dist);
  if (!fs.existsSync(distFile)) {
    console.error(`[materialize-deps] ${pkg.dist} missing in ${pkg.dir} — run npm run compile first.`);
    process.exit(1);
  }
  run('npm', ['pack', '--pack-destination', packDir], pkgDir);
  const tgz = fs
    .readdirSync(packDir)
    .filter((f) => f.endsWith('.tgz'))
    .sort((a, b) => fs.statSync(path.join(packDir, b)).mtimeMs - fs.statSync(path.join(packDir, a)).mtimeMs)[0];
  if (!tgz) {
    console.error(`[materialize-deps] npm pack failed for ${pkg.name}`);
    process.exit(1);
  }
  tarballs.push(path.join(packDir, tgz));
}

for (const tgzPath of tarballs) {
  run('npm', ['install', tgzPath, '--omit=dev', '--no-audit', '--no-fund']);
}

for (const pkg of PACKAGES) {
  const installed = path.join(root, 'node_modules', ...pkg.name.split('/'), pkg.dist);
  if (!fs.existsSync(installed)) {
    console.error(`[materialize-deps] ${pkg.name} not materialized after install.`);
    process.exit(1);
  }
}

// VS Code extension uses require() — state-core must not be ESM-only.
try {
  const scPkg = JSON.parse(
    fs.readFileSync(path.join(root, 'node_modules', '@contora', 'state-core', 'package.json'), 'utf8'),
  );
  const exp = scPkg.exports?.['.'];
  if (exp && !exp.require && scPkg.type === 'module') {
    console.error('[materialize-deps] @contora/state-core must export "require" for the IDE extension.');
    process.exit(1);
  }
  const { createRequire } = await import('node:module');
  createRequire(import.meta.url)('@contora/state-core');
} catch (err) {
  console.error('[materialize-deps] @contora/state-core require check failed:', err);
  process.exit(1);
}

console.log('[materialize-deps] OK:', tarballs.map((t) => path.basename(t)).join(', '));
