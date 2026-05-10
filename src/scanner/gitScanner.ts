import simpleGit, { SimpleGit } from 'simple-git';
import * as vscode from 'vscode';

/**
 * 使用 simple-git 读取真实 Git 状态，提取已修改 / 未跟踪等工作区变更文件的相对路径。
 */
export async function scanGitModified(workspaceRoot: string): Promise<string[]> {
  let git: SimpleGit;
  try {
    git = simpleGit(workspaceRoot);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return [];
    }
  } catch {
    return [];
  }

  try {
    const status = await git.status();
    const set = new Set<string>();
    for (const p of status.staged) {
      set.add(p.replace(/\\/g, '/'));
    }
    for (const p of status.modified) {
      set.add(p.replace(/\\/g, '/'));
    }
    for (const p of status.not_added) {
      set.add(p.replace(/\\/g, '/'));
    }
    for (const p of status.created) {
      set.add(p.replace(/\\/g, '/'));
    }
    for (const p of status.deleted) {
      set.add(p.replace(/\\/g, '/'));
    }
    for (const p of status.renamed) {
      if (p.to) {
        set.add(p.to.replace(/\\/g, '/'));
      }
    }
    for (const p of status.conflicted) {
      set.add(p.replace(/\\/g, '/'));
    }
    return [...set];
  } catch {
    return [];
  }
}

export function getWorkspaceRootPath(folder: vscode.WorkspaceFolder): string {
  return folder.uri.fsPath;
}
