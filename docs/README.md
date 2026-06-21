# Contorium Documentation

**Contorium** is an **AI Project Intelligence Layer (PIL)**. It captures, structures, preserves, retrieves, and transfers project intelligence across IDEs, MCP agents, CLI tools, and AI sessions.

> **Contorium records and preserves project intelligence. It does not decide for the project.**

---

## Start here

| Document | Audience | Content |
|----------|----------|---------|
| [PIL_RUNTIME.md](./PIL_RUNTIME.md) | Everyone | **Primary operations guide** — workflows, capability matrix, three runtimes |
| [INSTALL.md](./INSTALL.md) | New users | Install IDE, MCP, and CLI; usage scenarios |
| [PROJECT_INTELLIGENCE_LAYER.md](./PROJECT_INTELLIGENCE_LAYER.md) | Architects | PIL architecture specification (v1.1.3) |

---

## Runtime adapters (how to use each port)

| Document | Runtime | Primary loop |
|----------|---------|--------------|
| [IDE_EXTENSION.md](./IDE_EXTENSION.md) | VS Code / Cursor extension | Capture → Visualize → Transfer |
| [MCP.md](./MCP.md) | `@contorium/mcp` stdio server | Retrieve → Inspect → Transfer |
| [CLI.md](./CLI.md) | `contorium` terminal CLI | Inspect → Audit → Transfer |
| [DASHBOARD.md](./DASHBOARD.md) | Cognitive State terminal UI | Shared view across IDE / MCP / CLI |
| [../packages/mcp/README.md](../packages/mcp/README.md) | MCP package quick start | npm install, host config, PIL tool contract |

---

## Intelligence model

| Document | Topic |
|----------|-------|
| [CONTORIUM_LANGUAGE_SPEC.md](./CONTORIUM_LANGUAGE_SPEC.md) | Public API vocabulary — **inspect / transfer / capture** |
| [COGNITIVE_DIMENSIONS.md](./COGNITIVE_DIMENSIONS.md) | STATE · INTENT · DECISION · WHY + TIMELINE · IMPACT · CONFIDENCE · PROVENANCE · EVOLUTION |

---

## Architecture (deep dives)

| Document | Scope |
|----------|-------|
| [ARCHITECTURE_V3.md](./ARCHITECTURE_V3.md) | V3.1 project understanding pipeline (graphs, handoff, knowledge) |
| [ARCHITECTURE_V3_CORE.md](./ARCHITECTURE_V3_CORE.md) | V3 Core — governance, cognitive MVP, guard layer |
| [ARCHITECTURE_V2_2.md](./ARCHITECTURE_V2_2.md) | v2.2 dual-mode state engine (historical foundation) |
| [STATE_ENGINE.md](./STATE_ENGINE.md) | State engine v1 + v2 Safe (conflicts, source tags) |
| [ENGINEERING_CLOSURE.md](./ENGINEERING_CLOSURE.md) | Frozen engineering boundaries (V3.1 closure) |
| [RUNTIME.md](./RUNTIME.md) | `@contora/runtime` package (IDE-embedded helpers) |
| [UPGRADE_PLAN_2.x.md](./UPGRADE_PLAN_2.x.md) | Historical upgrade plan (2.0 → 2.1) |

---

## PIL capability groups (v3.0 — aligned across surfaces)

```text
Capture → Structure → Preserve → Retrieve → Transfer
```

| Group | MCP | CLI | IDE |
|-------|-----|-----|-----|
| **Inspect** | `inspect_state`, `inspect_health`, … | `contorium inspect …` | Sidebar panels |
| **Transfer** | `transfer_context`, `transfer_intelligence`, `transfer_handoff` | `contorium transfer …` | **Transfer Context** / **Transfer Intelligence** |
| **Capture** | `capture_focus`, `capture_note`, `capture_decision` | `contorium capture …` | Current focus · Capture note · Capture decision |

Legacy tool names (`get_project_*`, etc.) remain for backward compatibility — see [MCP.md](./MCP.md) extended reference.

---

## Three peer runtimes

```text
IDE ──┐
MCP ──┼──► @contora/state-core (PIL Core) ──► .contora/
CLI ──┘
```

All runtimes share one local repository (`.contora/`). No cloud dependency.

---

## External links

- [README](../README.md) — project overview
- Website: https://www.contorium.dev/
- GitHub: https://github.com/ContoriumLabs/contorium
