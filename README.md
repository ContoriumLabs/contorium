![Contorium demo](./demo.gif)

# Contorium

**Persistent project memory for AI development** — [contorium.dev](https://www.contorium.dev/)

AI models don't remember projects. **Contorium does.**

Contorium keeps your project state consistent across Cursor, Claude Code, Gemini CLI, Codex, VS Code, or any MCP-compatible AI tool.

Not chat history. Not prompts. **Project understanding.**

---

## Why this matters (core value)

Modern AI coding tools are powerful — but they all share one critical flaw:

> They forget what your project actually is.

After a few conversations:

- context resets
- architecture gets re-explained
- intent is lost
- switching tools breaks understanding

You end up doing the same thing again and again:

> "explaining the project to AI instead of building it"

---

## Core idea (what Contorium actually is)

Contorium is a **persistent project memory layer for AI development**.

It maintains a continuously updated understanding of your project:

- what you are building (**Intent**)
- what matters right now (**Hotspots**)
- how code is structured (**Knowledge Graph**)
- how everything connects (**Functions & Dependencies**)

So AI does not restart from zero every time.

---

## Key benefit (simple version)

Instead of:

> AI = forgets project → re-learns → repeats

You get:

> AI = already understands project → continues work

---

## What you actually get

### 1. Persistent Project Memory

AI keeps understanding your project across:

- sessions
- tools
- model switches
- long development cycles

### 2. Cross-tool continuity (IDE / MCP / CLI)

Switch freely between:

- Cursor
- Claude Code
- Gemini CLI
- Codex
- VS Code

Without losing project context.

### 3. Project Knowledge Graph

```text
Intent → Module → File → Function
```

Turns your project into a structured map instead of scattered files.

### 4. Hotspot awareness

Highlights what matters right now:

- frequently edited files
- key logic areas
- high-impact code paths

### 5. AI-ready snapshot

A compact project state used for handoff between AI tools:

- current intent
- important modules
- key functions
- active focus

---

## The real problem Contorium solves

Developers today don't struggle with coding.

They struggle with:

- re-explaining projects to AI
- losing context between tools
- inconsistent understanding across sessions
- restarting project awareness repeatedly

Contorium removes that friction.

---

## How it works

```text
Workspace Activity
        ↓
Project Understanding Layer
        ↓
Knowledge Graph + Intent Tracking
        ↓
Hotspot Detection
        ↓
AI-ready Snapshot
        ↓
Any AI Tool
```

The AI no longer works from chat history — it works from **project reality**.

---

## What Contorium is NOT

Contorium is NOT:

- an autonomous coding agent
- a task generator
- a system that decides what you should build

It does NOT replace developers.

It keeps developers in control.

> Contorium preserves understanding — not decisions.

---

## Why developers use it

Because without it:

- AI forgets what you are building
- every tool behaves differently
- long projects lose consistency

With it:

- AI stays aligned with the project
- context survives time and tool changes
- development becomes continuous instead of restart-based

---

## Architecture overview

```text
Workspace Events → Parser → Function Graph → Knowledge Graph
        → Intent Mapping → Hotspot Analysis → Snapshot → AI Handoff
```

Local-first storage under `.contora/`.

---

## Key principles

| Principle       | Meaning                          |
| --------------- | -------------------------------- |
| Project-centric | Repo is the source of truth      |
| Persistent      | Understanding survives time      |
| Structured      | Relationships > files            |
| Human-led       | Developer decides, AI understands |

---

## Vision

AI tools today have context windows.

Future AI tools need memory.

Contorium is the missing layer:

> A persistent memory system for AI software development.

Because AI conversations end.  
**Project understanding should not.**

---

## 🚀 Quick Start — install · use · uninstall

```bash
git clone https://github.com/ContoriumLabs/contorium.git
cd contorium
npm install
npm run compile
```

### IDE extension (VS Code / Cursor)

|               | Command / action                                                |
| ------------- | --------------------------------------------------------------- |
| **Install**   | `npm run vsix` → Extensions → Install from VSIX → Reload Window |
| **Use**       | Open folder → set Current focus → Copy AI-ready context         |
| **Uninstall** | Extensions → Contorium → Uninstall                              |

→ Full guide: [docs/IDE_EXTENSION.md](./docs/IDE_EXTENSION.md)

### MCP server (Claude Code / Cursor Agent / Codex / Gemini)

|               | Command / action                                                             |
| ------------- | ---------------------------------------------------------------------------- |
| **Install**   | Add MCP config after build                                                   |
|               | `node /path/to/contorium/bin/contorium-mcp-launch.cjs`                       |
|               | Set `CONTORIUM_WORKSPACE=/path/to/project`                                   |
| **Use**       | `get_project_handoff`, `get_project_graph_snapshot`, `get_workspace_context` |
| **Uninstall** | Remove MCP config                                                            |

```bash
# Codex
codex mcp add contorium -- node ./bin/contorium-mcp-launch.cjs

# Claude Code
claude --plugin-dir .
```

→ Full guide: [docs/MCP.md](./docs/MCP.md)

### CLI

|               | Command / action          |
| ------------- | ------------------------- |
| **Install**   | `npm link` (optional)     |
| **Use**       | `npx contorium init .`    |
|               | `npx contorium sync .`    |
|               | `npx contorium export .`  |
| **Uninstall** | `npm unlink -g contorium` |

```bash
npx contorium init .
npx contorium sync .
npx contorium handoff .
npx contorium graph-snapshot .
npx contorium export .
npx contorium status .
```

→ Full guide: [docs/CLI.md](./docs/CLI.md)

### Clear workspace data

```bash
rm -rf .contora
```

```powershell
Remove-Item -Recurse -Force .contora
```

### Links

| Resource      | Link                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------- |
| Install guide | [docs/INSTALL.md](./docs/INSTALL.md)                                                     |
| Docs index    | [docs/README.md](./docs/README.md)                                                       |
| Architecture  | [docs/ARCHITECTURE_V3.md](./docs/ARCHITECTURE_V3.md)                                     |
| Website       | [https://www.contorium.dev/](https://www.contorium.dev/)                                 |
| GitHub        | [https://github.com/ContoriumLabs/contorium](https://github.com/ContoriumLabs/contorium) |

---

## License

See [LICENSE](./LICENSE)
