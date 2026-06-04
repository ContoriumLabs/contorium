#!/usr/bin/env node
/** Remove package dist/ before tsc — avoids TS5033 when a running MCP process locks output files on Windows. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = process.argv[2];
if (!rel) {
  process.exit(0);
}
const dist = path.join(root, rel, 'dist');
if (fs.existsSync(dist)) {
  fs.rmSync(dist, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
}
