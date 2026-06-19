![Contorium demo](./demo.gif)

# Contorium

## AI Runtime Cognition System for Continuous Project Understanding

Contorium is a cross-tool runtime system that gives AI coding assistants a persistent understanding of your project across sessions, tools, and models.

It connects IDEs, CLI tools, and MCP agents through a shared runtime cognition layer.

---

## Why Contorium

AI coding tools are powerful, but stateless.

Every new session resets context:

- architecture must be re-explained
- project intent is lost
- decisions are not retained
- switching tools breaks continuity

Contorium solves this by introducing a persistent runtime cognition layer for software development.

---

## What Contorium Does

Contorium continuously builds and maintains a live understanding of your codebase and exposes it to any AI tool you use.

Instead of:

```text
AI → loses context → rebuilds understanding → repeats work
```

You get:

```text
AI → maintains understanding → continues work → stays aligned
```

## Core Architecture

Contorium is built as a 5-layer runtime cognition system:

### 1. Runtime Memory Layer

Maintains persistent project state across sessions.

Tracks:

- tasks
- active work
- project intent
- recent changes

### 2. Project Understanding Layer

Builds structural awareness of the codebase.

- change detection
- dependency tracking
- hotspot identification
- module relationships

### 3. Knowledge Graph Layer

Transforms code into structured relationships:

```text
Intent → Module → File → Function
```

Enables AI to understand structure, not just text.

### 4. Governance Layer (V4)

A structured decision system for code changes.

Generates:

- review.json
- decision.json
- scope.json
- trace.json
- cycle.json

Provides:

- change classification
- risk evaluation
- impact analysis
- explainable reasoning chains

### 5. AI Interaction Layer

Controls how AI receives project context.

- AI handoff system
- runtime snapshot export
- controlled context injection (Y/N prompt)
- cross-session continuity

## AI Handoff System

When starting a new AI session:

```text
[?] Runtime active.
Inject current project state? (Y/n)
```

You decide whether context is injected.

No automatic injection. No hidden behavior.

## Cross-Tool Continuity

Contorium works across:

- Claude Code
- Codex
- Cursor
- Gemini CLI
- VS Code
- MCP-compatible tools

All tools share a single runtime state:

```text
IDE → CLI → MCP → AI Tools
      ↘ shared runtime ↙
```

## Runtime Dashboard

Live project awareness during development.

### Passive Mode

```text
[●] task: fix MCP bootstrap
    last: calculateRisk()
    agent: mcp
```

### Expanded Mode

- dependency graph
- function call chains
- runtime timeline
- governance decisions
- AI export view

Available in:

- VS Code
- CLI
- Cursor

## Knowledge Graph

Contorium builds a structured understanding of your project:

```text
Intent
  ↓
Module
  ↓
File
  ↓
Function
```

This enables AI to reason over structure and relationships.

## Hotspot Detection

Automatically identifies important areas of the codebase:

- frequently modified files
- critical modules
- high-impact functions
- active development zones

## Runtime Snapshot

A continuously updated AI-ready project state.

Includes:

- current goal
- active task
- recent changes
- project structure
- governance context

Used for:

- AI handoff
- new sessions
- tool switching
- continuity workflows

## Governance Engine (V4)

A structured system for evaluating code changes.

### Artifacts

Stored under:

```text
.contora/governance/
```

Includes:

- review.json
- decision.json
- scope.json
- trace.json
- trace-full.json
- cycle.json

### What it does

- change classification
- risk evaluation
- scope analysis
- impact reasoning
- decision explanation

---

## Supported Tools

| Tool        | Support |
| ----------- | ------- |
| Claude Code | ✅      |
| Codex       | ✅      |
| Cursor      | ✅      |
| Gemini CLI  | ✅      |
| VS Code     | ✅      |
| MCP Hosts   | ✅      |

---

## Quick Start

### Install MCP

```bash
npm install -g @contorium/mcp
```

### Add to your AI tool

#### Codex

```bash
codex mcp add contorium -- npx @contorium/mcp
```

#### Claude Code

```bash
claude mcp add --scope project contorium -- npx @contorium/mcp
```

### Start using

Open any MCP-compatible AI tool.

Contorium will automatically:

- initialize runtime state
- build project understanding
- enable AI handoff system

No manual setup required.

---

## Install Options

Contorium provides three runtime adapters:

| Adapter | Package           | Purpose              |
| ------- | ----------------- | -------------------- |
| MCP     | @contorium/mcp    | AI tool integration  |
| IDE     | VS Code extension | editor integration   |
| CLI     | contorium         | terminal & automation |

All adapters share a single project memory:

```text
.contora/
```

---

## Architecture

Contorium is a shared runtime system built on a single core:

```text
IDE Adapter
CLI Adapter
MCP Adapter
      ↓
@contora/state-core
      ↓
.contora/ (persistent project cognition)
```

---

## Local-First Design

All project cognition is stored locally:

```text
.contora/
├── state.json
├── handoff.json
├── graph.json
├── timeline.json
├── governance/
├── events/
```

No cloud dependency. No vendor lock-in.

---

## What Contorium Is Not

Contorium is NOT:

- an autonomous coding agent
- a task generator
- a code-writing system
- an AI replacement

Contorium does not decide what to build.

It preserves understanding so developers can decide faster.

---

## Vision

AI coding tools reset context every session.

Contorium removes that limitation.

Project understanding should persist — even when conversations do not.

---

## Links

- **Website:** https://www.contorium.dev/
- **GitHub:** https://github.com/ContoriumLabs/contorium

---

## License

See LICENSE.
