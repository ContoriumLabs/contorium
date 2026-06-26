#!/usr/bin/env node
/**
 * Remove package dist/ before tsc — avoids TS5033 when a running MCP/CLI process locks
 * output files on Windows.
 *
 * Usage: node scripts/clean-dist.mjs packages/state-core
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = process.argv[2];
if (!rel) {
  process.exit(0);
}

const dist = path.join(root, rel, 'dist');
if (!fs.existsSync(dist)) {
  process.exit(0);
}

const isWin = process.platform === 'win32';
const maxRetries = isWin ? 10 : 4;
const baseDelayMs = isWin ? 350 : 150;

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* busy wait — short delays only */
  }
}

function unlinkWithRetry(filePath) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      fs.unlinkSync(filePath);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        sleep(baseDelayMs * attempt);
      }
    }
  }
  throw lastErr;
}

function removeTree(target) {
  if (!fs.existsSync(target)) {
    return;
  }
  for (const name of fs.readdirSync(target)) {
    const entry = path.join(target, name);
    const stat = fs.lstatSync(entry);
    if (stat.isDirectory()) {
      removeTree(entry);
    } else {
      unlinkWithRetry(entry);
    }
  }
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      fs.rmdirSync(target);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        sleep(baseDelayMs * attempt);
      }
    }
  }
  throw lastErr;
}

let lastErr;
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    removeTree(dist);
    process.exit(0);
  } catch (err) {
    lastErr = err;
    if (attempt < maxRetries) {
      sleep(baseDelayMs * attempt);
    }
  }
}

console.error(
  `[clean-dist] Could not remove ${path.relative(root, dist)} after ${maxRetries} attempts.`,
);
console.error(
  '[clean-dist] Stop Contorium MCP / CLI dashboard / VS Code tasks that may lock dist/, then retry.',
);
console.error('[clean-dist] Windows: close Cursor MCP panel or run: Get-Process node | Stop-Process');
if (lastErr instanceof Error) {
  console.error(`[clean-dist] ${lastErr.message}`);
}
process.exit(1);
