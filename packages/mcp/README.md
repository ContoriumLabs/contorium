# @contorium/mcp

## MCP Runtime Adapter for Contorium Project Intelligence

A Model Context Protocol (MCP) runtime that connects AI coding agents to Contorium’s **Project Intelligence Layer (PIL)**.

It enables AI tools like:

- Claude Code
- OpenAI Codex
- Cursor
- Gemini CLI
- VS Code MCP
- Any MCP-compatible runtime

to access structured project intelligence.

---

## Core Purpose

Contorium MCP is not an agent.

It is a **bridge between AI tools and project intelligence**.

It provides:

- Inspect → read project intelligence
- Capture → write structured memory
- Transfer → move intelligence across sessions

---

## Architecture Overview

```text
AI Host (Claude / Codex / Cursor)
        ↓
   MCP Runtime (@contorium/mcp)
        ↓
   @contora/state-core (CIL + PIL Engine)
        ↓
   .contora/ (Local Project Intelligence Store)
```

---

## Design Principle

> MCP does NOT execute tasks  
> MCP does NOT make decisions

It only:

- exposes project intelligence
- synchronizes state
- enables continuity

---

## Project Intelligence Model (PIL v3)

Contorium MCP operates on a structured intelligence model:

### Core Layer

- STATE → current project state
- INTENT → project goals
- DECISION → architecture decisions
- WHY → reasoning behind decisions

### Extended Layer

- TIMELINE → evolution over time
- IMPACT → dependency relationships
- CONFIDENCE → reliability scoring
- PROVENANCE → origin tracking
- EVOLUTION → structural changes

---

## Core Capabilities

### 1. Inspect (Read-only Intelligence)

Used by AI agents to understand project context.

```text
inspect_state
inspect_intent
inspect_decision
inspect_why
inspect_timeline
inspect_impact
inspect_health
inspect_graph
inspect_provenance
```

### 2. Capture (Write Intelligence)

Used to persist structured project memory.

```text
capture_focus
capture_note
capture_decision
```

### 3. Transfer (AI Continuity Export)

Used to move project intelligence across sessions.

| Tool | Purpose | Size |
| --- | --- | --- |
| transfer_context | lightweight continuation | ~300–800 tokens |
| transfer_handoff | runtime continuation | ~100–300 tokens |
| transfer_intelligence | full project export | ~8000 tokens |

---

## Typical AI Agent Flow

```text
1. inspect_state
2. inspect_intent
3. inspect_decision
4. perform work (external AI tool)
5. capture_note / capture_decision
6. transfer_context (session handoff)
```

---

## MCP Runtime Contract

### Read Layer

```text
inspect_*
```

Provides deterministic access to:

- state
- intent
- decisions
- timeline
- graph
- health

### Write Layer

```text
capture_*
```

Persists:

- focus updates
- notes
- decision logs

### Transfer Layer

```text
transfer_*
```

Exports structured intelligence for AI continuity.

---

## CIL Integration (Recommended)

MCP does NOT handle natural language directly.

All reasoning flows through CIL:

```text
ask_project
get_next_actions
get_project_history
get_decision_graph
get_cognitive_health
get_project_essence
get_snapshot
get_entity_knowledge
```

> MCP = access layer  
> CIL = cognition layer

---

## AI Layer (Optional)

Contorium supports optional LLM enhancement for:

- Why explanation
- Story generation
- Essence compression
- Project DNA summarization

### Important

- LLM is NOT required
- All core intelligence remains deterministic
- LLM is only for interpretation

---

## Configuration

### Workspace

```text
CONTORIUM_WORKSPACE=/your/project/root
```

### LLM Config (Optional)

Stored in:

```text
.contora/config/llm.json
```

Used for:

- explanation generation
- narrative synthesis

No secrets stored in repo (API keys are gitignored).

---

## Installation

### npm (recommended)

```bash
npm install -g @contorium/mcp
```

### From source

```bash
git clone https://github.com/ContoriumLabs/contorium.git
cd contorium
npm install
npm run compile
```

---

## MCP Host Setup

### Claude Code

```bash
claude mcp add --scope project contorium -- npx @contorium/mcp
```

### OpenAI Codex

```bash
codex mcp add contorium -- npx @contorium/mcp
```

### Cursor / VS Code / Gemini CLI

Supports standard MCP registration:

```json
{
  "mcpServers": {
    "contorium": {
      "command": "npx",
      "args": ["@contorium/mcp"]
    }
  }
}
```

---

## Local-First Design

All intelligence stays local:

```text
.contora/
├── state.json
├── handoff.json
├── intent/
├── timeline/
├── graph/
├── events/
├── intelligence/
├── governance/
├── config/
│   ├── llm.json
│   └── .llm-keys.json (gitignored)
├── cache/llm/
```

No cloud dependency.

No vendor lock-in.

---

## CLI Equivalents

| MCP Tool | CLI Command |
| --- | --- |
| inspect_* | contorium inspect |
| capture_* | contorium capture |
| transfer_* | contorium transfer |

---

## Legacy Compatibility

Deprecated but supported:

- get_project_*
- get_cognitive_snapshot
- transfer_runtime
- get_full_intelligence

---

## Supported MCP Hosts

- Claude Code
- OpenAI Codex
- Cursor
- Gemini CLI
- VS Code MCP
- Any MCP-compatible runtime

---

## Key Insight

> MCP is not intelligence.  
> It is the transport layer of intelligence.

---

## Links

- Project: [https://github.com/ContoriumLabs/contorium](https://github.com/ContoriumLabs/contorium)
- Overview: [https://github.com/ContoriumLabs/contorium/blob/main/docs/OVERVIEW.md](https://github.com/ContoriumLabs/contorium/blob/main/docs/OVERVIEW.md)
- PIL Guide: [https://github.com/ContoriumLabs/contorium/blob/main/docs/PIL_RUNTIME.md](https://github.com/ContoriumLabs/contorium/blob/main/docs/PIL_RUNTIME.md)
- AI Layer: [https://github.com/ContoriumLabs/contorium/blob/main/docs/AI_LAYER.md](https://github.com/ContoriumLabs/contorium/blob/main/docs/AI_LAYER.md)
- MCP Docs: [https://github.com/ContoriumLabs/contorium/blob/main/docs/MCP.md](https://github.com/ContoriumLabs/contorium/blob/main/docs/MCP.md)
- Install Guide: [https://github.com/ContoriumLabs/contorium/blob/main/docs/INSTALL.md](https://github.com/ContoriumLabs/contorium/blob/main/docs/INSTALL.md)

---

## License

MIT
