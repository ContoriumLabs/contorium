import * as path from 'node:path';
import { readChangeArtifact, readHandoffArtifact, readStateJson } from '@contora/state-core';

export interface WorkspaceContext {
  workspaceRoot: string;
  currentTask: string;
  recentFiles: string[];
  changedFiles: string[];
  keyChangeSymbols: string[];
  focusHint: string;
  projectType: string;
  fileTypes: string[];
  paths: string[];
}

function inferProjectType(files: string[]): string {
  const joined = files.join(' ').toLowerCase();
  if (/packages\/mcp|mcp\.|\/mcp\//.test(joined)) {
    return 'mcp';
  }
  if (/extension|vscode|sidebar/.test(joined)) {
    return 'ide-extension';
  }
  if (/landing|\.html|\.css/.test(joined)) {
    return 'frontend';
  }
  if (/test|spec|__tests__/.test(joined)) {
    return 'testing';
  }
  if (/docker|ci|\.github/.test(joined)) {
    return 'devops';
  }
  if (/auth|jwt|login|session/.test(joined)) {
    return 'auth';
  }
  return 'backend';
}

function extOf(file: string): string {
  return path.extname(file).toLowerCase();
}

export async function buildWorkspaceContext(workspaceRoot: string): Promise<WorkspaceContext> {
  const root = path.resolve(workspaceRoot);
  const [state, change, handoff] = await Promise.all([
    readStateJson(root),
    readChangeArtifact(root),
    readHandoffArtifact(root),
  ]);

  const recentFiles = state?.recentFiles ?? [];
  const changedFiles = change?.changed_files ?? [];
  const allPaths = [...new Set([...recentFiles, ...changedFiles])];
  const fileTypes = [...new Set(allPaths.map(extOf).filter(Boolean))];
  const keyChangeSymbols = (change?.key_changes ?? handoff?.key_changes ?? [])
    .slice(0, 16)
    .map((k) => k.symbol);

  return {
    workspaceRoot: root,
    currentTask: state?.currentTask ?? handoff?.goal ?? '',
    recentFiles: recentFiles.slice(0, 20),
    changedFiles: changedFiles.slice(0, 20),
    keyChangeSymbols,
    focusHint: handoff?.current_focus ?? '',
    projectType: inferProjectType(allPaths),
    fileTypes,
    paths: allPaths,
  };
}
