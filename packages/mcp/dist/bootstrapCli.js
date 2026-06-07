import { prepareHandoffInjection, syncWorkspaceState } from '@contora/state-core';
import { scheduleMcpRuntimeBootstrap } from './dashboardEnsure.js';
import { findWorkspaceRoot, initWorkspaceFromArgv, resolveWorkspaceRoot } from './paths.js';
/** `contorium-mcp bootstrap` — one-shot runtime sync without starting stdio MCP. */
export async function runMcpBootstrapCli(argv) {
    initWorkspaceFromArgv(argv);
    const hint = resolveWorkspaceRoot();
    const root = await findWorkspaceRoot(hint);
    console.error(`[contorium-mcp] bootstrap workspace: ${root}`);
    const result = await syncWorkspaceState(root, 'mcp', { forceArtifacts: true });
    scheduleMcpRuntimeBootstrap(root);
    const prep = await prepareHandoffInjection(root);
    console.error(`[contorium-mcp] bootstrap: mode=${result.mode} artifacts=${result.created ? 'created' : 'updated'}`);
    if (prep.shouldPrompt) {
        console.error('[contorium-mcp] handoff: pending — new AI chat will auto-prompt (Enter/i · n skip in terminal, [?] in IDE)');
    }
    else if (prep.alreadyInjected) {
        console.error('[contorium-mcp] handoff: already injected for this runtime');
    }
    console.error('[contorium-mcp] bootstrap complete — configure MCP host to spawn contorium-mcp for stdio server');
}
