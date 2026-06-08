import { findWorkspaceRoot, initWorkspaceFromArgv, resolveWorkspaceRoot } from './paths.js';
import { ensureMcpDashboardAttached } from './runtimeAttach.js';

/** `contorium-mcp bootstrap` — one-shot runtime sync without starting stdio MCP. */
export async function runMcpBootstrapCli(argv: string[]): Promise<void> {
  initWorkspaceFromArgv(argv);
  const hint = resolveWorkspaceRoot();
  const root = await findWorkspaceRoot(hint);

  console.error(`[contorium-mcp] bootstrap workspace: ${root}`);
  await ensureMcpDashboardAttached(root);
  console.error('[contorium-mcp] bootstrap complete');
}
