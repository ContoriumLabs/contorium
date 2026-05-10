# ContextRecall

A lightweight **session memory** layer for VS Code (and VS Code–based editors such as Cursor). It keeps a small, local snapshot of your workspace so you can pick up work after closing the editor or switching projects.

**Extension ID:** `context-recall` · **Display name:** ContextRecall (see `package.json`).

---

## Why

When you reopen a project, you often ask:

> “What was I working on again?”

You re-read files, re-open tabs, and rebuild context. This extension stores **task + notes (what you type)**, **which files are open**, a **working set** of files you recently focused or saved, and **Git working-tree paths** — all in one JSON file under the workspace.

---

## What it does (and does not)

| | |
|--|--|
| **Does** | Persist `currentTask`, `notes`, `openFiles`, `recentFiles` (working set), `gitModified` to **`.context-recall/state.json`** at the **workspace root** (not under `.workspace/`). |
| **Does** | Optionally **re-open up to *N* editor tabs** from the last snapshot when you open the folder (`autoRestore` + `maxRestoreEditors`). |
| **Does** | **Export** a plain-text summary to the **clipboard** (task, open tabs, working set, Git list, notes). |
| **Does not** | Sync to the cloud, read Cursor Chat, or call external analytics APIs. |
| **Does not** | Replace Git history or show full `git log` — only a path list derived from `git status` (see below). |

---

## Key features

### Persistent workspace memory

**File:** `<workspace-root>/.context-recall/state.json`

**Fields:**

- `currentTask` — your text (sidebar); not auto-filled from AI chat.
- `notes` — your text.
- `openFiles` — workspace-relative paths currently open in editor tabs (within this workspace folder).
- `recentFiles` — **working set**: files you **focused** or **saved** recently (capped by settings); not “every tab ever opened”.
- `gitModified` — paths reported by **`simple-git`** `git.status()` (includes staged, modified, untracked/`not_added`, created, deleted, renamed, conflicted).

### Smart working set

Tracks meaningfully **activated or saved** files — **not** every open tab merged into history on each sync.

### Git awareness

Uses local **`simple-git`** + **`git.status()`** for paths listed above. This is a **flat path list**, not a full diff viewer.

### Session restore

When enabled, **opens editors** from saved paths (working set first, then open tabs), up to **`contextRecall.maxRestoreEditors`**.  
It does **not** restore full VS Code UI layout, terminals, or breakpoints — only tries to open files.

### AI context export (**clipboard**)

Command **`contextRecall.exportAIContext`** builds English-labelled sections (task, open files, working set, Git paths, notes) and copies to the clipboard. Paste into ChatGPT, Claude, another Cursor chat, etc.

### Sidebar

**Activity bar:** **ContextRecall**  
**View:** **Session & Context** — edit task/notes, lists, click a path to open the file.

---

## Commands

Use **Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`). Command **IDs** (for `keybindings.json`) are:

| Command ID | Purpose |
|------------|---------|
| `contextRecall.exportAIContext` | Copy AI-ready workspace summary to clipboard. |
| `contextRecall.saveStateNow` | Flush current tabs + Git state to disk immediately. |
| `contextRecall.restoreSession` | Open editors again from the saved snapshot (same rules as restore). |

---

## Configuration

All keys are under the **`contextRecall`** namespace:

| Setting | Default | Description |
|---------|---------|-------------|
| `contextRecall.autoRestoreOnOpen` | `true` | After opening the workspace, auto-open editors from the last snapshot. |
| `contextRecall.maxRestoreEditors` | `8` | Max editors to open (`0` = do not auto-open on startup). |
| `contextRecall.workingSetMaxFiles` | `40` | Max paths kept in the working set (`recentFiles`). |

---

## Migration from older builds

If you previously used **`.project-recall/state.json`**, rename the folder to **`.context-recall`** and move `state.json` inside (or copy its contents into a new `.context-recall/state.json`). Command IDs and settings keys changed from `projectRecall.*` to **`contextRecall.*`** — update **Keyboard Shortcuts** / **settings.json** if you customized them.

---

## Installation

### From VSIX

**Extensions** → **⋯** → **Install from VSIX…** → reload the window.

### From source

```bash
git clone <repository-url>
cd <your-repo-folder>   # e.g. sessionrecall
npm install
npm run compile
```

Press **F5** to run in the **Extension Development Host**.

### Package

```bash
npm run compile
npx @vscode/vsce package
```

---

## Requirements

- Open a **folder** workspace (**File → Open Folder**). A single-file window has no workspace root; the extension cannot write state meaningfully.
- VS Code engine: **`^1.85.0`** (see `package.json`).

---

## Privacy

Data stays under **`<workspace-root>/.context-recall/`**. This repository’s extension code does not add telemetry or intentional outbound network calls for session data.

---

## Project structure

```text
src/
├── extension.ts
├── scanner/
│   ├── workspaceScanner.ts
│   └── gitScanner.ts
├── state/
│   ├── stateManager.ts
│   └── recovery.ts
├── ui/
│   └── sidebarProvider.ts
└── types/
    └── state.ts
```

---

## Contributing

PRs welcome. Run `npm run compile` before submitting.

---

## License

[MIT License](https://github.com/frankleeeeeee-labs/context-recall/blob/main/LICENSE). Copyright (c) 2026 frankleeeeeee-labs.

*(Update the GitHub URL in `package.json` → `repository` / `homepage` if your fork lives elsewhere; match the default branch name in this link if not `main`.)*
