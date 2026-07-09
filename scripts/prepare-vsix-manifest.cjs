'use strict';

/**
 * Strip monorepo-only fields from package.json before `vsce package`.
 * VSIX must not advertise bin paths to excluded packages/** (install validation noise).
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const backupPath = path.join(root, 'package.json.vsix.bak');

const STRIP_KEYS = ['bin', 'scripts', 'devDependencies'];

function strip() {
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(pkgPath, backupPath);
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  for (const key of STRIP_KEYS) {
    delete pkg[key];
  }
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  console.log('[vsix] Stripped package.json for VSIX (bin/scripts/devDependencies)');
}

function restore() {
  if (!fs.existsSync(backupPath)) {
    return;
  }
  fs.copyFileSync(backupPath, pkgPath);
  fs.unlinkSync(backupPath);
  console.log('[vsix] Restored package.json after VSIX');
}

const cmd = process.argv[2];
if (cmd === 'strip') {
  strip();
} else if (cmd === 'restore') {
  restore();
} else {
  console.error('Usage: node scripts/prepare-vsix-manifest.cjs strip|restore');
  process.exit(1);
}
