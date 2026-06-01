# Contorium 安装 · 使用 · 卸载（三端平级）

> 返回 [README](../README.md) · 分端文档：[IDE](./IDE_EXTENSION.md) · [MCP](./MCP.md) · [CLI](./CLI.md)

Contorium v2.2：**IDE / MCP / CLI 三个 Runtime Adapter 平级**，共用 `@contora/state-core` 与项目内 `.contora/`。  
任意一端可**独立**初始化并维护状态；组合使用时会自动合并（`source.mode: merged`）。

| Adapter | 典型用户 | 独立能力 |
|---------|----------|----------|
| **IDE** | VS Code / Cursor 开发者 | 事件流、侧栏、一键复制、BYOK |
| **MCP** | Claude Code / Cursor Agent / Codex / Gemini | bootstrap、5s+事件同步、10 个 MCP tools |
| **CLI** | 终端 / CI / 无 IDE 环境 | `init` / `sync` / `snapshot` / `status` / `state` |

**对外接口未变**：`state.json` 字段向后兼容；MCP 工具名、扩展 command ID 不变。v2.2 新增可选字段 `source`。

---

## 一、前置条件（三端共用）

| 要求 | 说明 |
|------|------|
| Node.js | **18+**（MCP / CLI / 源码构建） |
| 工作区 | 真实项目**文件夹**路径 |
| 构建（源码） | 仓库根目录 `npm install && npm run compile` |

产物目录：

```text
.contora/                    # 三端读写同一目录
├── state.json               # + source { mode, lastWriter, lastUpdated }
├── state-builder/           # L4 snapshot（scan 或 IDE 认知管道）
├── events/                  # IDE 事件（CLI/MCP 可读，IDE 写入）
└── mcp/                     # MCP store_memory（可选）
```

---

## 二、安装

### 2.1 IDE 扩展

| 方式 | 命令 / 操作 |
|------|-------------|
| VSIX（推荐） | 下载 Release 或 `npm run vsix` → 扩展 → **从 VSIX 安装** → Reload |
| 市场 | 搜索 **Contorium**（`franklee-dev`） |
| 开发 | `npm run compile` → F5 Extension Development Host |

详见 [IDE_EXTENSION.md](./IDE_EXTENSION.md)。

### 2.2 MCP Server

```bash
git clone https://github.com/ContoriumLabs/contorium.git
cd contorium
npm install
npm run compile          # 或 npm run build:mcp
```

配置宿主（**路径改成本机绝对路径**）：

```json
{
  "mcpServers": {
    "contorium": {
      "command": "node",
      "args": ["E:/path/to/contorium/bin/contorium-mcp-launch.cjs"],
      "env": {
        "CONTORIUM_WORKSPACE": "E:/path/to/your-project"
      }
    }
  }
}
```

| 宿主 | 安装要点 |
|------|----------|
| Cursor | Settings → MCP → 启用 `contorium` |
| Claude Code | `claude mcp add ...` 或 `claude --plugin-dir .` |
| Codex | `codex mcp add contorium -- node .../contorium-mcp-launch.cjs` |
| Gemini CLI | `~/.gemini/settings.json` → `mcpServers.contorium` |

详见 [MCP.md](./MCP.md)。

### 2.3 CLI

**无需单独 npm 发布包**——与仓库一起构建：

```bash
npm install
npm run compile
```

使用（项目根或任意目录）：

```bash
npx contorium --help
npx contorium init .
```

全局链接（可选）：

```bash
npm link    # 在 contorium 仓库根目录
contorium status .
```

详见 [CLI.md](./CLI.md)。

---

## 三、使用（独立场景）

### 3.1 仅 IDE

1. 安装扩展 → 打开**文件夹**工作区  
2. 侧栏设置 **Current focus**，正常编码  
3. **Copy AI-ready context** 复制到任意 AI 聊天  

无需 MCP / CLI。

### 3.2 仅 MCP

1. `npm run compile`  
2. 配置 MCP，`CONTORIUM_WORKSPACE` 指向项目根  
3. 启动 Agent — MCP 会自动 **bootstrap**（无 `state.json` 时 scan 创建）  
4. 调用 `get_workspace_context` / `get_project_snapshot`  

无需 IDE；状态为 scan/merged，无 IDE 事件时精度低于扩展。

### 3.3 仅 CLI

```bash
cd /path/to/your-project
npx contorium init .       # 创建或合并 state.json + snapshot
npx contorium sync .       # 重新扫描（git、最近文件）
npx contorium snapshot .   # 输出 PROJECT SNAPSHOT
npx contorium status .     # JSON：mode、source、git 统计
npx contorium state .      # 完整 state.json
```

无需 IDE / MCP；适合 CI、纯终端、脚本集成。

### 3.4 组合使用（推荐）

| 组合 | 效果 |
|------|------|
| IDE + MCP | IDE 写 events + 认知；MCP 读最新 snapshot |
| IDE + CLI | IDE 日常；CLI 在 CI 里 `snapshot` |
| 三端全开 | `source.lastWriter` 标记最后写入方，互不覆盖 task/notes |

---

## 四、命令对照（v2.2 是否有变）

| 能力 | IDE | MCP | CLI |
|------|-----|-----|-----|
| 初始化 `.contora/` | 打开文件夹即创建 | 启动时 bootstrap | `contorium init` |
| 刷新 git/路径 | 自动扫描 | 5s + events/git watch | `contorium sync` |
| 读 state | 侧栏 | `get_workspace_context` | `contorium state` |
| 读 snapshot | 侧栏 / 复制 | `get_project_snapshot` | `contorium snapshot` |
| 状态摘要 | 侧栏 | tools JSON | `contorium status` |
| 写 task/notes | 侧栏 | — | — |
| Agent 记忆 | — | `store_memory` | — |
| 一键复制 Markdown | Copy AI-ready context | — | — |

**未改变的**：扩展 command ID、MCP 10 个 tool 名称、`state.json` 原有字段。

**新增的**：CLI 命令 `sync` / `status` / `state`；`state.json` 可选 `source` 块。

---

## 五、卸载

### 5.1 IDE

扩展 → Contorium → **卸载** → Reload Window  

手动（损坏时）：

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.cursor\extensions\franklee-dev.contorium-*"
Remove-Item -Recurse -Force "$env:USERPROFILE\.vscode\extensions\franklee-dev.contorium-*"
```

### 5.2 MCP

| 宿主 | 命令 |
|------|------|
| Claude Code | `claude mcp remove contorium` |
| Codex | `codex mcp remove contorium` |
| Cursor | Settings → MCP → 删除 `contorium` |
| Gemini | 从 `settings.json` 删除 `mcpServers.contorium` |

### 5.3 CLI

```bash
npm unlink -g contorium   # 若曾 npm link
```

CLI 无后台服务；删除仓库或不再调用即可。  
**不会**自动删除 `.contora/`。

### 5.4 清除工作区数据（三端共用，可选）

**PowerShell（项目根）：**

```powershell
Remove-Item -Recurse -Force .contora -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .context-recall -ErrorAction SilentlyContinue
```

**macOS / Linux：**

```bash
rm -rf .contora .context-recall
```

---

## 六、`contorium init` 输出说明

已有 `.contora/state.json` 且存在 events 时，输出类似：

```json
{
  "workspaceRoot": "E:\\sessionrecall",
  "mode": "merged",
  "created": false,
  "updated": true,
  "source": {
    "mode": "merged",
    "lastWriter": "cli",
    "lastUpdated": "2026-05-20T12:00:00.000Z"
  },
  "eventCount": 232
}
```

| 字段 | 含义 |
|------|------|
| `created: false` | **正常** — 不是首次创建，而是合并已有状态 |
| `mode: merged` | 有 events + state，scan 只补 git/路径 |
| `updated: true` | 本次写入了 state 或 snapshot |

若目录从未初始化：`created: true`，`mode: scan-driven`。

---

## 七、相关文档

- [README](../README.md)
- [IDE 扩展](./IDE_EXTENSION.md)
- [MCP Server](./MCP.md)
- [CLI](./CLI.md)
- [Architecture v2.2](./ARCHITECTURE_V2_2.md)
- [State Engine](./STATE_ENGINE.md)
