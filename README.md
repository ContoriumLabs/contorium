![Contorium demo](./demo.gif)

# Contorium

**The Runtime Continuity Layer for AI Coding**

AI coding tools have context windows.

Projects need continuity.

Contorium provides a persistent runtime and project memory layer that keeps AI aligned with your codebase across sessions, tools, and models.

Works with:
* Claude Code
* Codex
* Cursor
* Gemini CLI
* VS Code
* Any MCP-compatible AI tool

🌐 https://www.contorium.dev/

---

# Why Contorium

Modern AI coding tools are powerful.

But they all share the same limitation:

> Every new conversation starts with less understanding than your project actually contains.

Developers constantly re-explain:

* architecture
* intent
* priorities
* module relationships
* active work

Switching tools often means losing continuity.

Contorium solves this problem by maintaining a continuously updated understanding of your project and exposing it through IDEs, MCP servers, dashboards, and AI handoffs.

---

# What Contorium Does

Contorium creates a shared runtime understanding layer between:

* IDEs
* MCP agents
* AI coding tools
* CLI workflows

Instead of:

```text
AI → forgets project
   → re-learns context
   → repeats work
```

You get:

```text
AI → understands project
   → continues work
   → stays aligned
```

---

# What You Get

## Persistent Project Memory

Project understanding survives:

* sessions
* AI chats
* model switches
* tool changes
* long development cycles

---

## Runtime Dashboard

Live project awareness while you code.

Passive Mode:

```text
[●] task: fix MCP bootstrap | last: calculateRisk() | agent: mcp
```

Expanded Mode:

* Impact Graph
* Function Call Chains
* Runtime Handoff
* Project Status
* Copy To AI

Available in:

* CLI
* VS Code
* Cursor

---

## AI Handoff

Open a new AI conversation.

Contorium detects active runtime context and asks:

```text
[?] Runtime active.
Inject current project state? (Y/n)
```

Choose:

```text
Enter → Continue current work
N      → Start fresh
```

You stay in control.

No automatic prompt injection.

No hidden behavior.

---

## Cross-Tool Continuity

Move freely between:

* Claude Code
* Codex
* Cursor
* Gemini CLI
* VS Code

Without losing project understanding.

---

## Knowledge Graph

Contorium continuously maps:

```text
Intent
  ↓
Module
  ↓
File
  ↓
Function
```

Creating a structured understanding layer rather than isolated files.

---

## Hotspot Detection

Highlights what matters right now:

* frequently edited files
* active modules
* critical functions
* high-impact code paths

---

## Runtime Snapshot

AI-ready project state including:

* current goal
* active task
* recent changes
* important functions
* project intent

Used for:

* AI handoff
* model switching
* new chat continuity

---

# Works With

| Tool        | Support |
| ----------- | ------- |
| Claude Code | ✅       |
| Codex       | ✅       |
| Cursor      | ✅       |
| Gemini CLI  | ✅       |
| VS Code     | ✅       |
| MCP Hosts   | ✅       |

---

# How It Works

```text
Workspace Activity
        ↓
Runtime Understanding Layer
        ↓
Knowledge Graph
        ↓
Hotspot Detection
        ↓
Runtime Snapshot
        ↓
AI Handoff
        ↓
Any AI Tool
```

Local-first.

Everything is stored under:

```text
.contora/
```

---

# Runtime Dashboard

## Passive Mode

Low-interruption status line.

```text
[●] task: fix MCP bootstrap
    last: calculateRisk()
    agent: mcp
```

Optional mini graph:

```text
⤷ calculateRisk()
    → tradeSignal()
    → decisionEngine()
```

---

## Expanded Mode

Full runtime view:

* Impact Graph
* Function Call Tree
* Runtime Timeline
* AI Handoff
* Copy To AI

Open anytime using:

```text
Space
```

inside the Contorium dashboard.

---

# New Chat Handoff

When a runtime is active and a new AI conversation starts:

```text
[?] Runtime active.
Inject current project state? (Y/n)
```

Options:

```text
Enter / Y
```

Inject runtime context.

```text
N / Esc
```

Start with a clean conversation.

This gives developers control while preserving continuity.

---

# Architecture Overview

```text
Workspace Events
        ↓
Parser
        ↓
Function Graph
        ↓
Knowledge Graph
        ↓
Intent Mapping
        ↓
Hotspot Analysis
        ↓
Runtime Snapshot
        ↓
AI Handoff
```

---

# Quick Start

## Install MCP

```bash
npm install -g @contorium/mcp
```

---

## Configure MCP Host

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

---

## Open Claude / Codex / Cursor

Contorium starts automatically.

No manual runtime commands required.

---

# Install Options

## MCP

Recommended for:

* Claude Code
* Codex
* Cursor Agent
* Gemini CLI

See:

```text
docs/MCP.md
```

---

## IDE Extension

Supported:

* VS Code
* Cursor

Install:

```bash
npm run vsix
```

Then:

```text
Extensions
→ Install From VSIX
→ Reload Window
```

See:

```text
docs/IDE_EXTENSION.md
```

---

## CLI

Initialize:

```bash
npx contorium init .
```

Sync:

```bash
npx contorium sync .
```

Generate handoff:

```bash
npx contorium handoff
```

Copy runtime to AI:

```bash
npx contorium handoff --copy-to-ai
```

See:

```text
docs/CLI.md
```

---

# Latest Runtime Features

| Feature                     | Status |
| --------------------------- | ------ |
| Runtime Dashboard           | ✅      |
| Passive Status Line         | ✅      |
| Expanded Impact Graph       | ✅      |
| AI Handoff                  | ✅      |
| Semi-auto Runtime Injection | ✅      |
| MCP Integration             | ✅      |
| Cross-tool Continuity       | ✅      |
| Knowledge Graph             | ✅      |

---

# Documentation

| Resource      | Link                    |
| ------------- | ----------------------- |
| Installation  | docs/INSTALL.md         |
| MCP Setup     | docs/MCP.md             |
| CLI Guide     | docs/CLI.md             |
| Dashboard     | docs/DASHBOARD.md       |
| IDE Extension | docs/IDE_EXTENSION.md   |
| Architecture  | docs/ARCHITECTURE_V3.md |
| Docs Index    | docs/README.md          |

---

# What Contorium Is Not

Contorium is not:

* an autonomous coding agent
* a task generator
* an AI replacement
* a planning system

Contorium does not decide what to build.

Developers stay in control.

> Contorium preserves understanding, not decisions.

---

# Vision

AI tools have context windows.

Projects need continuity.

Contorium provides the missing runtime layer between your project and your AI tools.

Because conversations end.

Project understanding should not.

---

# Links

Website:

https://www.contorium.dev/

GitHub:

https://github.com/ContoriumLabs/contorium

---

# License

See LICENSE.
