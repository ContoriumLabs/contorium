'use strict';

const { spawnSync } = require('child_process');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

run('npm', ['run', 'compile']);
run('npm', ['prune', '--omit=dev']);
run('node', ['scripts/materialize-deps-for-vsix.mjs']);
process.env.CONTORA_SKIP_PREPUBLISH = '1';
run('vsce', ['package', '--follow-symlinks']);
delete process.env.CONTORA_SKIP_PREPUBLISH;
run('npm', ['install']);
