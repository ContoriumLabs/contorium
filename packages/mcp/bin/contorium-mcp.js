#!/usr/bin/env node

/**
 * @contorium/mcp — standard npm entry
 * Workspace: --workspace > CONTORIUM_WORKSPACE > .mcp.json > cwd
 *
 * Subcommands:
 *   contorium-mcp bootstrap [--workspace PATH]  — sync .contora + dashboard (no stdio server)
 *   contorium-mcp                               — start MCP stdio server (default)
 *
 * Codex: use `node …/contorium-mcp.js` — NOT `npx @contorium/mcp` (Windows console flash).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const monorepoCli = path.resolve(here, '../../cli/bin/contorium.cjs');
if (fs.existsSync(monorepoCli)) {
  process.env.CONTORIUM_CLI_PATH ??= monorepoCli;
  process.env.CONTORIUM_REPO ??= path.resolve(here, '../..');
}
// MCP/Codex startup: no git.exe until runtime file/git activity (see gitRuntime.ts).
process.env.CONTORIUM_ALLOW_GIT ??= '0';

const sub = process.argv[2];

if (sub === 'bootstrap') {
  const { runMcpBootstrapCli } = await import('../dist/bootstrapCli.js');
  await runMcpBootstrapCli(process.argv.slice(2));
} else {
  const { startMcpServer } = await import('../dist/server.js');
  await startMcpServer();
}
