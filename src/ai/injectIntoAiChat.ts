import * as vscode from 'vscode';
import { CONTORA_CONFIG_SECTION } from '../constants';

export type ExportDelivery = 'chat' | 'clipboard' | 'both';

export type AiChatInjectMethod =
  | 'vscode-chat-open'
  | 'cursor-composer-focus'
  | 'cursor-aichat'
  | 'cursor-new-chat'
  | 'clipboard-only';

export interface AiChatInjectResult {
  ok: boolean;
  method: AiChatInjectMethod;
  injected: boolean;
  copied: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function hasCommand(id: string): Promise<boolean> {
  const cmds = await vscode.commands.getCommands(true);
  return cmds.includes(id);
}

function isCursorHost(): boolean {
  return vscode.env.appName.toLowerCase().includes('cursor');
}

export function readExportDelivery(cfg = vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION)): ExportDelivery {
  const raw = cfg.get<string>('exportDelivery');
  if (raw === 'clipboard' || raw === 'both') {
    return raw;
  }
  return 'chat';
}

async function pasteViaClipboard(text: string, restoreOriginal: boolean): Promise<void> {
  const original = await vscode.env.clipboard.readText();
  await vscode.env.clipboard.writeText(text);
  await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
  if (restoreOriginal) {
    await sleep(80);
    await vscode.env.clipboard.writeText(original);
  }
}

/** Best-effort inject into the focused AI chat (Cursor / VS Code Copilot). */
async function injectIntoCurrentAiChat(text: string): Promise<AiChatInjectResult> {
  if (!isCursorHost() && (await hasCommand('workbench.action.chat.open'))) {
    try {
      await vscode.commands.executeCommand('workbench.action.chat.open', { query: text });
      return { ok: true, method: 'vscode-chat-open', injected: true, copied: false };
    } catch {
      /* fall through */
    }
  }

  if (isCursorHost()) {
    if (await hasCommand('composer.focusComposer')) {
      try {
        await vscode.commands.executeCommand('composer.focusComposer');
        await sleep(250);
        await pasteViaClipboard(text, true);
        return { ok: true, method: 'cursor-composer-focus', injected: true, copied: false };
      } catch {
        /* fall through */
      }
    }

    if (await hasCommand('aichat.show-ai-chat')) {
      try {
        await vscode.commands.executeCommand('aichat.show-ai-chat');
        await sleep(450);
        await pasteViaClipboard(text, true);
        return { ok: true, method: 'cursor-aichat', injected: true, copied: false };
      } catch {
        /* fall through */
      }
    }

    if (await hasCommand('workbench.action.chat.open')) {
      try {
        await vscode.commands.executeCommand('workbench.action.chat.open', { query: text });
        return { ok: true, method: 'vscode-chat-open', injected: true, copied: false };
      } catch {
        /* fall through */
      }
    }

    if (await hasCommand('composer.newAgentChat')) {
      try {
        await vscode.commands.executeCommand('composer.newAgentChat');
        await sleep(200);
        await pasteViaClipboard(text, true);
        return { ok: true, method: 'cursor-new-chat', injected: true, copied: false };
      } catch {
        /* fall through */
      }
    }
  }

  return { ok: false, method: 'clipboard-only', injected: false, copied: false };
}

export async function deliverExportText(text: string, delivery: ExportDelivery): Promise<AiChatInjectResult> {
  const wantChat = delivery === 'chat' || delivery === 'both';
  const wantClipboard = delivery === 'clipboard' || delivery === 'both';

  if (wantChat) {
    const injectResult = await injectIntoCurrentAiChat(text);
    if (injectResult.injected) {
      if (wantClipboard) {
        await vscode.env.clipboard.writeText(text);
      }
      return { ...injectResult, copied: wantClipboard };
    }
  }

  await vscode.env.clipboard.writeText(text);
  return { ok: true, method: 'clipboard-only', injected: false, copied: true };
}

export function formatExportDeliveryMessage(
  result: AiChatInjectResult,
  tok: number,
  fmtLabel: string,
  budgetNote: string,
): string {
  const base = `~${tok} tokens, ${fmtLabel}${budgetNote}`;
  if (result.injected && result.copied) {
    return `Injected into AI chat and copied (${base})`;
  }
  if (result.injected) {
    return `Injected into AI chat (${base}) — press Enter to send`;
  }
  return `Copied to clipboard (${base}) — paste into chat (Ctrl+V)`;
}
