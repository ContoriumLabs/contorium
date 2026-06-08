#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ws = process.argv[2] ?? root;

for (const f of ['dashboard.pid', 'dashboard.spawn.lock']) {
  try {
    fs.unlinkSync(path.join(ws, '.contora', f));
  } catch {
    // ignore
  }
}

const r = spawn(process.execPath, [path.join(root, 'packages/cli/bin/contorium.cjs'), 'bootstrap', ws, '--source', 'mcp'], {
  stdio: 'inherit',
  cwd: root,
});
r.on('exit', (code) => {
  setTimeout(() => {
    const pidFile = path.join(ws, '.contora', 'dashboard.pid');
    let pid = '';
    try {
      pid = fs.readFileSync(pidFile, 'utf8').trim();
    } catch {
      console.error('NO pid file');
      process.exit(1);
    }
    try {
      process.kill(Number(pid), 0);
      console.error(`OK worker alive pid=${pid}`);
    } catch {
      console.error(`FAIL worker dead pid=${pid}`);
      const log = path.join(ws, '.contora', 'dashboard.log');
      if (fs.existsSync(log)) {
        console.error('--- dashboard.log ---');
        console.error(fs.readFileSync(log, 'utf8').slice(-2000));
      }
      process.exit(1);
    }
  }, 4000);
});
