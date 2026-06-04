import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let cachedVersion: string | undefined;

/** Read @contora/state-core version from package.json (not hardcoded). */
export function getContoriumPackageVersion(): string {
  if (cachedVersion) {
    return cachedVersion;
  }
  try {
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    cachedVersion = pkg.version ?? '0.0.0';
  } catch {
    cachedVersion = '0.0.0';
  }
  return cachedVersion;
}
