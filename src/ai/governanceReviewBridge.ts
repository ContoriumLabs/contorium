import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  buildGovernanceReviewArtifact,
  buildGovernanceRulesLines,
  estimateGovernanceTokens,
  buildGovernanceExportAppendixFull,
  mergeReviewArtifacts,
  readGovernanceReview,
  reviewGitCommitChanges,
  reviewGitStagedChanges,
  reviewOpenFilesChanges,
  writeGovernanceReview,
  type GovernanceReviewArtifact,
  type ReviewScopePreference,
  type ScopedFileReviewInput,
} from '@contora/state-core';
import { CONTORA_CONFIG_SECTION } from '../constants';
import { ideControlCheckActiveFile, buildEditorChangeContext } from '../control/controlBridge';

export type { ReviewScopePreference, ScopedFileReviewInput };

export function readGovernanceReviewScope(
  cfg = vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION),
): ReviewScopePreference {
  const raw = cfg.get<string>('governanceReviewScope');
  if (
    raw === 'current_file' ||
    raw === 'open_files' ||
    raw === 'git_staged' ||
    raw === 'git_commit'
  ) {
    return raw;
  }
  return 'auto';
}

export function activeRelativeFile(): string | undefined {
  const doc = vscode.window.activeTextEditor?.document;
  if (!doc || doc.uri.scheme !== 'file') {
    return undefined;
  }
  return vscode.workspace.asRelativePath(doc.uri, false).replace(/\\/g, '/');
}

export function collectOpenFileReviewInputs(folder: vscode.WorkspaceFolder): ScopedFileReviewInput[] {
  const root = path.normalize(folder.uri.fsPath);
  const out: ScopedFileReviewInput[] = [];
  const seen = new Set<string>();

  for (const doc of vscode.workspace.textDocuments) {
    if (doc.uri.scheme !== 'file') {
      continue;
    }
    const fsPath = path.normalize(doc.uri.fsPath);
    const relToRoot = path.relative(root, fsPath);
    if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
      continue;
    }
    const rel = vscode.workspace.asRelativePath(doc.uri, false).replace(/\\/g, '/');
    if (seen.has(rel)) {
      continue;
    }
    seen.add(rel);
    const editor = vscode.window.visibleTextEditors.find(
      (e) => e.document.uri.toString() === doc.uri.toString(),
    );
    const changeCtx = editor ? buildEditorChangeContext(editor) : undefined;
    out.push({
      relativePath: rel,
      diff_text: changeCtx?.diff_text,
      lines_added: changeCtx?.lines_added,
      lines_removed: changeCtx?.lines_removed,
    });
  }
  return out;
}

async function reviewCurrentFileArtifact(
  folder: vscode.WorkspaceFolder,
  editor?: vscode.TextEditor,
): Promise<GovernanceReviewArtifact | null> {
  const ed = editor ?? vscode.window.activeTextEditor;
  const doc = ed?.document;
  if (!doc || doc.uri.scheme !== 'file') {
    return null;
  }
  const rel = vscode.workspace.asRelativePath(doc.uri, false).replace(/\\/g, '/');
  const changeCtx = ed ? buildEditorChangeContext(ed) : undefined;
  const result = await ideControlCheckActiveFile(folder, ed, changeCtx);
  if (result.loop !== 'check') {
    return null;
  }
  return buildGovernanceReviewArtifact(result, rel, {
    reviewSource: changeCtx ? 'editor_diff' : 'static_file',
    reviewScope: 'current_file',
  });
}

export async function runAndPersistGovernanceReview(
  folder: vscode.WorkspaceFolder,
  editor?: vscode.TextEditor,
  opts?: { scope?: ReviewScopePreference },
): Promise<GovernanceReviewArtifact | null> {
  const root = folder.uri.fsPath;
  const scope = opts?.scope ?? readGovernanceReviewScope();

  let final: GovernanceReviewArtifact | null = null;

  if (scope === 'auto') {
    const [current, openFiles, staged, commit] = await Promise.all([
      reviewCurrentFileArtifact(folder, editor),
      reviewOpenFilesChanges(root, collectOpenFileReviewInputs(folder)),
      reviewGitStagedChanges(root),
      reviewGitCommitChanges(root),
    ]);
    final = mergeReviewArtifacts([current, openFiles, staged, commit]);
  } else if (scope === 'current_file') {
    final = await reviewCurrentFileArtifact(folder, editor);
  } else if (scope === 'open_files') {
    final = await reviewOpenFilesChanges(root, collectOpenFileReviewInputs(folder));
  } else if (scope === 'git_staged') {
    final = await reviewGitStagedChanges(root);
  } else if (scope === 'git_commit') {
    final = await reviewGitCommitChanges(root);
  }

  if (!final) {
    return readGovernanceReview(root);
  }

  await writeGovernanceReview(root, final);
  return final;
}

export async function buildGovernanceExportAppendix(
  folder: vscode.WorkspaceFolder,
  review: GovernanceReviewArtifact | null,
): Promise<string> {
  return buildGovernanceExportAppendixFull(folder.uri.fsPath, review);
}

export async function estimateGovernanceInjectionTokens(
  workspaceRoot: string,
  activeFile?: string,
  review?: GovernanceReviewArtifact | null,
): Promise<number> {
  const rules = await buildGovernanceRulesLines(workspaceRoot, activeFile);
  const block = await buildGovernanceExportAppendixFull(workspaceRoot, review ?? null);
  return estimateGovernanceTokens(`${rules.join('\n')}\n${block}`);
}
