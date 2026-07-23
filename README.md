# Contorium

**Project Intelligence Layer for AI Coding**

> Git remembers what changed.  
> Contorium remembers why.

Contorium is a local-first project intelligence layer that preserves the **context, decisions, and reasoning** behind software projects.

It helps AI coding tools understand not only your code, but also:

- Why architectural decisions were made
- What assumptions they depend on
- How the project evolved
- Which decisions are still valid

Supported environments:

- Cursor
- Claude Code
- Codex
- Gemini CLI
- VS Code
- Any MCP-compatible AI runtime

---

## The Problem

AI coding tools are powerful, but they forget.

Every new session starts with the same problems:

```text
Why was this architecture chosen?

Why don't we use another solution?

What is the current project direction?

What decisions are still valid?
```

Developers repeatedly provide the same context.

The code exists.

The reasoning disappears.

---

## The Idea

### Git stores code history.

### Contorium stores project intelligence history.

Git tells you:

```text
What changed.
```

Contorium tells you:

```text
Why it changed.
```

It preserves:

| Intelligence | Description                 |
| ------------ | --------------------------- |
| State        | Current project situation   |
| Intent       | Project goals and direction |
| Decisions    | Architectural choices       |
| Why          | Reasoning behind decisions  |
| Timeline     | Evolution history           |
| Impact       | Dependency relationships    |
| Provenance   | Information origin          |
| Confidence   | Reliability signals         |

---

## Example

Ask:

```bash
contorium ask "Why was MCP added?"
```

Contorium:

```text
Decision #034

MCP was introduced in March 2026.

Reason:
- unify AI tool access
- reduce duplicated integrations

Original assumption:
AI environments will support MCP standards.

Current status:
VALID

Related:
- MCP Server
- IDE Extension
- AI Runtime
```

Or:

```bash
contorium ask "What decisions need review?"
```

Response:

```text
⚠️ Review Required

Database Architecture

Reason:
Original assumption:
<100k users

Current:
Project scale exceeded assumption.

Status:
NEEDS_REVALIDATION
```

---

## Core Capability

Contorium is built around three capabilities.

### 1. Capture

Capture project intelligence.

```bash
contorium capture decision
contorium capture note
contorium capture focus
```

Records:

- decisions
- events
- project state
- reasoning
- assumptions

---

### 2. Understand

Ask questions about project history.

```bash
contorium ask "What happened this week?"

contorium ask "Why was this designed this way?"

contorium ask "What is this project becoming?"
```

Powered by:

- History Engine
- Decision Center
- Knowledge Graph
- Project Story

---

### 3. Validate

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

---

## Decision Intelligence

The core idea behind Contorium:

A software project is not only code.

It is a collection of decisions.

Every decision has:

```text
Decision
Why
Assumptions
Dependencies
Evidence
Current validity
```

Contorium helps answer:

> "Does this decision still make sense today?"

---

## Architecture

```text
                 User Query
                    ↓
              Query Router
                    ↓
          Cognitive Kernel (CIL)
                    ↓
 ┌────────────┬────────────┬────────────┐
 │            │            │            │
Event      Decision      State       Graph
Engine     Engine        Engine
                    ↓
          Decision Intelligence
                    ↓
              PIL (.contora)
                    ↓
        IDE · CLI · MCP · Dashboard
```

---

## Architecture Layers

### PIL — Project Intelligence Layer

The deterministic local knowledge layer.

PIL stores:

```text
STATE
INTENT
DECISION
WHY
TIMELINE
IMPACT
PROVENANCE
CONFIDENCE
```

Location:

```text
.contora/
```

PIL does not reason.

It preserves structured project intelligence.

---

### CIL — Cognitive Interaction Layer

The interaction layer.

CIL answers:

- What happened?
- Why was this done?
- What is this project?
- What should be reviewed?
- Is this decision still valid?

CIL does not execute tasks.

It explains and explores.

---

## Knowledge Lifecycle

Projects evolve.

Knowledge becomes outdated.

Contorium tracks intelligence validity through:

```text
Events
ADR
Code changes
Dependency changes
        ↓
Assumption Graph
        ↓
Impact Engine
        ↓
Validity State
```

Example:

```text
Decision:
Use SQLite

Original assumption:
Small deployment

Current:
Large-scale production usage

Result:
WARNING
Review required
```

---

## Three Unified Operations

### Capture

Record intelligence.

### Inspect

Explore intelligence.

Examples:

```bash
contorium inspect state

contorium inspect decision

contorium inspect timeline

contorium inspect health
```

### Transfer

Move project context between AI sessions.

```bash
contorium transfer context

contorium transfer handoff

contorium transfer intelligence
```

---

## Runtime Support

Contorium runs across:

| Runtime | Purpose                |
| ------- | ---------------------- |
| IDE     | Workspace intelligence |
| MCP     | AI tool interface      |
| CLI     | Developer operations   |

All share:

```text
@contora/state-core

.contora/
```

---

## Local First

Your project intelligence stays with your project.

```text
.contora/

├── state/
├── decisions/
├── events/
├── lifecycle/
├── graph/
├── health/
└── config/
```

No cloud dependency.

No vendor lock-in.

---

## Optional AI Layer

Contorium works without LLMs.

Optional AI improves:

- explanation
- project story
- project essence
- DNA summary
- suggested questions

AI is an interpreter.

Not the source of truth.

---

## What Contorium Is NOT

Contorium is not:

- ❌ Autonomous coding agent
- ❌ Task execution system
- ❌ Project management tool
- ❌ AI replacement developer

Contorium does not decide for you.

It preserves and explains the intelligence behind your decisions.

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

---

## Vision

AI coding will not only require better models.

It will require better memory.

Contorium aims to become the intelligence layer that allows software projects to remember:

- what they are
- why they exist
- how they evolved
- where they should go next

---

## Links

**Website:** [https://www.contorium.dev](https://www.contorium.dev)

**GitHub:** [https://github.com/ContoriumLabs/contorium](https://github.com/ContoriumLabs/contorium)

**License:** MIT
