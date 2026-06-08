import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { scheduleMcpRuntimeBootstrap } from './dashboardEnsure.js';

const attachScheduled = new Set<string>();

function resolveCliModule(relativePath: string): string | undefined {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidate = path.resolve(here, '../../cli/dist', relativePath);
  return fs.existsSync(candidate) ? candidate : undefined;
}

/**
 * MCP initialize → bootstrap + one dashboard window in-process (no extra cmd with JSON).
 */
export async function ensureMcpDashboardAttached(workspaceRoot: string): Promise<void> {
  const root = path.resolve(workspaceRoot);
  if (attachScheduled.has(root)) {
    return;
  }
  attachScheduled.add(root);
  setTimeout(() => attachScheduled.delete(root), 60_000);

  const bootstrapJs = resolveCliModule('runtime/bootstrap.js');
  if (!bootstrapJs) {
    scheduleMcpRuntimeBootstrap(root);
    return;
  }

  try {
    const mod = await import(pathToFileURL(bootstrapJs).href);
    await mod.bootstrapContoriumRuntime(root, 'mcp');
  } catch (err) {
    console.error(
      '[contorium-mcp] dashboard attach failed:',
      err instanceof Error ? err.message : err,
    );
    scheduleMcpRuntimeBootstrap(root);
  }
}
