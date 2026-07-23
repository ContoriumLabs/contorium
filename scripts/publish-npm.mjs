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

function printAuthHelp(reason) {
  console.error(`\n[publish] ${reason}`);
  console.error('[publish] Browser login often fails with:');
  console.error('[publish]   E404 GET https://registry.npmjs.org/-/v1/done?authId=…');
  console.error('[publish] Prefer an Automation / Granular Access Token instead:');
  console.error('[publish]   1. https://www.npmjs.com/settings/~/tokens → Generate → Automation');
  console.error('[publish]      (or Granular: read/write for @contorium/mcp, bypass 2FA for CI)');
  console.error('[publish]   2. npm config set //registry.npmjs.org/:_authToken YOUR_TOKEN');
  console.error('[publish]   3. npm whoami   # must print your username');
  console.error('[publish]   4. npm run publish:npm');
  console.error('[publish] Dry-run without login:  npm run publish:npm:dry-run\n');
}

function ensureNpmAuth() {
  if (dryRun) {
    return;
  }
  const r = spawnSync('npm', ['whoami'], { encoding: 'utf8', shell: true });
  if (r.status !== 0) {
    printAuthHelp('ENEEDAUTH — not logged in to https://registry.npmjs.org/');
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
  // Keep bin path npm-clean (no leading ./) after any package.json rewrite.
  {
    const pkg = JSON.parse(fs.readFileSync(mcpPkgPath, 'utf8'));
    if (pkg.bin && typeof pkg.bin === 'object') {
      for (const [name, rel] of Object.entries(pkg.bin)) {
        if (typeof rel === 'string' && rel.startsWith('./')) {
          pkg.bin[name] = rel.slice(2);
        }
      }
      // Prefer single canonical field; npm treats these as aliases.
      if (pkg.bundledDependencies && pkg.bundleDependencies) {
        delete pkg.bundledDependencies;
      }
      fs.writeFileSync(mcpPkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    }
  }
  run('npm', ['run', 'build'], mcpDir);
  console.error('\n[publish] @contorium/mcp (with bundled state-core) …');
  const pub = spawnSync('npm', ['publish', '--access', 'public', ...(dryRun ? ['--dry-run'] : [])], {
    cwd: mcpDir,
    stdio: 'inherit',
    shell: true,
  });
  if (pub.status !== 0) {
    printAuthHelp(
      'npm publish failed — if you saw browser auth / E404 …/-/v1/done?authId=…, use a token (not browser login).',
    );
    process.exit(pub.status ?? 1);
  }
  console.error(dryRun ? '\n[publish] dry-run complete.' : '\n[publish] done — users: npm install -g @contorium/mcp');
} finally {
  restoreMcpPackageJson();
}
