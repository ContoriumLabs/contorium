'use strict';

/**
 * Strip monorepo-only fields from package.json before `vsce package`.
 * VSIX must not advertise bin paths to excluded packages/** (install validation noise).
 *
 * Windows often returns UNKNOWN (-4094) / EBUSY when package.json is briefly locked
 * (IDE, antivirus, npm). Writes retry with backoff and use a temp file + rename.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const backupPath = path.join(root, 'package.json.vsix.bak');
const tmpPath = path.join(root, 'package.json.vsix.tmp');

const STRIP_KEYS = ['bin', 'scripts', 'devDependencies'];
const MAX_ATTEMPTS = 8;
const BASE_DELAY_MS = 150;

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* busy-wait: no async in this sync CLI helper */
  }
}

function isRetryableFsError(err) {
  const code = err && err.code;
  return (
    code === 'UNKNOWN' ||
    code === 'EBUSY' ||
    code === 'EPERM' ||
    code === 'EACCES' ||
    code === 'ENOENT' ||
    code === 'EAGAIN'
  );
}

function withRetry(label, fn) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryableFsError(err) || attempt === MAX_ATTEMPTS) {
        break;
      }
      const delay = BASE_DELAY_MS * attempt;
      console.warn(`[vsix] ${label} retry ${attempt}/${MAX_ATTEMPTS} after ${delay}ms (${err.code || err.message})`);
      sleep(delay);
    }
  }
  const hint =
    'Close other tools locking package.json (another npm/vsce, Explorer preview), then retry.';
  console.error(`[vsix] Failed ${label}: ${lastErr && lastErr.message}`);
  console.error(`[vsix] ${hint}`);
  throw lastErr;
}

function writeJsonAtomic(targetPath, text) {
  withRetry(`write ${path.basename(tmpPath)}`, () => {
    fs.writeFileSync(tmpPath, text, 'utf8');
  });
  withRetry(`replace ${path.basename(targetPath)}`, () => {
    try {
      fs.renameSync(tmpPath, targetPath);
    } catch (err) {
      // Windows: rename onto existing file can fail — fall back to copy+unlink
      if (err && (err.code === 'EEXIST' || err.code === 'EPERM' || err.code === 'UNKNOWN')) {
        fs.copyFileSync(tmpPath, targetPath);
        try {
          fs.unlinkSync(tmpPath);
        } catch {
          /* ignore */
        }
        return;
      }
      throw err;
    }
  });
}

function strip() {
  withRetry('backup package.json', () => {
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(pkgPath, backupPath);
    }
  });

  const pkg = JSON.parse(
    withRetry('read package.json', () => fs.readFileSync(pkgPath, 'utf8')),
  );
  for (const key of STRIP_KEYS) {
    delete pkg[key];
  }
  writeJsonAtomic(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log('[vsix] Stripped package.json for VSIX (bin/scripts/devDependencies)');
}

function restore() {
  if (!fs.existsSync(backupPath)) {
    return;
  }
  withRetry('restore package.json from backup', () => {
    fs.copyFileSync(backupPath, pkgPath);
  });
  withRetry('remove backup', () => {
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
  });
  if (fs.existsSync(tmpPath)) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
  }
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
