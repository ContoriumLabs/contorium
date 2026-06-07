#!/usr/bin/env node
/**
 * Publish @contorium/mcp to npm (single package).
 *
 * @contora/state-core is bundled inside the tarball — you do NOT need
 * a separate @contora org on npm.
 *
 * Usage:
 *   npm run publish:npm
 *   npm run publish:npm:dry-run
 *
 * Prereq: npm login + access to publish @contorium/mcp
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const stateCoreDir = path.join(root, 'packages/state-core');
const mcpDir = path.join(root, 'packages/mcp');
const mcpPkgPath = path.join(mcpDir, 'package.json');
const mcpPkgBackup = `${mcpPkgPath}.publish.bak`;

function run(cmd, cmdArgs, cwd = root) {
  const publishArgs = dryRun && cmd === 'npm' && cmdArgs[0] === 'publish'
    ? [...cmdArgs, '--dry-run']
    : cmdArgs;
  const r = spawnSync(cmd, publishArgs, { cwd, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

function ensureNpmAuth() {
  if (dryRun) {
    return;
  }
  const r = spawnSync('npm', ['whoami'], { encoding: 'utf8', shell: true });
  if (r.status !== 0) {
    console.error('\n[publish] ENEEDAUTH — not logged in to https://registry.npmjs.org/');
    console.error('[publish] Run:  npm login');
    console.error('[publish] Then: npm run publish:npm');
    console.error('[publish] Dry-run without login:  npm run publish:npm:dry-run\n');
    process.exit(1);
  }
  console.error(`[publish] npm user: ${String(r.stdout).trim()}`);
}

function ensureBuilt(pkgDir, distRel) {
  const dist = path.join(pkgDir, distRel);
  if (!fs.existsSync(dist)) {
    console.error(`[publish] missing ${dist} — run: npm run compile`);
    process.exit(1);
  }
}

function backupMcpPackageJson() {
  fs.copyFileSync(mcpPkgPath, mcpPkgBackup);
}

function restoreMcpPackageJson() {
  if (!fs.existsSync(mcpPkgBackup)) {
    return;
  }
  fs.copyFileSync(mcpPkgBackup, mcpPkgPath);
  fs.unlinkSync(mcpPkgBackup);
  console.error('[publish] restored packages/mcp/package.json');
  run('npm', ['install', '--prefix', 'packages/mcp', '--no-fund', '--no-audit']);
}

/** Bundle local state-core into @contorium/mcp tarball (no separate npm publish). */
function bundleStateCoreForPublish() {
  backupMcpPackageJson();
  const pkg = JSON.parse(fs.readFileSync(mcpPkgPath, 'utf8'));
  const version = JSON.parse(fs.readFileSync(path.join(stateCoreDir, 'package.json'), 'utf8')).version;

  pkg.dependencies = pkg.dependencies ?? {};
  pkg.dependencies['@contora/state-core'] = version;
  pkg.bundledDependencies = ['@contora/state-core'];
  fs.writeFileSync(mcpPkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

  console.error(`[publish] bundling @contora/state-core@${version} into @contorium/mcp`);
  // Installs into node_modules and records bundledDependencies for npm pack/publish
  run('npm', ['install', `file:${stateCoreDir}`, '--no-fund', '--no-audit'], mcpDir);
}

ensureBuilt(stateCoreDir, 'dist/index.js');
ensureBuilt(mcpDir, 'dist/server.js');
ensureNpmAuth();

try {
  bundleStateCoreForPublish();
  run('npm', ['run', 'build'], mcpDir);
  console.error('\n[publish] @contorium/mcp (with bundled state-core) …');
  run('npm', ['publish', '--access', 'public'], mcpDir);
  console.error(dryRun ? '\n[publish] dry-run complete.' : '\n[publish] done — users: npm install -g @contorium/mcp');
} finally {
  restoreMcpPackageJson();
}
