# Contorium

**Project Intelligence Runtime for AI Coding Tools**

Contorium is a local-first system that preserves and reconstructs software project intelligence across AI coding environments.

It works with:

- Cursor
- Claude Code
- Codex
- Gemini CLI
- VS Code
- Any MCP-compatible runtime

Instead of repeatedly re-explaining architecture, decisions, and project state in every session, Contorium maintains a shared **Project Intelligence Layer** that all tools can access.

---

## Core Idea

> Git stores code history  
> Contorium stores project intelligence history

It captures not just *what changed*, but:

- Why it changed
- What decisions were made
- What the project is trying to become
- How it evolved over time

---

## CIL — Cognitive Interaction Layer (v3)

CIL is the **user-facing intelligence system**.

It does not execute tasks.

It answers questions.

```text
User Query
   ↓
Query Router
   ↓
Cognitive Kernel
   ↓
Engines (Event · Decision · State · Graph)
   ↓
Formatter
   ↓
Response
```

### What CIL Can Answer

| Question | System |
| --- | --- |
| What happened? | History Engine |
| Why was this done? | Decision Center |
| What should I do next? | Action Engine (suggestions only) |
| What is this project? | Story / Essence |
| What was state at a time? | Time Travel (Snapshot) |
| What is MCP? | Knowledge Graph |
| Is the project healthy? | Cognitive Health + Knowledge Lifecycle |
| What needs review? | Review Queue (Lifecycle) |
| Is this decision still valid? | Decision Center + Lifecycle trust |

### Knowledge Lifecycle (v3.2)

Living Project Intelligence adds **trust over time** for decisions:

```text
ADR + Events → Lifecycle Engine → Knowledge Health + Review Queue
                      ↓
              Ask / IDE / Dashboard / MCP
```

Artifacts: `.contora/lifecycle/` — see [docs/LIFECYCLE_V1.md](https://github.com/ContoriumLabs/contorium/blob/HEAD/docs/LIFECYCLE_V1.md).

```bash
contorium lifecycle
contorium review
contorium lifecycle owner adr-001 --owner platform-team
contorium lifecycle verify adr-001 --type manual
```

Ask examples:

```bash
contorium ask "What needs review?"
contorium ask "Is the project knowledge healthy?"
```

### Example Commands

```bash
contorium ask "Why was MCP added?"
contorium ask "What happened this week?"
contorium ask "What was the state on 2024-06-18?"
```

Other tools:

```bash
contorium health
contorium lifecycle
contorium review
contorium entity mcp
contorium dna --copy
contorium questions
```

---

## PIL — Project Intelligence Layer

PIL is the **storage layer (source of truth)**.

It is deterministic and fully local.

It stores:

- STATE (current project state)
- INTENT (project goals)
- DECISION (architectural decisions)
- WHY (decision rationale)
- TIMELINE (evolution history)
- IMPACT (dependency relationships)
- PROVENANCE (origin tracking)
- CONFIDENCE (reliability signals)

All data is stored under:

```text
.contora/
```

### PIL is NOT interactive

It does not answer questions.

It only stores structured intelligence.

---

## Core Design Principle

### Separation of Responsibilities

- PIL → facts (deterministic)
- CIL → cognition (interpretation)
- LLM → optional explanation layer

---

## Three Core Actions

Contorium is built around three unified operations:

### 1. Capture

Record project intelligence.

```bash
contorium capture focus
contorium capture note
contorium capture decision
```

### 2. Inspect

Read project intelligence.

```bash
contorium inspect state
contorium inspect decision
contorium inspect timeline
contorium inspect graph
contorium inspect health
```

### 3. Transfer

Export intelligence for AI continuity.

```bash
contorium transfer context
contorium transfer intelligence
contorium transfer handoff
```

### Transfer Modes

| Mode | Purpose | Size |
| --- | --- | --- |
| Context | Resume in new AI chat | small |
| Handoff | Continue active session | compact |
| Intelligence | Full project export | deep analysis |

---

## Architecture

```text
                Query Layer (Ask)
                        │
                 Query Router
                        │
              Cognitive Kernel (CIL)
                        │
     ┌──────────────┬──────────────┬──────────────┐
     ▼              ▼              ▼
 Event Engine   Decision Engine   State Engine
     │              │              │
     └───────┬──────┴──────┬──────┘
             ▼             ▼
        Action Engine   Knowledge Graph
             │
             ▼
        IDE · MCP · CLI · Dashboard
             │
             ▼
         PIL (.contora/)
```

---

## Three Runtimes

Contorium runs across three equal environments:

| Runtime | Role |
| --- | --- |
| IDE | Workspace intelligence |
| MCP | AI agent interface |
| CLI | Terminal operations |

All share:

- `@contora/state-core`
- `.contora/` local intelligence repository

---

## Cognitive Dimensions

Contorium structures project intelligence across dimensions:

- STATE → what exists now
- INTENT → what is the goal
- DECISION → what was chosen
- WHY → reasoning behind decisions
- TIMELINE → when things changed
- IMPACT → what is affected
- PROVENANCE → where data came from
- CONFIDENCE → reliability level

---

## Cognitive Features (CIL)

- Project History Exploration
- Decision Center (ADR + conflicts)
- Time Travel (snapshot replay)
- Entity Knowledge Graph
- Cognitive Health Analysis
- Project Story / Essence
- Project DNA
- Suggested Questions

---

## Local-First Design

All intelligence is stored locally:

```text
.contora/
```

Example structure:

```text
.contora/
├── state.json
├── intent/
├── timeline/
├── graph/
├── events/
├── decisions/
├── health.json
├── config/
│   └── llm.json
```

No cloud dependency. No vendor lock-in.

---

## LLM Layer (Optional)

Contorium does NOT require LLMs.

But supports optional enhancement for:

- Why explanation
- Story generation
- Essence compression
- DNA summarization
- Suggested questions

### Configuration

```json
{
  "provider": "openai",
  "model": "gpt-5",
  "enabled_modules": [
    "why",
    "story",
    "essence",
    "dna"
  ]
}
```

---

## What Contorium Is NOT

Contorium is not:

- an autonomous coding agent
- a task execution system
- a project manager
- a recommendation engine

It does not execute actions.

It preserves and explains project intelligence.

---

## Quick Start

### MCP

```bash
npm install -g @contorium/mcp
claude mcp add --scope project contorium -- npx @contorium/mcp
```

### CLI

```bash
git clone https://github.com/ContoriumLabs/contorium.git
cd contorium
npm install
npm run compile

npx contorium init .
npx contorium ask "What is this project?"
```

### IDE

1. Install extension
2. Open workspace
3. Set Focus
4. Use **Ask Contorium**
5. Transfer Context when switching AI sessions

---

## Dashboard

Cognitive runtime dashboard includes:

- Live cognition view
- Decision governance
- Debug trace
- Project history
- Health stream

---

## Supported Platforms

- Cursor
- Claude Code
- Codex
- Gemini CLI
- VS Code
- MCP-compatible tools

---

## Links

Website: [https://www.contorium.dev](https://www.contorium.dev)

GitHub: [https://github.com/ContoriumLabs/contorium](https://github.com/ContoriumLabs/contorium)

---

## License

MIT / See LICENSE
