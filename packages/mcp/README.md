# @contorium/mcp

**MCP Runtime Adapter for Contorium Project Intelligence**

> Git remembers what changed.  
> Contorium remembers why.

A Model Context Protocol (MCP) runtime that connects AI coding agents to Contorium’s **Project Intelligence Layer (PIL)**.

It enables AI tools like:

- Claude Code
- OpenAI Codex
- Cursor
- Gemini CLI
- VS Code MCP
- Any MCP-compatible runtime

to access structured project intelligence — not only the code, but also:

- Why architectural decisions were made
- What assumptions they depend on
- How the project evolved
- Which decisions are still valid

---

## Core Purpose

Contorium MCP is not an agent.

It is a **bridge between AI tools and project intelligence**.

It provides:

- **Inspect** → read project intelligence
- **Capture** → write structured memory
- **Transfer** → move intelligence across sessions

---

## Design Principle

> MCP does NOT execute tasks  
> MCP does NOT make decisions

It only:

- exposes project intelligence
- synchronizes state
- enables continuity

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

Shared with IDE and CLI:

```text
@contora/state-core

.contora/
```

---

## Project Intelligence Model (PIL)

Contorium MCP operates on a structured intelligence model.

### Core Layer

| Intelligence | Description               |
| ------------ | ------------------------- |
| STATE        | Current project state     |
| INTENT       | Project goals             |
| DECISION     | Architecture decisions    |
| WHY          | Reasoning behind decisions |

### Extended Layer

| Intelligence | Description            |
| ------------ | ---------------------- |
| TIMELINE     | Evolution over time    |
| IMPACT       | Dependency relationships |
| CONFIDENCE   | Reliability scoring    |
| PROVENANCE   | Origin tracking        |
| EVOLUTION    | Structural changes     |

PIL does not reason.

It preserves structured project intelligence.

---

## Core Capabilities

Contorium MCP is built around three capabilities.

### 1. Capture

Persist structured project memory.

```text
capture_focus
capture_note
capture_decision
```

Records:

- decisions
- events
- project state
- reasoning
- assumptions

### 2. Understand (Inspect + CIL)

Read-only intelligence for AI agents:

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

Natural-language and exploration tools (via CIL):

```text
ask_project
get_next_actions
get_project_history
get_decision_graph
get_cognitive_health
get_knowledge_health
get_review_queue
set_decision_lifecycle_meta
get_project_essence
get_snapshot
get_entity_knowledge
```

> MCP = access layer  
> CIL = cognition layer

CIL answers:

- What happened?
- Why was this done?
- What is this project?
- What should be reviewed?
- Is this decision still valid?

CIL does not execute tasks.

It explains and explores.

### 3. Validate (Knowledge Lifecycle)

Understand whether old decisions still make sense.

Contorium tracks:

```text
Change
  ↓
Assumption
  ↓
Impact
  ↓
Decision Validity
```

Decision lifecycle:

```text
VALID
  ↓
WARNING
  ↓
DECAYING
  ↓
SUSPECTED_INVALID
  ↓
NEEDS_REVALIDATION
  ↓
INVALIDATED
```

Same lifecycle engine as CLI and IDE — not a separate store.

| Tool | Purpose |
| ---- | ------- |
| `get_knowledge_health` | Project knowledge health + per-decision trust |
| `get_review_queue` | Stale, expired, conflict, and **invalidation triggers** |
| `set_decision_lifecycle_meta` | Set owner, verification, expiry (tracks owner changes) |
| `ask_project` | Decision questions include **validity**, **why**, and **suggested action** |

CLI equivalents: `contorium lifecycle` · `contorium review` · `contorium lifecycle owner|verify`

---

## Transfer

Move project intelligence across AI sessions.

| Tool | Purpose | Size |
| ---- | ------- | ---- |
| `transfer_project` | **preferred** unified export (`mode`) | depends on mode |
| `transfer_context` | legacy alias → context | ~300–800 tokens |
| `transfer_handoff` | legacy alias → handoff | ~100–300 tokens |
| `transfer_intelligence` | legacy alias → intelligence | ~8000 tokens |

---

## Typical AI Agent Flow

```text
1. get_handoff_injection_status  (new chat)
2. ask_project / inspect_state · inspect_intent · inspect_decision
3. perform work (external AI tool — not Contorium)
4. capture_note / capture_decision
5. transfer_project(mode=context)  (session handoff)
```

---

## LLM tool selection (preferred)

Hosts expose many tools (including legacy aliases). Agents should prefer this small set:

| Intent | Call |
| ------ | ---- |
| Natural-language question | `ask_project` |
| New-chat continuity | `get_handoff_injection_status` → confirm/skip |
| Export into chat | `transfer_project` (`context` \| `intelligence` \| `story` \| `essence` \| `handoff`) |
| Structured read | `inspect_state` · `inspect_intent` · `inspect_decision` · `inspect_why` · `inspect_health` |
| Write memory | `capture_focus` · `capture_note` · `capture_decision` |
| Decision validity | `get_knowledge_health` · `get_review_queue` · `set_decision_lifecycle_meta` |
| Recent / ranged history | `get_recent_events` (`limit`) · `get_project_history` (`range`) |

Avoid unless the caller already depends on them: `get_project_*`, `transfer_context` / `transfer_intelligence` / `transfer_handoff`, `run_governance_cycle`, `ensure_control_ready`, legacy `get_intent_graph` (use `inspect_intent`).

**Slow tools (~2–3 min):** `derive_decision_provenance` and its aliases. Prefer `ask_project` / `get_decision_context` for ordinary questions; call at most one provenance cycle per turn. Full callability results: [`docs/MCP_TOOL_CALLABILITY.md`](../../docs/MCP_TOOL_CALLABILITY.md).

```bash
npm run test:mcp-tools:prefer   # preferred ~20
npm run test:mcp-tools          # all tools
```

Server `instructions` (MCP handshake) repeat this routing for hosts that surface them to the model.

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

## Optional AI Layer

Contorium works without LLMs.

Optional AI improves:

- explanation
- project story
- project essence
- DNA summary
- suggested questions

### Important

- LLM is NOT required
- All core intelligence remains deterministic
- LLM is only for interpretation

AI is an interpreter.

Not the source of truth.

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

Your project intelligence stays with your project.

```text
.contora/
├── state.json
├── handoff.json
├── intent/
├── timeline/
├── graph/
├── events/
├── lifecycle/
├── intelligence/
├── governance/
├── config/
│   ├── llm.json
│   └── .llm-keys.json (gitignored)
└── cache/llm/
```

No cloud dependency.

No vendor lock-in.

---

## CLI Equivalents

| MCP Tool | CLI Command |
| -------- | ----------- |
| `inspect_*` | `contorium inspect` |
| `capture_*` | `contorium capture` |
| `transfer_*` | `contorium transfer` |
| `ask_project` | `contorium ask` |
| `get_knowledge_health` / `get_review_queue` | `contorium lifecycle` / `contorium review` |

---

## Legacy Compatibility

Deprecated but supported:

- `get_project_*`
- `get_cognitive_snapshot`
- `transfer_runtime`
- `get_full_intelligence`

---

## Supported MCP Hosts

- Claude Code
- OpenAI Codex
- Cursor
- Gemini CLI
- VS Code MCP
- Any MCP-compatible runtime

---

## What Contorium MCP Is NOT

Contorium MCP is not:

- ❌ Autonomous coding agent
- ❌ Task execution system
- ❌ Project management tool
- ❌ AI replacement developer

> MCP is not intelligence.  
> It is the transport layer of intelligence.

Contorium does not decide for you.

It preserves and explains the intelligence behind your decisions.

---

## Links

- **Website:** [https://www.contorium.dev](https://www.contorium.dev)
- **Project:** [https://github.com/ContoriumLabs/contorium](https://github.com/ContoriumLabs/contorium)
- **Overview:** [docs/OVERVIEW.md](https://github.com/ContoriumLabs/contorium/blob/main/docs/OVERVIEW.md)
- **PIL Guide:** [docs/PIL_RUNTIME.md](https://github.com/ContoriumLabs/contorium/blob/main/docs/PIL_RUNTIME.md)
- **AI Layer:** [docs/AI_LAYER.md](https://github.com/ContoriumLabs/contorium/blob/main/docs/AI_LAYER.md)
- **MCP Docs:** [docs/MCP.md](https://github.com/ContoriumLabs/contorium/blob/main/docs/MCP.md)
- **Knowledge Lifecycle:** [docs/LIFECYCLE_V1.md](https://github.com/ContoriumLabs/contorium/blob/main/docs/LIFECYCLE_V1.md)
- **Install Guide:** [docs/INSTALL.md](https://github.com/ContoriumLabs/contorium/blob/main/docs/INSTALL.md)

---

## License

MIT
