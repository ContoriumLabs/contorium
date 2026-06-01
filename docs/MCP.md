# Contorium MCP Server

stdio MCP 服务，供 **Claude Code、Cursor Agent、OpenAI Codex、Gemini CLI** 等调用。  
**v2.2 可独立运行**：无 IDE 时启动即 bootstrap `.contora/`；**5s 轮询 + events/git 变化触发**同步。  
三端总览：[INSTALL.md](./INSTALL.md) · [README](../README.md#安装--使用--卸载三端) · 架构 [ARCHITECTURE_V2_2.md](./ARCHITECTURE_V2_2.md)。

---

## 命令速查

| 阶段 | 命令 / 操作 |
|------|-------------|
| **安装（构建）** | `git clone … && cd contorium && npm install && npm run compile` |
| **验证启动** | `set CONTORIUM_WORKSPACE=E:\your-project` 后 `node bin/contorium-mcp-launch.cjs`（应见 `ready on stdio`） |
| **Cursor 配置** | Settings → MCP → 启用 `contorium`（见下文 JSON） |
| **Claude Code** | `claude mcp add --scope project contorium -- node E:/path/to/contorium/bin/contorium-mcp-launch.cjs` |
| **Codex** | `codex mcp add contorium -- node E:/path/to/contorium/bin/contorium-mcp-launch.cjs` |
| **日常使用** | Agent 调用 `get_workspace_context` / `get_project_snapshot` / `store_memory` |
| **卸载 Cursor** | Settings → MCP → 删除 `contorium` |
| **卸载 Claude** | `claude mcp remove contorium` |
| **卸载 Codex** | `codex mcp remove contorium` |
| **清除 MCP 记忆（可选）** | `Remove-Item -Recurse -Force .contora\mcp`（PowerShell，项目根） |

---

## 一、前置条件

| 要求 | 说明 |
|------|------|
| Node.js | **18+**（与扩展打包一致） |
| 工作区 | 已打开的真实项目目录 |
| 扩展（建议） | 安装 [IDE 扩展](./IDE_EXTENSION.md) 可获得事件驱动 State Engine；无扩展时 MCP 仍可 bootstrap |
| 构建 | 首次使用前在仓库执行 `npm run compile`（或 `npm run build:mcp`） |

---

## 二、安装 MCP

### 2.1 构建（从源码）

在 **contorium 仓库根目录**：

```bash
git clone https://github.com/ContoriumLabs/contorium.git
cd contorium
npm install
npm run compile
```

产物：

- 入口：`packages/mcp/dist/server.js`
- 便携启动器：`bin/contorium-mcp-launch.cjs`（推荐用于插件/绝对路径场景）

验证：

```bash
node packages/mcp/dist/server.js
# 应输出 [contorium-mcp] ready on stdio 后等待（Ctrl+C 退出）
```

### 2.2 Cursor IDE

**方式 A — 使用仓库根目录 `mcp.json`（开发/本地克隆）**

1. 用 Cursor 打开 **contorium 仓库** 或把下列配置合并进项目的 `.cursor/mcp.json` / 用户 MCP 设置
2. 将 `args` 中的路径改为你本机 **绝对路径** 的 `packages/mcp/dist/server.js`
3. `CONTORIUM_WORKSPACE` 设为 **你正在开发的项目根目录**（不是 contorium 仓库本身，除非你在该仓库内工作）

```json
{
  "mcpServers": {
    "contorium": {
      "command": "node",
      "args": ["E:/your-project/path/to/contorium/packages/mcp/dist/server.js"],
      "env": {
        "CONTORIUM_WORKSPACE": "E:/your-actual-workspace"
      }
    }
  }
}
```

4. **Cursor → Settings → MCP** → 启用 `contorium` → 重启 Agent / Reload Window

**方式 B — 便携启动器（路径含空格或跨目录时）**

```json
{
  "mcpServers": {
    "contorium": {
      "command": "node",
      "args": ["E:/path/to/contorium/bin/contorium-mcp-launch.cjs"],
      "env": {
        "CONTORIUM_WORKSPACE": "E:/your-actual-workspace"
      }
    }
  }
}
```

### 2.3 Claude Code

**插件方式（推荐，使用仓库内 `.mcp.claude.json`）：**

```bash
cd /path/to/contorium
npm run build:mcp
claude --plugin-dir .
```

**仅 MCP（项目作用域）：**

```bash
cd /path/to/your-workspace
claude mcp add --scope project contorium -- node /path/to/contorium/bin/contorium-mcp-launch.cjs
```

环境变量（插件会自动注入部分变量）：

- `CONTORIUM_WORKSPACE` — 工作区根目录
- `CLAUDE_PROJECT_DIR` / `CLAUDE_PROJECT_ROOT` — Claude Code 项目目录

### 2.4 OpenAI Codex

```bash
cd /path/to/contorium
npm run build:mcp
codex mcp add contorium -- node ./bin/contorium-mcp-launch.cjs
```

或使用仓库 [`.mcp.json`](../.mcp.json) 与 [`.codex-plugin/plugin.json`](../.codex-plugin/plugin.json) 安装插件后，在 Codex 设置中启用 `contorium` MCP。

### 2.5 Gemini CLI

在 `~/.gemini/settings.json` 或项目 `.gemini/settings.json` 中添加（**使用绝对路径**）：

```json
{
  "mcpServers": {
    "contorium": {
      "command": "node",
      "args": ["/absolute/path/to/contorium/bin/contorium-mcp-launch.cjs"],
      "env": {
        "CONTORIUM_WORKSPACE": "/absolute/path/to/your-workspace"
      }
    }
  }
}
```

修改后重启 Gemini CLI 会话。

### 2.6 MCP Inspector（调试）

```bash
npx @modelcontextprotocol/inspector node packages/mcp/dist/server.js
```

在浏览器中手动调用各 tool，确认 `workspaceRoot` 与返回 JSON。

---

## 三、使用 MCP

### 3.1 工具列表

| Tool | 读/写 | 说明 |
|------|-------|------|
| `store_memory` | 写 | 持久化到 `.contora/mcp/memories.json` |
| `search_memory` | 读 | 关键词搜索 MCP 记忆 |
| `get_memory` | 读 | 按 key 读取 |
| `get_workspace_context` | 读 | 扩展写入的 `state.json`（焦点、Git、文件） |
| `get_project_intelligence` | 读 | L5 `intelligence/state-summary.json` |
| `get_intent_graph` | 读 | 完整意图图 |
| `get_active_intents` | 读 | 活跃意图节点摘要 |
| `get_project_state` | 读 | L4 `state-builder/project-state.json` |
| `get_project_snapshot` | 读 | L4 Markdown 快照；`format=json` 可选 |
| `get_state_conflicts` | 读 | v2 未解决冲突（仅审计） |

### 3.2 推荐工作流

**仅 MCP（无 IDE）：**

1. 配置 MCP，`CONTORIUM_WORKSPACE` 指向项目根
2. 启动 Agent — 首次调用会自动 bootstrap `.contora/`
3. 使用 `get_project_snapshot` / `get_workspace_context`

**扩展 + MCP（最佳精度）：**

1. 用扩展打开项目，设置 **Current focus**，正常编码
2. Agent 启用 MCP 读取同一 `.contora/`
3. 决策跨会话用 `store_memory`

**仅 CLI：**

```bash
contorium init . && contorium snapshot .
```

### 3.3 环境变量

| 变量 | 作用 |
|------|------|
| `CONTORIUM_WORKSPACE` | 显式指定工作区根（优先） |
| `CODEX_PROJECT_DIR` | Codex 注入 |
| `CLAUDE_PROJECT_DIR` | Claude Code 注入 |
| `MCP_WORKSPACE_ROOT` | 部分宿主通用 |

未设置时：从 MCP 进程 `cwd` 向上查找 `.contora/state.json`。

### 3.4 与一键复制的关系

| 方式 | 适用场景 |
|------|----------|
| **Copy AI-ready context**（扩展） | 粘贴到任意聊天框，4 层收敛 Markdown |
| **get_project_snapshot**（MCP） | Agent 自动拉取结构化状态 |
| **get_state_conflicts**（MCP） | 仅当需要看 IDE/MCP 决策冲突 |

复制导出不包含完整冲突块与 Intent 图；侧栏与 MCP 可单独查看。

---

## 四、卸载 / 禁用 MCP

### 4.1 Cursor

- **Settings → MCP** → 关闭或删除 `contorium` 条目  
- 或删除项目/用户配置中的 `mcp.json` 对应段

### 4.2 Claude Code

```bash
claude mcp remove contorium
```

若通过 `--plugin-dir` 安装，停止加载该插件目录即可。

### 4.3 Codex

```bash
codex mcp remove contorium
```

### 4.4 Gemini CLI

从 `settings.json` 的 `mcpServers` 中删除 `contorium` 块，重启 CLI。

### 4.5 清除 MCP 记忆数据（可选）

**PowerShell（项目根）：**

```powershell
Remove-Item -Recurse -Force .contora\mcp -ErrorAction SilentlyContinue
```

**macOS / Linux：** `rm -rf .contora/mcp`

不影响 `state.json` 与 State Engine 其他文件。

---

## 五、故障排除

| 现象 | 处理 |
|------|------|
| `found: false` / 无 state.json | 确认 `CONTORIUM_WORKSPACE`；MCP 启动时会 bootstrap；或运行 `contorium init .` |
| MCP 启动失败 | 确认 `npm run compile`；Node 18+；路径为绝对路径 |
| 读到旧状态 | 扩展：Save session state；MCP：等 5s 或改 git/events；CLI：`contorium sync .` |
| Agent 显示 Canceled | 多为 Agent 初始化取消，非 MCP 崩溃；用 Inspector 单独测 |
| `workspaceRoot` 不对 | 设置 `CONTORIUM_WORKSPACE` 为项目根绝对路径 |

---

## 六、构建说明（维护者）

```bash
npm run build:mcp
# 或
npm run compile
```

Entry: `packages/mcp/dist/server.js`  
Launcher: `bin/contorium-mcp-launch.cjs`  
CLI（在 `packages/mcp` 内 install 后）: `contorium-mcp`

---

## 七、相关文档

- [README](../README.md)
- [三端安装 · 使用 · 卸载](./INSTALL.md)
- [IDE 扩展安装与使用](./IDE_EXTENSION.md)
- [CLI](./CLI.md)
- [State Engine](./STATE_ENGINE.md)
