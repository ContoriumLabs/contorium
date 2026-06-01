# Contorium CLI

CLI 是与 **IDE、MCP 平级**的 Runtime Adapter，共用 `@contora/state-core`，读写同一 `.contora/`。  
三端总览：[INSTALL.md](./INSTALL.md) · [README](../README.md#安装--使用--卸载三端)。

---

## 命令速查

| 阶段 | 命令 |
|------|------|
| **安装** | `npm install && npm run compile`（在 contorium 仓库根） |
| **验证** | `npx contorium status .` 或 `npx contorium --help` |
| **全局命令（可选）** | 仓库根 `npm link` → 任意目录 `contorium status .` |
| **初始化** | `npx contorium init [path]` |
| **刷新状态** | `npx contorium sync [path]` |
| **读 snapshot** | `npx contorium snapshot [path]` |
| **读摘要** | `npx contorium status [path]` |
| **读 state.json** | `npx contorium state [path]` |
| **卸载** | `npm unlink -g contorium`（若曾 link）；无后台进程 |
| **清除数据（可选）** | 项目根 `Remove-Item -Recurse -Force .contora`（PowerShell） |

默认 `[path]` 为当前目录。

---

## 一、安装

### 从源码（与 MCP 同一仓库）

```bash
git clone https://github.com/ContoriumLabs/contorium.git
cd contorium
npm install
npm run compile
```

验证：

```powershell
npx contorium status .
# 或
npx contorium init .
```

### 全局命令（可选）

在 **contorium 仓库根目录**：

```bash
npm link
```

之后在任意目录：

```bash
contorium status E:\path\to\your-project
```

---

## 二、使用

| 命令 | 作用 |
|------|------|
| `contorium init [path]` | 创建或合并 `state.json`，生成 L4 snapshot |
| `contorium sync [path]` | 重新扫描 git + 最近文件并合并 |
| `contorium snapshot [path]` | 输出 `PROJECT SNAPSHOT` markdown |
| `contorium status [path]` | JSON 摘要（mode、source、git 计数、eventCount） |
| `contorium state [path]` | 打印完整 `state.json` |

**PowerShell 示例：**

```powershell
cd E:\your-project
npx contorium init .
npx contorium sync .
npx contorium snapshot . | Out-File -Encoding utf8 .contora\snapshot-export.md
npx contorium status .
npx contorium state .
```

**bash 示例：**

```bash
cd /path/to/project
npx contorium init .
npx contorium sync .
npx contorium snapshot . > .contora/snapshot-export.md
npx contorium status .
npx contorium state .
```

写入时标记 `state.json` → `source.lastWriter: "cli"`。

### 与 IDE / MCP 的关系

- **不依赖** IDE 扩展或 MCP 进程
- 与 IDE 同时使用时：IDE 写 events；CLI `sync` 只补 git/路径，**不覆盖** `currentTask` / `notes`
- 与 MCP 同时使用时：共用 `syncWorkspaceState()`，逻辑一致

---

## 三、卸载

CLI 无常驻服务：

1. 若执行过 `npm link`：`npm unlink -g contorium`
2. 不再调用 `contorium` 即可；**不会**删除 `.contora/`

清除工作区数据（三端共用，可选）：

```powershell
Remove-Item -Recurse -Force .contora
```

---

## 四、故障排除

| 现象 | 处理 |
|------|------|
| `command not found: contorium` | 仓库根 `npm run compile` 后用 `npx contorium` |
| `init` 显示 `created: false` | **正常** — 已有 state；看 `updated` 与 `source` |
| `snapshot` 内容偏泛 | 无 IDE events 时为 scan 推断；装扩展编码后会更准 |
| `state: no state.json` | 先 `npx contorium init .` |

---

## 五、相关文档

- [README](../README.md)
- [三端安装总览](./INSTALL.md)
- [IDE 扩展](./IDE_EXTENSION.md)
- [MCP Server](./MCP.md)
- [Architecture v2.2](./ARCHITECTURE_V2_2.md)
