#!/usr/bin/env node
/**
 * Patch ~/.codex/config.toml — use local node MCP (not npx @contorium/mcp).
 * npx on Windows opens visible "npm exec contorium bootstrap" windows.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mcpEntry = path.join(repoRoot, 'packages', 'mcp', 'bin', 'contorium-mcp.js').replace(/\\/g, '/');
const cliPath = path.join(repoRoot, 'packages', 'cli', 'bin', 'contorium.cjs').replace(/\\/g, '/');

const configPath = path.join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.codex', 'config.toml');

if (!fs.existsSync(configPath)) {
  console.error(`Codex config not found: ${configPath}`);
  process.exit(1);
}

const block = `[mcp_servers.contorium]
command = "node"
args = ["${mcpEntry}"]

[mcp_servers.contorium.env]
CONTORIUM_CLI_PATH = "${cliPath}"
CONTORIUM_REPO = "${repoRoot.replace(/\\/g, '/')}"
`;

let text = fs.readFileSync(configPath, 'utf8');
text = text.replace(/\[mcp_servers\.contorium\][\s\S]*?(?=\n\[|\n*$)/, `${block}\n`);
if (!text.includes('[mcp_servers.contorium]')) {
  text = `${text.trim()}\n\n${block}\n`;
}

fs.writeFileSync(configPath, text, 'utf8');
console.error('[contorium] Updated Codex MCP config (local node, no npx):');
console.error(`  ${configPath}`);
console.error('Restart Codex completely for changes to apply.');
