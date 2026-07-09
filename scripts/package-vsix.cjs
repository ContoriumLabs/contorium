'use strict';

const { spawnSync } = require('child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

/** Restore devDependencies after prune — avoid rewriting package-lock (Windows EBUSY). */
function restoreDevDeps() {
  const baseArgs = ['install', '--no-audit', '--no-fund', '--no-save', '--no-package-lock'];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = spawnSync('npm', baseArgs, { cwd: root, stdio: 'inherit', shell: true });
    if (r.status === 0) {
      return true;
    }
    if (attempt < 3) {
      console.warn(`[vsix] devDependencies restore retry ${attempt + 1}/3…`);
      spawnSync('powershell', ['-NoProfile', '-Command', 'Start-Sleep -Milliseconds 800'], {
        stdio: 'ignore',
        shell: true,
      });
    }
  }
  return false;
}

function findPackagedVsix() {
  const matches = fs
    .readdirSync(root)
    .filter((f) => f.endsWith('.vsix'))
    .map((f) => ({ f, mtime: fs.statSync(path.join(root, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return matches[0]?.f;
}

run('npm', ['run', 'compile']);
run('npm', ['prune', '--omit=dev']);
run('node', ['scripts/materialize-deps-for-vsix.mjs']);
run('node', ['scripts/prepare-vsix-manifest.cjs', 'strip']);
process.env.CONTORA_SKIP_PREPUBLISH = '1';
try {
  run('vsce', ['package', '--follow-symlinks']);
} finally {
  delete process.env.CONTORA_SKIP_PREPUBLISH;
  run('node', ['scripts/prepare-vsix-manifest.cjs', 'restore']);
}

const vsix = findPackagedVsix();
if (vsix) {
  console.log(`[vsix] Packaged: ${path.join(root, vsix)}`);
}

if (!restoreDevDeps()) {
  console.warn(
    '[vsix] devDependencies restore skipped (package-lock busy). VSIX is ready — run manually if needed:',
  );
  console.warn('  npm install --no-save --no-package-lock');
}
