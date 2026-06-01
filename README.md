![Contorium demo](./demo.gif)


# Contorium

**Shared Workspace State Layer for AI Tools**

Contorium creates a persistent project state inside your workspace that can be shared across IDEs, MCP agents, CLI tools, and AI coding assistants.

Switch between Cursor, Claude Code, Gemini CLI, VS Code, Codex, or any MCP-compatible agent without losing project understanding.

**Not chat memory.**
**Not prompt stuffing.**
**Not agent orchestration.**

Contorium acts as a shared workspace state layer that keeps your project context portable across tools, sessions, and models.

---

## Why Contorium?

Modern AI coding tools are powerful, but they all suffer from the same problem:

They lose project understanding when you switch tools, sessions, or conversations.

Examples:

* Cursor → Claude Code
* Claude Code → Gemini CLI
* VS Code → Terminal
* One AI model → Another AI model

Contorium solves this by maintaining a structured project state inside your repository.

Instead of relying on chat history, it continuously builds and updates:

* Current project goal
* Active modules
* Open problems
* Recent work
* Next actions

Every compatible tool can read the same state.

---

## Architecture

```text
Workspace
      │
      ▼
Contorium State Layer (.contora/)
      │
      ├── IDE Extension
      ├── MCP Server
      ├── CLI
      └── AI Agents
```

The workspace is the source of truth.

IDEs, MCP servers, CLI tools, and AI agents all interact with the same shared state layer.

---

## Features

### 🧠 Shared Project State

Persistent project understanding stored inside your workspace.

### 🔄 Cross-Tool Continuity

Move between Cursor, Claude Code, Gemini CLI, Codex, VS Code, and MCP agents without rebuilding context.

### 📋 AI-Ready Context Export

Generate clean, structured context for any AI assistant.

### ⚡ Tool-Independent Design

IDE, MCP, and CLI workflows can operate independently while sharing the same project state.

### 🏗 Workspace-Aware

Tracks:

* File activity
* Git changes
* Active modules
* Project evolution

### 🔍 Structured Snapshots

Produces stable project snapshots instead of raw chat logs.

---

## Quick Start

### IDE

Build and install the VSIX extension:

```bash
npm install
npm run compile
npm run vsix
```

Install the generated VSIX into VS Code or Cursor.

Open a workspace and use:

```text
Contorium: Copy AI-ready context
```

---

### MCP

Build the MCP server:

```bash
npm install
npm run compile
```

Configure your MCP host and set:

```text
CONTORIUM_WORKSPACE=/absolute/path/to/project
```

Typical usage:

```text
get_project_snapshot
get_workspace_context
get_project_state
```

---

### CLI

Initialize a workspace:

```bash
npx contorium init .
```

Generate a snapshot:

```bash
npx contorium snapshot .
```

View state:

```bash
npx contorium state .
```

---

## Example Snapshot

```text
Goal:
Develop documentation and authentication system

Current Stage:
Documentation work

Active Modules:
- app
- stream_session
- configuration

Open Problems:
- documentation consistency

Next Actions:
- update documentation
- validate authentication flow
```

---

## Documentation

| Guide                                            | Description                        |
| ------------------------------------------------ | ---------------------------------- |
| [Install Guide](./docs/INSTALL.md)               | Installation, usage, and uninstall |
| [IDE Extension](./docs/IDE_EXTENSION.md)         | VS Code and Cursor integration     |
| [MCP Server](./docs/MCP.md)                      | Claude Code, Cursor, Codex, Gemini |
| [CLI](./docs/CLI.md)                             | Terminal workflows                 |
| [State Engine](./docs/STATE_ENGINE.md)           | State generation and export        |
| [Architecture v2.2](./docs/ARCHITECTURE_V2_2.md) | Full system architecture           |
| [Runtime Package](./docs/RUNTIME.md)             | Runtime package documentation      |

---

## Design Principles

### Workspace First

The workspace is the source of truth.

### Tool Independence

IDE, MCP, and CLI workflows can operate independently.

### Stable State

Project state is deterministic and reproducible.

### Minimal Context

Exports remain concise and AI-friendly.

### Transparency

Conflicts are surfaced rather than automatically resolved.

---

## Repository Structure

```text
src/
├── scanner/
├── state/
├── state-engine/
├── state-builder/
├── cognition/
├── ai/
└── ui/

packages/
├── state-core/
├── mcp/
└── runtime/
```

---

## Supported Workflows

### IDE Only

VS Code / Cursor extension.

### MCP Only

Claude Code, Codex, Gemini, and other MCP-compatible agents.

### CLI Only

Terminal-based workflows and CI environments.

### Hybrid

Use IDE, MCP, and CLI together while sharing the same workspace state.

---

## Version

```text
Version: 0.7.x
State Engine: v2.2
Architecture: Shared Workspace State Layer
```

---

## Why It Matters

AI tools will continue to evolve.

Your project understanding should not be locked to any single tool.

Contorium keeps project state portable across:

* Tools
* Sessions
* Agents
* Models

---

**Website:** https://www.contorium.dev

Build once.
Switch tools freely.
Keep your project state.
