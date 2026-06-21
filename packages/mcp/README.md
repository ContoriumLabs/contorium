# @contorium/mcp

**Contorium — AI Project Intelligence Layer (MCP Runtime Adapter)**

A **runtime adapter** that exposes Contorium PIL (Project Intelligence Layer) to MCP-compatible AI tools.

It enables AI agents (Claude Code, Codex, Cursor, Gemini CLI, VS Code MCP, etc.) to:

- Inspect project intelligence
- Capture structured project memory
- Transfer context across sessions

> Contorium does not execute tasks or make decisions.  
> It preserves and transfers project intelligence.

---

## What this package is

`@contorium/mcp` is the **MCP runtime bridge** between AI agents and the Contorium PIL engine.

```text
AI Host (Claude / Codex / Cursor)
        ↓
   MCP Runtime (@contorium/mcp)
        ↓
   @contora/state-core (PIL Engine)
        ↓
   .contora/ (Local Intelligence Store)
```

It provides **read / capture / transfer access** to project intelligence.

---

## PIL Architecture (v3.0)

All Contorium runtimes share one intelligence model:

```text
Capture → Structure → Preserve → Retrieve → Transfer
```

### Core Intelligence Model

- STATE — what exists now
- INTENT — what the project is trying to achieve
- DECISION — what choices were made
- WHY — reasoning behind decisions

### Extended Dimensions

- TIMELINE — evolution over time
- IMPACT — affected scope
- CONFIDENCE — reliability score
- EVOLUTION — structural changes
- PROVENANCE — origin of intelligence

---

## Three Peer Runtimes

| Runtime | Responsibility |
|--------|----------------|
| IDE | Capture + Visualization |
| MCP (this package) | Inspect + Transfer |
| CLI | Inspect + Audit |

All runtimes share:

```text
@contora/state-core
```

and operate on:

```text
.contora/
```

---

## Install

### npm (recommended)

```bash
npm install -g @contorium/mcp
```

### from source

```bash
git clone https://github.com/ContoriumLabs/contorium.git
cd contorium
npm install
npm run compile
```

---

## MCP Host Setup

### Codex

```bash
codex mcp add contorium -- npx @contorium/mcp
```

### Claude Code

```bash
claude mcp add --scope project contorium -- npx @contorium/mcp
```

### Environment

Optional:

```bash
CONTORIUM_WORKSPACE=/your/project/root
```

---

## MCP Runtime Contract

### Inspect (read-only intelligence)

```text
inspect_state
inspect_intent
inspect_decision
inspect_why

inspect_timeline
inspect_impact
inspect_confidence

inspect_evolution
inspect_provenance
inspect_health
inspect_graph
```

---

### Transfer (AI continuity export)

| Tool | Mode | Size |
|------|------|------|
| transfer_context | Default AI continuation | ~300–800 tokens |
| transfer_intelligence | Full intelligence export | ~8000 tokens |
| transfer_handoff | Runtime handoff (compact) | ~100–300 tokens |

---

### Capture (write intelligence)

```text
capture_focus     → set current task
capture_note      → append timestamped memory
capture_decision  → persist decision log
```

---

## Typical AI Agent Flow

```text
1. MCP bootstraps workspace
2. inspect_state → understand project
3. inspect_intent → understand goal
4. agent performs work
5. capture_note / capture_decision
6. transfer_context → move to next chat
```

Optional:

```text
transfer_handoff → fast runtime continuation
```

---

## Local-first storage

All intelligence is stored locally:

```text
.contora/
├── state.json
├── handoff.json
├── intent/
├── timeline/
├── graph/
├── intelligence/
├── governance/
└── events/
```

No cloud.
No external API dependency.
No vendor lock-in.

---

## CLI equivalents

| MCP Tool | CLI Command |
|----------|------------|
| inspect_* | contorium inspect <target> |
| capture_* | contorium capture focus\|note\|decision |
| transfer_context | contorium transfer context |
| transfer_intelligence | contorium transfer intelligence |
| transfer_handoff | contorium transfer handoff |

---

## Legacy Compatibility

For backward compatibility:

- `get_project_*`
- `get_cognitive_snapshot`
- `get_full_intelligence`
- `transfer_runtime`

All deprecated but supported.

---

## Supported MCP Hosts

- Claude Code
- OpenAI Codex
- Cursor
- Gemini CLI
- VS Code MCP
- Any MCP-compatible runtime

---

## Links

- PIL Runtime Guide: https://github.com/ContoriumLabs/contorium/blob/main/docs/PIL_RUNTIME.md
- MCP Docs: https://github.com/ContoriumLabs/contorium/blob/main/docs/MCP.md
- Install Guide: https://github.com/ContoriumLabs/contorium/blob/main/docs/INSTALL.md
- GitHub: https://github.com/ContoriumLabs/contorium

---

## License

See LICENSE