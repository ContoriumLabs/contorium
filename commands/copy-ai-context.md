# Copy AI-ready context

Export converged workspace context to the clipboard for any AI chat.

## IDE

1. Open a **folder** workspace in VS Code / Cursor with Contorium installed.
2. Set **Current focus** in the sidebar (optional but recommended).
3. Edit/save files so understanding artifacts can build (~7s debounce).
4. Click **Copy AI-ready context** or run:

   `Contorium: Copy AI-ready context (clipboard)`

## CLI (same canonical format)

```bash
npx contorium export . > ai-context.md
npx contorium export . --format json > ai-context.json
```

## MCP (agent pulls equivalent data)

```text
get_project_handoff          # execution entry
get_project_graph_snapshot   # compact cognitive summary (preferred over full graph)
get_project_snapshot         # L4 project snapshot
get_workspace_context        # state.json
```

## Export sections (V3.1)

| Section | Source |
|---------|--------|
| TASK ANCHOR | `state.json` currentTask |
| PROJECT SNAPSHOT | L4 `project-snapshot.md` |
| WORKING CONTEXT | Open files + git activity |
| COGNITIVE SNAPSHOT | `.contora/graph/snapshot.json` |
| CHANGE SET / IMPACT SET | `handoff.json` |
| AI HANDOFF (V3.1) | `handoff.json` |
| CODE EVOLUTION | `timeline.json` |
| INSIGHTS / NOTES / INSTRUCTION | Heuristics + user notes + AI mode |

See [IDE_EXTENSION.md](../docs/IDE_EXTENSION.md) and [ARCHITECTURE_V3.md](../docs/ARCHITECTURE_V3.md).
