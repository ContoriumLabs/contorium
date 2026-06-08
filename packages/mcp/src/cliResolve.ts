import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Find sessionrecall monorepo root from MCP entry or env. */
export function findMonorepoRoot(): string | undefined {
  const fromEnv = process.env.CONTORIUM_REPO?.trim() || process.env.CONTORIUM_MONOREPO?.trim();
  if (fromEnv) {
    const root = path.resolve(fromEnv);
    if (fs.existsSync(path.join(root, 'packages', 'cli', 'bin', 'contorium.cjs'))) {
      return root;
    }
  }

  const entry = process.argv[1];
  if (entry) {
    let dir = path.dirname(path.resolve(entry));
    for (let i = 0; i < 10; i++) {
      if (fs.existsSync(path.join(dir, 'packages', 'cli', 'bin', 'contorium.cjs'))) {
        return dir;
      }
      const parent = path.dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const fromMcpPkg = path.resolve(here, '../../..');
  if (fs.existsSync(path.join(fromMcpPkg, 'packages', 'cli', 'bin', 'contorium.cjs'))) {
    return fromMcpPkg;
  }

  return undefined;
}

/** Resolve contorium.cjs — never npx/npm exec (Windows console flash). */
export function resolveContoriumCliBinary(): string | undefined {
  const env = process.env.CONTORIUM_CLI_PATH?.trim();
  if (env && fs.existsSync(env)) {
    return env;
  }

  const root = findMonorepoRoot();
  if (root) {
    const cli = path.join(root, 'packages', 'cli', 'bin', 'contorium.cjs');
    if (fs.existsSync(cli)) {
      return cli;
    }
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, '../../cli/bin/contorium.cjs'),
    path.resolve(here, '../bin/contorium-cli.cjs'),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

export function resolveCliDistModule(relativePath: string): string | undefined {
  const root = findMonorepoRoot();
  if (root) {
    const mod = path.join(root, 'packages', 'cli', 'dist', relativePath);
    if (fs.existsSync(mod)) {
      return mod;
    }
  }

  const envCli = process.env.CONTORIUM_CLI_PATH?.trim();
  if (envCli) {
    const mod = path.resolve(path.dirname(envCli), '../dist', relativePath);
    if (fs.existsSync(mod)) {
      return mod;
    }
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const mod = path.resolve(here, '../../cli/dist', relativePath);
  return fs.existsSync(mod) ? mod : undefined;
}
