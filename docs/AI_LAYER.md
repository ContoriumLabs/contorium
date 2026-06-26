# Contorium AI Layer

Optional **explanation-layer** LLM integration: **facts stay rule-based; explanations may use LLM**. PIL and CIL run fully without AI when `enabled: false` (default).

- [CIL Freeze](./CIL_FREEZE.md) · [Overview](./OVERVIEW.md) · [Dashboard LLM Config](./DASHBOARD.md#view-e--llm-config)

---

## Architecture

```text
PIL (facts, events, ADR, snapshots)
 ↓
CIL Kernel (rule engines — no LLM)
 ↓
AI Provider Layer (packages/state-core/src/ai/)
 ↓
OpenAI · Anthropic · OpenRouter · Gemini · DeepSeek · Ollama
```

---

## Principles

| Layer | LLM allowed? |
|-------|----------------|
| eventEngine, snapshotEngine, knowledgeGraph, decisionGraph, cognitiveHealth, handoffReplay | **No** |
| Why, Story, Essence, DNA, Ask enhance, Intent Router (hybrid) | **Optional** |

Kernel fact engines must not call LLM. The AI Layer only consumes structured facts already on disk. See [CIL_FREEZE.md](./CIL_FREEZE.md).

---

## Configuration

**Settings file:** `.contora/config/llm.json` (safe to commit structure — **never** put API keys here)

Default:

```json
{
  "enabled": false,
  "provider": "openai",
  "model": "gpt-4o-mini",
  "api_key_env": "CONTORIUM_LLM_API_KEY",
  "temperature": 0.2,
  "max_tokens": 4000,
  "intent_router": { "enabled": false, "mode": "hybrid" },
  "enabled_modules": ["why", "story", "essence", "dna", "ask_enhance"],
  "cache": { "enabled": true, "ttl_days": 30 }
}
```

**API keys:** stored per provider in `.contora/config/.llm-keys.json` (gitignored via `.contora/`). Legacy single-file `.contora/config/.llm-key` is migrated automatically on first read.

- Environment override: `CONTORIUM_LLM_API_KEY` or provider-specific env from `api_key_env`
- Response cache: `.contora/cache/llm/`

---

## CLI commands

```bash
contorium ai setup [path] [--provider openai|anthropic|open_router|gemini|deepseek|ollama] [--model MODEL] [--enable] [--router rule|hybrid|llm]
contorium ai status [path] [--json]
contorium ai test [path] [--json]
```

---

## Dashboard — View E (LLM Config)

In the **Cognitive State** dashboard, **LLM Config** is the **fifth View Mode** (`E`) — not a separate panel below View Mode.

| Step | Action |
|------|--------|
| **1 — Select provider** | `↑↓` cycle View Mode to **LLM Config** · `←→` or `h` cycle provider · **Enter** confirm |
| **2 — Enter API key** | Type or **Ctrl+V** paste (plain text, visible) · **Enter** save and auto-test · **Esc** back to step 1 |

**Provider list:** OpenAI · Anthropic · OpenRouter · Gemini · **DeepSeek** · Ollama (local)

**Per-provider keys:**

- Each provider has its own key in `.llm-keys.json`
- Switching to a provider **without** a saved key always prompts for a new key (never reuses another provider's key)
- Providers with saved keys show **`· configured`** in the list
- Selecting a **configured** provider and pressing **Enter** activates it and runs a connection test with that provider's key
- Ollama skips the key step and tests directly

**View Mode keys:**

| Key | Action |
|-----|--------|
| `↑` / `↓` | Cycle view modes A–E |
| `←` / `→` | Cycle provider (view E, step 1) |
| `Enter` | Apply A/B · confirm provider (E) · save key (E step 2) |
| `Esc` | Back to provider list (E step 2) |

Modes C, D, and E (except provider/key actions above) are preview-only for MCP mode apply.

---

## Modules

| Module | Entry | Behavior |
|--------|-------|----------|
| `why` | `ask` on decision questions | Rule ADR facts + LLM natural-language explanation |
| `story` / `essence` / `dna` | `contorium story\|essence\|dna` | Rule-generated Markdown → LLM narrative polish |
| `ask_enhance` | non-decision `ask` | Polish on rule-based answer |
| `intent_router` | `routeIntent` | hybrid: LLM classifies intent when rule match is weak |

**Intent router modes:**

- `rule` — rules only (safest default)
- `hybrid` — rules first, LLM fallback on weak match
- `llm` — LLM-first (requires `intent_router.enabled: true`)

---

## Code entry points

- `packages/state-core/src/ai/runtime.ts` — `aiGenerate()`, `testAiConnection()`, `getAiStatus()`
- `packages/state-core/src/ai/config.ts` — `readProviderLlmKey`, `writeProviderLlmKey`, `listConfiguredLlmProviders`
- `packages/state-core/src/ai/routeIntent.ts` — hybrid intent routing
- `packages/state-core/src/ai/generators/` — Why / Story / Essence / DNA / Ask enhance
- `packages/state-core/src/cil/queryEngine.ts` — `askProject` Why + Ask polish
- `packages/cli/src/dashboard/aiConfigBridge.ts` — dashboard snapshot and provider flow

---

## IDE bridge

IDE settings sync to `llm.json` via `contora.cilAiEnabled` and existing BYOK (`contora.aiProvider` + SecretStorage):

| IDE setting | CIL `llm.json` |
|-------------|----------------|
| `contora.cilAiEnabled` | `enabled` |
| `contora.aiProvider` | `provider` (`google` → `gemini`; `deepseek` → native deepseek provider) |
| SecretStorage `contora.apiKey.*` | Runtime inject `CONTORIUM_IDE_LLM_API_KEY` (not written to disk) |
| `contora.cilIntentRouter` | `intent_router.mode` |

- Sidebar **Developer → CIL AI Layer**: status, test, settings link
- Command: **Contorium: Test CIL AI connection**

---

## MCP tools

| Tool | Purpose |
|------|---------|
| `get_ai_status` | Module flags, provider, router mode (no secrets) |
| `test_ai_connection` | Connectivity test using workspace `llm.json` + keys / env |

---

## Providers

| Provider | Notes |
|----------|-------|
| OpenAI | Default `gpt-4o-mini` |
| Anthropic | Claude models |
| OpenRouter | Multi-model gateway |
| Gemini | Native `generateContent` API |
| **DeepSeek** | OpenAI-compatible API · default `deepseek-chat` · `https://api.deepseek.com/v1` |
| Ollama | Local · no API key required |

---

## Future (optional)

- Token budget via `budget.monthly_tokens` in `llm.json`
