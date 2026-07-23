# Contorium Documentation

User-facing guides for Contorium — the **Project Intelligence Layer (PIL)** with a **Cognitive Interaction Layer (CIL)** on top.

> Contorium records and preserves project intelligence. It does not decide for the project.

---

## Start here

| Document | Content |
|----------|---------|
| [OVERVIEW.md](./OVERVIEW.md) | Product overview — features, architecture, three runtimes |
| [INSTALL.md](./INSTALL.md) | Install IDE, MCP, and CLI; usage and uninstall |
| [SURFACES.md](./SURFACES.md) | IDE / CLI / MCP roles and Transfer boundaries |
| [PIL_RUNTIME.md](./PIL_RUNTIME.md) | PIL operations — Capture · Inspect · Transfer |

---

## How to use each surface

| Document | Surface |
|----------|---------|
| [IDE_EXTENSION.md](./IDE_EXTENSION.md) | VS Code / Cursor extension |
| [MCP.md](./MCP.md) | `@contorium/mcp` stdio server |
| [CLI.md](./CLI.md) | `contorium` terminal CLI |
| [DASHBOARD.md](./DASHBOARD.md) | Cognitive State terminal UI |
| [packages/mcp/README.md](../packages/mcp/README.md) | MCP package quick start (npm) |

---

## Intelligence & cognition

| Document | Topic |
|----------|-------|
| [CIL.md](./CIL.md) | Cognitive Interaction Layer — ask, health, DNA |
| [LIFECYCLE.md](./LIFECYCLE.md) | Knowledge Lifecycle — decision trust & review queue |
| [AI_LAYER.md](./AI_LAYER.md) | Optional LLM explanation layer (default off) |
| [MCP_TOOL_CALLABILITY.md](./MCP_TOOL_CALLABILITY.md) | MCP tool smoke-test results & preferred / slow tools |

---

## Capability groups (aligned across surfaces)

```text
Capture → Structure → Preserve → Retrieve → Transfer
```

| Group | MCP (preferred) | CLI | IDE |
|-------|-----------------|-----|-----|
| **Inspect** | `inspect_*` · `ask_project` | `contorium inspect …` · `ask` | Sidebar panels |
| **Transfer** | `transfer_project` | `contorium transfer …` | Transfer Context / Intelligence |
| **Capture** | `capture_focus` · `capture_note` · `capture_decision` | `contorium capture …` | Focus · note · decision |
| **Lifecycle** | `get_knowledge_health` · `get_review_queue` | `lifecycle` · `review` | Explore · Review Queue |

Legacy aliases (`get_project_*`, split `transfer_*`) remain for compatibility — see [MCP.md](./MCP.md).

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
