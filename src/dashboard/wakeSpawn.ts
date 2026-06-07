import { spawn } from 'node:child_process';
import * as path from 'node:path';
import type * as vscode from 'vscode';

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let bootstrapDoneFor = '';

function resolveCli(context: vscode.ExtensionContext): string {
  return path.join(context.extensionPath, 'packages', 'cli', 'bin', 'contorium.cjs');
}

/** CRBP §2.1 — IDE workspace open → bootstrap runtime (once per root). */
export function scheduleRuntimeBootstrap(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
): void {
  const root = path.resolve(workspaceRoot);
  if (bootstrapDoneFor === root) {
    return;
  }
  bootstrapDoneFor = root;
  const cli = resolveCli(context);
  spawn(process.execPath, [cli, 'bootstrap', root, '--source', 'ide'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref();
}

/** Debounced activity wake (file/function changes after bootstrap). */
export function scheduleDashboardWake(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  detail?: string,
): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined;
    const cli = resolveCli(context);
    const args = [cli, 'dashboard', 'wake', workspaceRoot, '--source', 'ide'];
    if (detail) {
      args.push('--detail', detail);
    }
    spawn(process.execPath, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
  }, 350);
}
