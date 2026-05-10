/**
 * 持久化到 `.context-recall/state.json` 的项目会话状态。
 * 与文档中的 ProjectState 对齐，并扩展 openFiles / gitModified 以覆盖功能 1、2。
 */
export interface ProjectState {
  /** 当前任务描述（用户可编辑） */
  currentTask: string;
  /** 当前在编辑器标签中打开的工作区相对路径 */
  openFiles: string[];
  /** Working Set：最近活跃 / 编辑过的文件（工作区相对路径，新在前） */
  recentFiles: string[];
  /** Git 工作区变更文件（相对路径），由 simple-git 真实读取 */
  gitModified: string[];
  /** 笔记 */
  notes: string;
  lastUpdated: number;
}

export function defaultProjectState(): ProjectState {
  return {
    currentTask: '',
    openFiles: [],
    recentFiles: [],
    gitModified: [],
    notes: '',
    lastUpdated: 0,
  };
}
