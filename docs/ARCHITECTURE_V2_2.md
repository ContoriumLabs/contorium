# Contorium v2.2 — Shared Workspace State Layer

Contorium is a **shared workspace state layer** for AI tools. **IDE, MCP, and CLI are peer adapters** reading and writing the same `.contora/` artifacts. `state-core` is the sole state engine; **state-builder / normalization / snapshot live in state-core** so IDE and MCP do not duplicate builder logic.

## Principles

1. **State first** — `state.json` remains backward compatible; v2.2+ adds optional `source` (writer + mode).
2. **Dual-mode State Engine**
   - **Mode A (event-driven)** — IDE `events/*.jsonl`
   - **Mode B (scan-driven)** — workspace scan
   - **Merged** — when events exist, scan only supplements git/paths; does not overwrite task/notes
3. **Three peer adapters** — IDE / MCP / CLI are first-class, not optional add-ons
4. **Stable public API** — MCP tool names, extension command IDs, existing `state.json` fields

## Directory structure

```
packages/state-core/
  src/scanner/          # workspace + git scan
  src/bootstrap/        # state.json read/write
  src/state-builder/    # L2/L3/L4: buildFromScan, normalization, snapshot, store
  src/dualMode.ts
  src/sourceMetadata.ts
packages/cli/           # CLI adapter (contorium init | sync | export | …)
packages/mcp/           # MCP adapter + 5s poll + events/git triggers
src/adapters/           # IDE adapter bridge
```

## state.json `source` metadata (v2.2+)

```json
{
  "source": {
    "mode": "merged",
    "lastWriter": "ide",
    "lastUpdated": "2026-05-20T12:00:00.000Z"
  }
}
```

MCP / CLI can tell whether state came from IDE events or bootstrap scan.

## MCP sync

- **5 second** lightweight poll (was 30s)
- **Event-driven:** watch `.contora/events/` and `.git/HEAD`, debounce refresh on change

## Commands

```bash
npm run compile

npx contorium init .
npx contorium snapshot .
npx contorium export .

# or
node packages/cli/dist/cli.js init .
```

## Data flow

| Adapter | Input | Output |
|---------|-------|--------|
| IDE | Editor/git events | state.json + cognition + V3.1 understanding |
| MCP | Bootstrap + 5s/event sync | state.json + state-builder (scan path when no events) |
| CLI | init / sync / export | Same scan/sync path as MCP |

Intent graph and BYOK are upper-layer capabilities; they do not block adapters from running standalone.

## V3.1 extension

See [ARCHITECTURE_V3.md](./ARCHITECTURE_V3.md) and [ENGINEERING_CLOSURE.md](./ENGINEERING_CLOSURE.md) for the cognitive graph layer (Version / Confidence / Hotspot / Snapshot) and frozen boundary rules.
