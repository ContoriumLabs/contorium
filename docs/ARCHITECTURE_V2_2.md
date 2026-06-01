# Contorium v2.2 — Shared Workspace State Layer

Contorium is a **shared workspace state layer** for AI tools. **IDE、MCP、CLI 三个 Adapter 平级**，共同读写同一套 `.contora/` 产物；`state-core` 是唯一状态引擎，**state-builder / normalization / snapshot 均内聚在 state-core**，避免 IDE 与 MCP 各写一套 builder。

## 原则

1. **State first** — `state.json` 向后兼容；v2.2 新增可选字段 `source`（谁写的、什么模式）。
2. **Dual-mode State Engine**
   - **Mode A (event-driven)** — IDE `events/*.jsonl`
   - **Mode B (scan-driven)** — workspace 扫描
   - **Merged** — 有 events 时扫描只补 git/路径，不覆盖 task/notes
3. **三 Adapter 平级** — IDE / MCP / CLI 均为一等公民，非「CLI 可选」
4. **对外接口不变** — MCP 工具名、扩展 command ID、原有 `state.json` 字段

## 目录结构

```
packages/state-core/
  src/scanner/          # workspace + git 扫描
  src/bootstrap/        # state.json 读写
  src/state-builder/    # L2/L3/L4：buildFromScan, normalization, snapshot, store
  src/dualMode.ts
  src/sourceMetadata.ts
packages/cli/           # CLI Adapter（contorium init | snapshot）
packages/mcp/           # MCP Adapter + 5s 轮询 + events/git 触发
src/adapters/           # IDE Adapter 桥接
```

## state.json `source` 元数据（v2.2 新增）

```json
{
  "source": {
    "mode": "merged",
    "lastWriter": "ide",
    "lastUpdated": "2026-05-20T12:00:00.000Z"
  }
}
```

MCP / CLI 可据此判断状态来自 IDE 还是 bootstrap。

## MCP 同步

- **5 秒**轻量轮询（原 30 秒）
- **事件驱动**：watch `.contora/events/` 与 `.git/HEAD`，有变化 debounce 后刷新

## 命令

```bash
npm run compile

# CLI（与 npx contorium 等价，编译后）
npx contorium init .
npx contorium snapshot .

# 或
node packages/cli/dist/cli.js init .
```

## 数据流

| Adapter | 输入 | 输出 |
|---------|------|------|
| IDE | 编辑器/git 事件 | state.json + cognition 产物 |
| MCP | bootstrap + 5s/事件同步 | state.json + state-builder（无 events 时） |
| CLI | init / snapshot | 同上 scan 路径 |

Intent graph 与 BYOK 仍为上层能力，不阻塞三 Adapter 独立运行。
