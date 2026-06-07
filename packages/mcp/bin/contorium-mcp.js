#!/usr/bin/env node

/**

 * @contorium/mcp — standard npm entry (npx contorium-mcp / npx @contorium/mcp)

 * Workspace: --workspace > CONTORIUM_WORKSPACE > .mcp.json > cwd

 *

 * Subcommands:

 *   contorium-mcp bootstrap [--workspace PATH]  — sync .contora + schedule dashboard (no stdio server)

 *   contorium-mcp                               — start MCP stdio server (default)

 */

const sub = process.argv[2];

if (sub === 'bootstrap') {

  const { runMcpBootstrapCli } = await import('../dist/bootstrapCli.js');

  await runMcpBootstrapCli(process.argv.slice(2));

} else {

  const { startMcpServer } = await import('../dist/server.js');

  await startMcpServer();

}

