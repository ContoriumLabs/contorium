![Contorium demo](./demo.gif)

# Contorium
## Git for AI Collaboration

Switch between Cursor, Claude Code, Gemini CLI, VS Code, Codex, or any MCP-compatible AI tool  
without losing project context.
---
## What is Contorium?

Contorium creates a persistent shared workspace state inside your project that can be used across IDEs, MCP agents, CLI tools, and AI coding assistants.
It allows AI tools to understand the same project — even when they are different models, different sessions, or different environments.
Not chat memory.  
Not prompt stuffing.  
Not agent orchestration.
Contorium is a Git-like state layer for AI collaboration.
---
## Why Contorium?

Modern AI coding tools are powerful, but isolated.
They lose project understanding when you switch tools or sessions:
Cursor → Claude Code  
Claude Code → Gemini CLI  
VS Code → Terminal  
One AI model → Another AI model  
Contorium solves this by maintaining a structured, persistent workspace state inside your repository.
---
## Core Concept

Instead of relying on chat history, Contorium maintains a structured project state:
- Current project goal
- Active modules
- Open problems
- Recent work
- Next actions
Every AI tool reads and updates the same state.
---
## Architecture

Workspace
│
▼
Contorium State Layer (.contora/)
│
├── IDE Extension
├── MCP Server
├── CLI
└── AI Agents

The workspace is the source of truth.
IDE, MCP servers, CLI tools, and AI agents all interact with the same shared state layer.
---
## Features
🧠 Shared Project State  
Persistent project understanding stored inside your workspace.
🔄 Cross-Tool Continuity  
Switch between Cursor, Claude Code, Gemini CLI, Codex, VS Code, and MCP agents without rebuilding context.
📋 AI-Ready Context Export  
Generate clean, structured context for any AI assistant.
⚡ Tool-Independent Design  
IDE, MCP, and CLI workflows operate independently while sharing the same state.
🏗 Workspace-Aware System  
Tracks:
- File activity
- Git changes
- Active modules
- Project evolution
🔍 Structured Snapshots  
Produces stable project snapshots instead of raw chat logs.
---
## Quick Start
### IDE (VS Code / Cursor Extension)
Build and install the VSIX extension:
```bash
npm install
npm run compile
npm run vsix

Install the generated VSIX into VS Code or Cursor.

Open a workspace and run:

Contorium: Copy AI-ready context

⸻

MCP Server

Build the MCP server:

npm install
npm run compile

Configure your MCP host:

CONTORIUM_WORKSPACE=/absolute/path/to/project

Available tools:

get_project_snapshot
get_workspace_context
get_project_state

⸻

CLI

Initialize a workspace:

npx contorium init .

Generate a snapshot:

npx contorium snapshot .

View state:

npx contorium state .

⸻

Example Snapshot

Goal:
Develop documentation and authentication system
Current Stage:
Documentation work
Active Modules:
- app
- stream_session
- configuration
Open Problems:
- documentation consistency
Next Actions:
- update documentation
- validate authentication flow

⸻

Documentation

Guide	Description
Install Guide	Installation, usage, and uninstall
IDE Extension	VS Code and Cursor integration
MCP Server	Claude Code, Codex, Gemini integration
CLI	Terminal workflows
State Engine	State generation and export
Architecture v2.2	Full system design
Runtime Package	Runtime documentation

⸻

Design Principles

Workspace First

The workspace is the source of truth.

Tool Independence

IDE, MCP, and CLI can operate independently.

Stable State

Project state is deterministic and reproducible.

Minimal Context

Exports remain compact and AI-friendly.

Transparency

Conflicts are surfaced, not hidden.

⸻

Repository Structure

src/
├── scanner/
├── state/
├── state-engine/
├── state-builder/
├── cognition/
├── ai/
└── ui/
packages/
├── state-core/
├── mcp/
└── runtime/

⸻

Supported Workflows

IDE Only

VS Code / Cursor extension workflow.

MCP Only

Claude Code, Codex, Gemini, and other MCP-compatible agents.

CLI Only

Terminal-based workflows and CI environments.

Hybrid

Use IDE, MCP, and CLI together while sharing the same workspace state.

⸻

Why It Matters

AI tools are not the problem.

Context fragmentation is.

Contorium makes project understanding portable across:

* Tools
* Sessions
* Agents
* Models

⸻

Version

Version: 0.7.x
State Engine: v2.2
Architecture: Shared Workspace State Layer

⸻

Final Idea

Contorium = Git for AI Collaboration

Build once.
Switch AI tools freely.
Never lose project context.
