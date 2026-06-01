# Contorium IDE 扩展（VS Code / Cursor）

扩展 ID：`franklee-dev.contorium`  
显示名称：**Contorium**  
最低要求：VS Code / Cursor **1.85+**，**文件夹工作区**（单文件窗口功能受限）

扩展负责：侧栏 UI、文件/Git 扫描、`.contora/state.json`、State Engine 衍生文件、**一键复制 AI-ready context**。  
与 [MCP](./MCP.md)、[CLI](./CLI.md) **平级**；三端总览见 [INSTALL.md](./INSTALL.md) · [README](../README.md#安装--使用--卸载三端)。

---

## 命令速查

| 阶段 | 操作 |
|------|------|
| **安装（VSIX）** | `npm run vsix` → 扩展 **从 VSIX 安装** → **Developer: Reload Window** |
| **安装（开发）** | `npm install && npm run compile` → **F5** → 新窗口打开项目文件夹 |
| **验证** | 活动栏 **Contorium** → 侧栏有 Current focus / Copy 按钮 |
| **日常使用** | 侧栏 **Copy AI-ready context**；`Ctrl+Shift+P` → `Contorium:` 命令 |
| **卸载扩展** | 扩展 → Contorium → **卸载** → Reload |
| **清除数据（可选）** | 项目根：`Remove-Item -Recurse -Force .contora`（PowerShell） |

---

## 一、安装

### 方式 A：从 VSIX 安装（推荐）

适用于已发布包或本地打包。

1. 获取 `contorium-0.7.0.vsix`：
   - [GitHub Releases](https://github.com/ContoriumLabs/contorium/releases)，或
   - 在仓库根目录执行：`npm run vsix`（需 Node.js 18+）
2. 打开 **VS Code** 或 **Cursor**
3. **扩展** → `…` → **从 VSIX 安装…**（Install from VSIX…）
4. 选择 `.vsix` 文件
5. 执行 **Developer: Reload Window**（重新加载窗口）

### 方式 B：从源码运行（开发）

```bash
git clone https://github.com/ContoriumLabs/contorium.git
cd contorium
npm install
npm run compile
```

在 VS Code/Cursor 中打开该文件夹 → **F5**（Run Extension）→ 会打开 **Extension Development Host** 新窗口，在新窗口里打开你的项目文件夹。

### 方式 C：市场安装（若已上架）

在扩展市场搜索 **Contorium**，发布者 **franklee-dev**，安装后 Reload Window。

---

## 二、验证安装

1. 活动栏出现 **Contorium** 图标（与扩展图标一致）
2. 用 **文件 → 打开文件夹** 打开一个项目（不要只用单文件）
3. 点击 Contorium 侧栏，应看到：
   - Current focus 输入框
   - **Copy AI-ready context** 按钮
   - Workspace snapshot / Git 等区域

若侧栏一直空白：见下文 [故障排除](#五故障排除)。

---

## 三、使用

### 3.1 侧栏（主界面）

| 操作 | 说明 |
|------|------|
| **Current focus** | L0 任务锚点，写入 `state.json`，不参与自动推断 |
| **Context notes** | 本地备注，会进入导出 |
| **Copy AI-ready context** | 复制收敛后的 4 层上下文到剪贴板 |
| **Sync state to disk** | 立即保存 `state.json` |
| **Restore editors** | 按上次保存状态重新打开编辑器 |
| **Project state** | L4 快照预览（完整内容用复制按钮） |
| **State conflicts** | 有未解决冲突时显示（v2 审计，不自动裁决） |
| **Intent graph** | L5 弱推断预览，不进主复制内容 |

### 3.2 命令面板

`Ctrl+Shift+P`（macOS：`Cmd+Shift+P`），搜索 **Contorium**：

| 命令 | 作用 |
|------|------|
| Copy AI-ready context (clipboard) | 一键导出 |
| Save session state now | 立即持久化 |
| Restore editors from saved state | 恢复编辑器 |
| Configure API key… (BYOK) | 可选云模型密钥 |
| Observe workspace (AI summary) | BYOK 工作区摘要 |
| Learn workspace intent (AI) | BYOK 意图学习 |
| Tighten context preview (AI) | BYOK 压缩预览 |
| Start fresh AI context session | 清空会话事件 + 认知衍生文件 |

### 3.3 一键复制内容结构（v2.1）

```text
# TASK ANCHOR
# PROJECT SNAPSHOT      （纯净项目状态）
# WORKING CONTEXT       （活跃文件 + 近期工作）
# INSIGHTS              （最多 3 条弱提示，可选）
# NOTES / INSTRUCTION   （若有）
```

### 3.4 本地数据位置

所有数据在项目内，**默认不上传云端**：

```text
.contora/
├── state.json                 # 运行时状态（焦点、文件、Git、备注）
├── events/<sessionId>.jsonl   # 事件日志（可配置关闭）
├── intelligence/              # L5 语义摘要
├── intent-graph/              # L5 意图图
├── state-builder/             # L4 项目状态 + snapshot.md
├── state-engine/              # v2 冲突审计
└── mcp/                       # MCP store_memory 写入（若使用 MCP）
```

可将 `.contora/` 加入 `.gitignore`（仓库已提供示例）。

### 3.5 与 MCP / CLI 配合（可选）

三端**平级**：扩展不是 MCP/CLI 的前置条件。

| 场景 | 说明 |
|------|------|
| 仅扩展 | 侧栏 + 一键复制，足够日常 |
| 扩展 + MCP | 扩展写 events；Agent 用 MCP 读 snapshot |
| 无扩展 | MCP 或 `contorium init` 可独立 bootstrap |

同一项目内共用 `.contora/`。详见 [INSTALL.md](./INSTALL.md)。

---

## 四、卸载

### 4.1 卸载扩展（保留项目数据）

**图形界面：**

1. **扩展** → 搜索 **Contorium**
2. **卸载**（Uninstall）
3. **Developer: Reload Window**

**手动删除（扩展损坏或无法卸载时）：**

Windows PowerShell：

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.cursor\extensions\franklee-dev.contorium-*" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:USERPROFILE\.vscode\extensions\franklee-dev.contorium-*" -ErrorAction SilentlyContinue
```

macOS / Linux：

```bash
rm -rf ~/.cursor/extensions/franklee-dev.contorium-*
rm -rf ~/.vscode/extensions/franklee-dev.contorium-*
```

然后重启 IDE。

### 4.2 清除工作区 Contorium 数据（可选）

卸载扩展**不会**自动删除项目里的 `.contora/`。若需彻底移除：

**PowerShell（项目根目录）：**

```powershell
Remove-Item -Recurse -Force .contora -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .context-recall -ErrorAction SilentlyContinue
```

**macOS / Linux：**

```bash
rm -rf .contora .context-recall
```

### 4.3 清除 BYOK 密钥（可选）

扩展使用 VS Code **SecretStorage** 存 API Key，卸载扩展后通常仍保留。若要删除：

- 命令面板 → **Preferences: Open User Settings (JSON)** 不存放密钥；密钥在系统密钥链/凭据管理器中，随扩展卸载可能仍残留，视 IDE 实现而定。
- 或在扩展仍安装时使用 **Configure API key** 覆盖为空操作（视版本行为）。

---

## 五、故障排除

| 现象 | 处理 |
|------|------|
| 侧栏一直加载/空白 | 多为 **`@contora/state-core` 未正确安装**（ESM/CJS 不兼容）：仓库根目录 `npm run compile` → **Reload Window**；F5 开发前先 compile；VSIX 需 `npm run vsix` 重装。查看 **Output → Extension Host** 搜 `state-core` |
| Cursor 提示 installation corrupt | 多为 Cursor 本体或扩展目录损坏：按 [四、卸载](#四卸载) 手动删扩展目录后重装 VSIX；必要时重装 Cursor |
| 复制内容为空或很旧 | 先编辑/保存几个文件，等约 7s 或执行 **Save session state now** 后再复制 |
| `.contora` 不出现 | 需先打开文件夹并触发一次保存或 **Sync state to disk** |
| VSIX 安装失败 | 确认 `npm run vsix` 成功；包约 350–400KB；不要用损坏的 symlink 旧包 |

**查看日志：** `Ctrl+Shift+P` → **Developer: Show Logs** → **Extension Host**，过滤 `Contorium` 或 `contorium`。

---

## 六、相关文档

- [README](../README.md)
- [三端安装 · 使用 · 卸载](./INSTALL.md)
- [MCP 安装与使用](./MCP.md)
- [CLI](./CLI.md)
- [State Engine 架构](./STATE_ENGINE.md)
- [Runtime 包说明](./RUNTIME.md)
