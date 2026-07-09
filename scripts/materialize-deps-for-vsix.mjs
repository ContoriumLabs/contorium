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

/** Install packed tgz into node_modules without touching package-lock (avoids Windows EBUSY on lock file). */
function installTarball(tgzPath, pkgName) {
  const nmDir = path.join(root, 'node_modules', ...pkgName.split('/'));
  fs.rmSync(nmDir, { recursive: true, force: true });
  const baseArgs = [
    tgzPath,
    '--omit=dev',
    '--no-audit',
    '--no-fund',
    '--no-save',
    '--no-package-lock',
    '--force',
  ];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = spawnSync('npm', ['install', ...baseArgs], { cwd: root, stdio: 'inherit', shell: true });
    if (r.status === 0) {
      return;
    }
    if (attempt < 3) {
      console.warn(`[materialize-deps] npm install retry ${attempt + 1}/3 (${path.basename(tgzPath)})…`);
      spawnSync('powershell', ['-NoProfile', '-Command', 'Start-Sleep -Milliseconds 800'], {
        stdio: 'ignore',
        shell: true,
      });
    } else {
      process.exit(r.status ?? 1);
    }
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
  const before = new Set(fs.readdirSync(packDir).filter((f) => f.endsWith('.tgz')));
  run('npm', ['pack', '--pack-destination', packDir], pkgDir);
  const created = fs.readdirSync(packDir).filter((f) => f.endsWith('.tgz') && !before.has(f));
  if (!created.length) {
    console.error(`[materialize-deps] npm pack failed for ${pkg.name}`);
    process.exit(1);
  }
  tarballs.push({ name: pkg.name, path: path.join(packDir, created[0]) });
}

for (const { name, path: tgzPath } of tarballs) {
  installTarball(tgzPath, name);
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
  const lifecycleTypes = fs.readFileSync(
    path.join(root, 'node_modules', '@contora', 'state-core', 'dist', 'lifecycle', 'types.d.ts'),
    'utf8',
  );
  if (!lifecycleTypes.includes('contorium.lifecycle.v2')) {
    console.error(
      '[materialize-deps] stale @contora/state-core in node_modules — rebuild packages/state-core first.',
    );
    process.exit(1);
  }
  const scIndex = fs.readFileSync(
    path.join(root, 'node_modules', '@contora', 'state-core', 'dist', 'index.d.ts'),
    'utf8',
  );
  if (!scIndex.includes('formatValidityStateLabel')) {
    console.error('[materialize-deps] @contora/state-core missing formatValidityStateLabel export.');
    process.exit(1);
  }
} catch (err) {
  console.error('[materialize-deps] @contora/state-core require check failed:', err);
  process.exit(1);
}

console.log('[materialize-deps] OK:', tarballs.map((t) => path.basename(t.path)).join(', '));
