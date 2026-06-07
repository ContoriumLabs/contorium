# Contorium Documentation

All project documentation is **English**, except the internal design note [`v3.1状态引擎升级.md`](../v3.1状态引擎升级.md) (Chinese, V3.1 cognitive engine design history).

## Start here

| Doc | Description |
|-----|-------------|
| [../README.md](../README.md) | Product overview and quick start |
| [INSTALL.md](./INSTALL.md) | Install / use / uninstall — IDE, MCP, CLI |
| [DASHBOARD.md](./DASHBOARD.md) | Runtime dashboard (Passive mini-graph / Expanded fullscreen), semi-auto inject |
| [ENGINEERING_CLOSURE.md](./ENGINEERING_CLOSURE.md) | **Frozen** V3.1 boundary rules (closure v1) |

## What's new (runtime / MCP v1)

| Feature | Normal use (automatic) | Debug only |
|---------|------------------------|------------|
| **Semi-auto handoff** | New AI chat → auto prompt | `handoff --prompt-new-chat` |
| **Expanded dashboard** | **Space** in terminal | `handoff --show` |
| **Passive + mini-graph** | Auto on runtime bootstrap | `contorium attach --auto` |

## Adapters

| Doc | Description |
|-----|-------------|
| [IDE_EXTENSION.md](./IDE_EXTENSION.md) | VS Code / Cursor extension |
| [MCP.md](./MCP.md) | `@contorium/mcp` — install, host setup (Cursor/Codex/Claude/Gemini), CHP v1 tools |
| [CLI.md](./CLI.md) | Terminal commands, handoff, dashboard |

## Architecture

| Doc | Description |
|-----|-------------|
| [STATE_ENGINE.md](./STATE_ENGINE.md) | L0–L5 state model |
| [ARCHITECTURE_V2_2.md](./ARCHITECTURE_V2_2.md) | Three peer adapters + dual-mode |
| [ARCHITECTURE_V3.md](./ARCHITECTURE_V3.md) | V3.1 understanding + cognitive graph |
| [RUNTIME.md](./RUNTIME.md) | `@contora/runtime` package |
| [UPGRADE_PLAN_2.x.md](./UPGRADE_PLAN_2.x.md) | 2.x upgrade notes |

## Commands (Cursor / agent)

| Doc | Description |
|-----|-------------|
| [../commands/copy-ai-context.md](../commands/copy-ai-context.md) | Copy AI-ready context |
| [../commands/learn-workspace-intent.md](../commands/learn-workspace-intent.md) | BYOK intent learning |
| [../commands/start-fresh-session.md](../commands/start-fresh-session.md) | Fresh session |
| [../commands/setup-mcp-claude-code.md](../commands/setup-mcp-claude-code.md) | Claude Code MCP |
| [../commands/setup-mcp-codex.md](../commands/setup-mcp-codex.md) | Codex MCP |

## Design note (Chinese only)

| Doc | Language |
|-----|----------|
| [../v3.1状态引擎升级.md](../v3.1状态引擎升级.md) | Chinese — Version / Confidence / Hotspot / Snapshot design rationale |
