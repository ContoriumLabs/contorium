import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveCliDistModule } from './cliResolve.js';
import { attachDashboardFallback } from './dashboardAttach.js';

const attachScheduled = new Set<string>();

/**
 * MCP initialize → in-process bootstrap when possible; hidden node spawn fallback.
 * Never npx/npm exec (Codex shows "npm exec contorium bootstrap" flash window).
 */
export async function ensureMcpDashboardAttached(workspaceRoot: string): Promise<void> {
  const resolved = path.resolve(workspaceRoot);
  if (attachScheduled.has(resolved)) {
    return;
  }
  attachScheduled.add(resolved);
  setTimeout(() => attachScheduled.delete(resolved), 60_000);

  const bootstrapJs = resolveCliDistModule('runtime/bootstrap.js');
  if (bootstrapJs) {
    try {
      const mod = await import(pathToFileURL(bootstrapJs).href);
      await mod.bootstrapContoriumRuntime(resolved, 'mcp', { skipInitialSync: true });
      return;
    } catch (err) {
      console.error(
        '[contorium-mcp] in-process bootstrap failed:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  await attachDashboardFallback(resolved);
}
