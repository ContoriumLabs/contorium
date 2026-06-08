---
name: setup-mcp-codex
description: Build Contorium and install the Codex plugin with bundled MCP memory tools.
---

# Setup Contorium for Codex

1. From the repository root: `npm run build:mcp` (or `npm run compile`).
2. **Plugin (recommended):** install this repo as a Codex plugin (manifest at `.codex-plugin/plugin.json`, MCP at `.mcp.json`).
3. **MCP only (local dev — recommended on Windows):**
   ```powershell
   node scripts/setup-codex-mcp-local.mjs
   ```
   This patches `~/.codex/config.toml` to use `node E:/sessionrecall/packages/mcp/bin/contorium-mcp.js` instead of `npx @contorium/mcp` (npx opens visible console windows).

   Or manually: `codex mcp add contorium -- node E:/sessionrecall/packages/mcp/bin/contorium-mcp.js`
4. Do **not** use `npx @contorium/mcp` on Windows — it spawns `npm exec contorium bootstrap` flash windows.
5. Keep the **Contorium VS Code/Cursor extension** for sidebar UI and `.contora/state.json`; Codex MCP tools complement the extension.

Tools: `store_memory`, `search_memory`, `get_memory`, `get_workspace_context`.

See [docs/MCP.md](../docs/MCP.md) and [OpenAI Codex plugins](https://developers.openai.com/codex/plugins/build).
