![Contorium demo](./demo.gif)

# Contorium

### Persistent Project Memory for AI Coding Tools

AI coding assistants lose context when chats end.

Contorium gives Claude Code, Codex, Cursor, Gemini CLI, VS Code, and MCP-compatible tools a shared, continuously updated understanding of your project, allowing work to continue across sessions, tools, and models without constantly rebuilding context.

**No custom models. No lock-in. Just continuity.**

Works with:

* Claude Code
* Codex
* Cursor
* Gemini CLI
* VS Code
* Any MCP-compatible AI tool

🌐 https://www.contorium.dev/

---

# The Problem

Every AI coding session starts the same way:

> "Here is my architecture..."
>
> "Here are the important modules..."
>
> "Here is what we were working on..."

Then you:

* start a new chat
* switch AI tools
* change models
* return the next day

and repeat the process again.

Modern AI tools are powerful, but project understanding is often trapped inside individual conversations.

Projects continue.

Context does not.

---

# The Solution

Contorium maintains a continuously updated understanding of your workspace and makes it available wherever you work.

Instead of:

```text
AI
↓
Forgets Project
↓
Rebuilds Context
↓
Repeats Work
```

You get:

```text
AI
↓
Understands Project
↓
Continues Work
↓
Stays Aligned
```

Contorium acts as a shared project memory layer between your codebase and your AI tools.

---

# How It Works

```text
Workspace Activity
↓
Runtime Understanding Layer
↓
Knowledge Graph
↓
Project Memory
↓
Runtime Snapshot
↓
AI Handoff
↓
Any AI Tool
```

All project understanding is stored locally and continuously updated as your workspace evolves.

---

# Core Features

## Persistent Project Memory

Project understanding survives:

* new chats
* model switches
* tool changes
* IDE restarts
* long development cycles

Contorium continuously maintains awareness of:

* architecture
* project intent
* active tasks
* module relationships
* recent changes
* important code paths

## AI Handoff

Start a new AI conversation without losing momentum.

When active runtime context exists:

```text
[?] Runtime active.
Inject current project state? (Y/n)
```

Choose:

```text
Enter → Continue current work
N      → Start fresh
```

You remain in control.

No automatic prompt injection.

No hidden behavior.

## Cross-Tool Continuity

Move freely between:

* Claude Code
* Codex
* Cursor
* Gemini CLI
* VS Code

while keeping a shared understanding of your project.

```text
Claude Code
↓
Contorium
↓
Codex
↓
Cursor
↓
Gemini CLI

Shared Project Understanding
```

## Runtime Dashboard

Live project awareness while you work.

Passive Mode:

```text
[●] task: fix MCP bootstrap
    last: calculateRisk()
    agent: mcp
```

Expanded Mode includes:

* Impact Graph
* Function Call Chains
* Runtime Timeline
* AI Handoff
* Project Status
* Copy To AI Export

Available in:

* CLI
* VS Code
* Cursor

## Knowledge Graph

Contorium continuously maps relationships across your workspace:

```text
Intent
↓
Module
↓
File
↓
Function
```

This creates a structured understanding layer rather than isolated files and conversations.

## Hotspot Detection

Automatically identifies areas that matter most right now:

* frequently edited files
* active modules
* critical functions
* high-impact code paths

Helping both developers and AI tools focus on relevant context.

## Runtime Snapshot

AI-ready project state containing:

* current goal
* active task
* recent changes
* important functions
* project intent
* runtime context

Used for:

* AI handoff
* model switching
* new conversations
* continuity workflows

## Governance Engine (V4)

Contorium includes an optional governance layer that helps maintain project consistency across IDE, CLI, and MCP workflows.

Features include:

* change review
* decision tracking
* scope analysis
* trace generation
* governance-aware exports

Unified governance artifacts are stored under:

```text
.contora/governance/
├── review.json
├── decision.json
├── scope.json
├── trace.json
├── trace-full.json
└── cycle.json
```

All governance workflows share the same artifact model and export pipeline.

---

# Supported Tools

| Tool        | Support |
| ----------- | ------- |
| Claude Code | ✅      |
| Codex       | ✅      |
| Cursor      | ✅      |
| Gemini CLI  | ✅      |
| VS Code     | ✅      |
| MCP Hosts   | ✅      |

---

# Quick Start

## Install MCP

```bash
npm install -g @contorium/mcp
```

## Configure Your AI Tool

### Codex

```bash
codex mcp add contorium -- npx @contorium/mcp
```

### Claude Code

```bash
claude mcp add --scope project contorium -- npx @contorium/mcp
```

### Manual Configuration

```json
{
  "mcpServers": {
    "contorium": {
      "command": "npx",
      "args": ["@contorium/mcp"],
      "env": {
        "CONTORIUM_WORKSPACE": "/path/to/project"
      }
    }
  }
}
```

## Start Coding

Open Claude Code, Codex, Cursor, or another MCP-compatible tool.

Contorium starts automatically and begins building project understanding from your workspace.

No manual runtime commands required.

---

# Install Options

Contorium provides three peer adapters that share the same project memory layer.

| Adapter | Package           | Best For                                     |
| ------- | ----------------- | -------------------------------------------- |
| MCP     | @contorium/mcp    | Claude Code, Codex, Cursor Agent, Gemini CLI |
| IDE     | VS Code Extension | VS Code, Cursor                              |
| CLI     | contorium         | Terminal workflows, CI, automation           |

All adapters share:

```text
.contora/
```

allowing project understanding to persist across tools.

---

# Architecture

Contorium consists of three adapters sharing the same runtime core:

```text
┌─────────────┐
│ IDE Adapter │
└──────┬──────┘
       │
┌──────▼──────┐
│ CLI Adapter │
└──────┬──────┘
       │
┌──────▼──────┐
│ MCP Adapter │
└──────┬──────┘
       │
       ▼
@contora/state-core
       │
       ▼
.contora/
```

The shared runtime layer maintains project understanding independent of any individual AI tool.

For detailed architecture documentation:

* [docs/ARCHITECTURE_V3.md](docs/ARCHITECTURE_V3.md)

---

# Local-First Design

Everything is stored locally.

```text
.contora/
├── state.json
├── handoff.json
├── change.json
├── graph.json
├── timeline.json
├── graph/
├── governance/
├── events/
└── mcp/
```

Your project memory stays with your workspace.

Not with a specific model.

Not with a specific vendor.

---

# Latest Features

| Feature                   | Status |
| ------------------------- | ------ |
| Persistent Project Memory | ✅      |
| Runtime Dashboard         | ✅      |
| AI Handoff                | ✅      |
| Cross-Tool Continuity     | ✅      |
| Knowledge Graph           | ✅      |
| Hotspot Detection         | ✅      |
| Governance Engine (V4)    | ✅      |
| Unified Governance Export | ✅      |
| MCP Integration           | ✅      |

**Version:** 0.9.5

---

# Documentation

| Resource      | Link                                              |
| ------------- | ------------------------------------------------- |
| Installation  | [docs/INSTALL.md](docs/INSTALL.md)                |
| MCP Setup     | [docs/MCP.md](docs/MCP.md)                        |
| CLI Guide     | [docs/CLI.md](docs/CLI.md)                        |
| Dashboard     | [docs/DASHBOARD.md](docs/DASHBOARD.md)            |
| IDE Extension | [docs/IDE_EXTENSION.md](docs/IDE_EXTENSION.md)      |
| Architecture  | [docs/ARCHITECTURE_V3.md](docs/ARCHITECTURE_V3.md) |
| State Engine  | [docs/STATE_ENGINE.md](docs/STATE_ENGINE.md)      |

---

# What Contorium Is Not

Contorium is not:

* an autonomous coding agent
* a task generator
* an AI replacement
* a planning system

Contorium does not decide what to build.

Developers remain in control.

> Contorium preserves understanding, not decisions.

---

# Vision

AI coding tools have context windows.

Projects need continuity.

Contorium provides the missing project memory layer between your codebase and your AI tools.

Because conversations end.

Project understanding should not.

---

# Links

* **Website:** https://www.contorium.dev/
* **GitHub:** https://github.com/ContoriumLabs/contorium

---

# License

See LICENSE.
