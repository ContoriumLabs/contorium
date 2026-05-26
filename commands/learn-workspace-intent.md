---
name: learn-workspace-intent
description: Run Contorium BYOK workspace intent learning when API keys are configured.
---

# Learn workspace intent

Use when structured operational intent would help the user or export quality.

1. Check `contora.aiProvider` is not `off` and the vendor API key is configured via **Contorium: Configure API key…**.
2. Run **Contorium: Learn workspace intent (AI)** (`contora.analyzeWorkspaceIntent`).
3. Intent is stored in `.contora/last-intent.json` with lifecycle metadata; stale intent is ignored automatically on export and in the sidebar.
