#!/usr/bin/env node
/**
 * Sync version from root package.json to plugin manifests, workspace packages, and lockfiles.
 * Usage: npm run version:sync
 * Bump flow: edit package.json version (or `npm version patch`) then run version:sync / compile.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const maxRetries = isWin ? 10 : 3;
const baseDelayMs = isWin ? 350 : 150;

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* short busy wait */
  }
}

function readFileWithRetry(fp) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return readFileSync(fp, 'utf8');
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        sleep(baseDelayMs * attempt);
      }
    }
  }
  throw lastErr;
}

function writeFileWithRetry(fp, content) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      writeFileSync(fp, content, 'utf8');
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        sleep(baseDelayMs * attempt);
      }
    }
  }
  const rel = path.relative(repoRoot, fp);
  console.error(`[version:sync] Could not write ${rel} after ${maxRetries} attempts.`);
  console.error('[version:sync] Close Cursor/IDE tabs locking plugin manifests, or: Get-Process node | Stop-Process');
  throw lastErr;
}
const rootPkgPath = path.join(repoRoot, 'package.json');
const rootPkg = JSON.parse(readFileWithRetry(rootPkgPath));
const version = rootPkg.version;

if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(`Invalid version in ${rootPkgPath}: ${String(version)}`);
  process.exit(1);
}

function writeJson(rel, data) {
  const fp = path.join(repoRoot, rel);
  writeFileWithRetry(fp, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`  ${rel}`);
}

function patchJson(rel, patch) {
  const fp = path.join(repoRoot, rel);
  const data = JSON.parse(readFileWithRetry(fp));
  patch(data);
  writeJson(rel, data);
}

function syncLockfile(rel, names) {
  const fp = path.join(repoRoot, rel);
  const lock = JSON.parse(readFileWithRetry(fp));
  if (names.includes(lock.name)) {
    lock.version = version;
  }
  const rootEntry = lock.packages?.[''];
  if (rootEntry && names.includes(rootEntry.name)) {
    rootEntry.version = version;
  }
  for (const pkgPath of ['packages/runtime', 'packages/state-core']) {
    if (lock.packages?.[pkgPath]?.name?.startsWith('@contora/')) {
      lock.packages[pkgPath].version = version;
    }
  }
  writeJson(rel, lock);
}

console.log(`Syncing version ${version} from package.json\n`);

for (const rel of ['.cursor-plugin/plugin.json', '.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
  patchJson(rel, (d) => {
    d.version = version;
  });
}

for (const rel of [
  'packages/mcp/package.json',
  'packages/runtime/package.json',
  'packages/state-core/package.json',
  'packages/cli/package.json',
]) {
  patchJson(rel, (d) => {
    d.version = version;
  });
}

patchJson('package.json', (d) => {
  if (d.dependencies) {
    for (const key of Object.keys(d.dependencies)) {
      const val = d.dependencies[key];
      if (typeof val === 'string' && val.includes('.vscode-pack/contora-')) {
        d.dependencies[key] = val.replace(/-\d+\.\d+\.\d+\.tgz$/, `-${version}.tgz`);
      }
    }
  }
});

syncLockfile('package-lock.json', ['contorium']);
syncLockfile('packages/mcp/package-lock.json', ['@contorium/mcp']);

console.log('\nDone. Run npm run build:mcp if MCP dist is stale.');
