import { prepareHandoffInjection, syncWorkspaceState } from '@contora/state-core';
import { findWorkspaceRoot, initWorkspaceFromArgv, resolveWorkspaceRoot } from './paths.js';

/** `contorium-mcp bootstrap` — one-shot runtime sync without starting stdio MCP. */
export async function runMcpBootstrapCli(argv: string[]): Promise<void> {
  initWorkspaceFromArgv(argv);
  const hint = resolveWorkspaceRoot();
  const root = await findWorkspaceRoot(hint);

  console.error(`[contorium-mcp] bootstrap workspace: ${root}`);
  const result = await syncWorkspaceState(root, 'mcp', { forceArtifacts: true });

  // Dashboard worker — invoke CLI bootstrap (do not recurse via scheduleMcpRuntimeBootstrap).
  const { resolveContoriumSpawn } = await import('./dashboardEnsure.js');
  const { spawn } = await import('node:child_process');
  const plan = resolveContoriumSpawn('bootstrap', root, ['--source', 'mcp']);
  const child = spawn(plan.command, plan.args, {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    shell: process.platform === 'win32' && plan.command.endsWith('npx.cmd'),
  });
  child.unref();

  const prep = await prepareHandoffInjection(root);

  console.error(`[contorium-mcp] bootstrap: mode=${result.mode} artifacts=${result.created ? 'created' : 'updated'}`);
  if (prep.shouldPrompt) {
    console.error('[contorium-mcp] handoff: pending — new AI chat will auto-prompt (Enter/i · n skip in terminal, [?] in IDE)');
  } else if (prep.alreadyInjected) {
    console.error('[contorium-mcp] handoff: already injected for this runtime');
  }
  console.error('[contorium-mcp] bootstrap complete — configure MCP host to spawn contorium-mcp for stdio server');
}
