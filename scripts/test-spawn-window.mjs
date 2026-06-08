#!/usr/bin/env node
import { exec, spawn } from 'node:child_process';
import fs from 'node:fs';

const bat = 'E:\\codex\\.contora\\dashboard.cmd';
const root = 'E:\\codex';

try { fs.unlinkSync(`${root}\\.contora\\dashboard.pid`); } catch { /* ignore */ }

const mode = process.argv[2] ?? 'exec';

if (mode === 'exec') {
  exec(`start "Contorium Dashboard" cmd /k call "${bat}"`, { cwd: root });
} else if (mode === 'spawn-shell') {
  spawn(`start "Contorium Dashboard" cmd /k call "${bat}"`, {
    cwd: root,
    shell: true,
    detached: true,
    stdio: 'ignore',
  }).unref();
} else if (mode === 'ps1-file') {
  spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', `${root}\\.contora\\dashboard-open.ps1`], {
    cwd: root,
    shell: true,
    detached: true,
    stdio: 'ignore',
  }).unref();
}

setTimeout(() => {
  const pidFile = `${root}\\.contora\\dashboard.pid`;
  if (fs.existsSync(pidFile)) {
    console.error('OK pid', fs.readFileSync(pidFile, 'utf8').trim());
  } else {
    console.error('FAIL no pid');
    process.exit(1);
  }
}, 10000);
