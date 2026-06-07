# @contorium/mcp

Standard MCP server for **Claude Code · Cursor · Codex · Gemini CLI**.

## Install

```bash
# global
npm install -g @contorium/mcp

# or one-shot
npx @contorium/mcp
```

Monorepo dev (this repo):

```bash
cd packages/mcp && npm run build
npx contorium-mcp --workspace /path/to/project
```

## Publish to npm

Only **one** npm package is required: `@contorium/mcp`.  
`@contora/state-core` is **bundled inside** the tarball (no separate `@contora` org needed).

```bash
npm login                    # once
npm run publish:npm          # publish @contorium/mcp
npm run publish:npm:dry-run  # validate tarball without login
```

## Bootstrap (without starting stdio server)

Pre-sync `.contora` and schedule dashboard before opening the AI host:

```bash
npx contorium-mcp bootstrap --workspace /path/to/your-project
# or after global install:
contorium-mcp bootstrap
```

## Start (stdio MCP server)

```bash
npx contorium-mcp
# or with explicit workspace
npx contorium-mcp --workspace E:/your-project
```

**Workspace priority:** `--workspace` → `CONTORIUM_WORKSPACE` → `.mcp.json` → current directory.

## MCP host config

### Cursor / Claude (`.mcp.json`)

```json
{
  "mcpServers": {
    "contorium": {
      "command": "npx",
      "args": ["@contorium/mcp"],
      "env": {
        "CONTORIUM_WORKSPACE": "E:/your-project"
      }
    }
  }
}
```

### Codex (`config.toml`)

```toml
[mcp_servers.contorium]
command = "npx"
args = ["@contorium/mcp"]
env = { CONTORIUM_WORKSPACE = "." }
```

## Standard tools (MCP v1)

| Tool | Purpose |
|------|---------|
| `get_handoff_injection_status` | Semi-auto new-chat prompt |
| `confirm_handoff_injection` | User confirmed (Y) |
| `skip_handoff_injection` | User declined (N) |
| `get_project_handoff` | CHP v1 AI memory (compact / markdown / json) |
| `get_recent_changes` | File & function updates |
| `get_understanding_graph` | Call chains + impact |
| `get_runtime_state` | Bootstrap / dashboard / session |

Legacy tools (`get_project_change`, `get_project_graph`, …) remain available.

## Requirements

- Node.js 18+
- Optional: `@contora/cli` (`npm i -g @contora/cli`) for dashboard bootstrap when not in monorepo
