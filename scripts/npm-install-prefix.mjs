#!/usr/bin/env node
/**
 * npm install --prefix with Windows retry (UNKNOWN / errno -4094 on package-lock.json).
 *
 * Usage: node scripts/npm-install-prefix.mjs packages/mcp
 *        node scripts/npm-install-prefix.mjs packages/cli --no-fund --no-audit
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const prefixArg = args[0];

if (!prefixArg) {
  console.error('[npm-install-prefix] Usage: node scripts/npm-install-prefix.mjs <packages/…> [npm flags…]');
  process.exit(1);
}

const prefixDir = path.resolve(root, prefixArg);
const npmArgs = ['install', '--prefix', prefixDir, ...args.slice(1)];
const isWin = process.platform === 'win32';
const maxAttempts = isWin ? 6 : 2;
const baseDelayMs = isWin ? 400 : 200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runInstall() {
  return spawnSync('npm', npmArgs, {
    cwd: root,
    stdio: 'inherit',
    shell: isWin,
    env: process.env,
  });
}

async function main() {
  let last = runInstall();
  for (let attempt = 2; attempt <= maxAttempts && last.status !== 0; attempt++) {
    if (!isWin) {
      break;
    }
    console.error(
      `[npm-install-prefix] install failed for ${prefixArg} — retry ${attempt}/${maxAttempts} (Windows lock recovery)…`,
    );
    await sleep(baseDelayMs * attempt);
    last = runInstall();
  }

  if (last.status !== 0) {
    console.error(
      `[npm-install-prefix] Could not install in ${prefixArg}. Stop Contorium MCP / dashboard / other npm processes, then retry.`,
    );
    console.error('[npm-install-prefix] Windows: Get-Process node | Stop-Process');
  }

  process.exit(last.status ?? 1);
}

void main();
