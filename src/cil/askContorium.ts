import * as vscode from 'vscode';
import type { AskProjectResult } from '@contora/state-core';
import { withIdeCilAiContext } from '../ai/cilLlmBridge';

function formatAskResult(result: AskProjectResult): string {
  const lines = [`# Ask Contorium`, '', `**Question:** ${result.question}`, '', result.answer, ''];

  if (result.structured) {
    if (result.structured.fact.length) {
      lines.push('## Facts', ...result.structured.fact.map((f) => `- ${f}`), '');
    }
    if (result.structured.insight.length) {
      lines.push('## Insights', ...result.structured.insight.map((i) => `- ${i}`), '');
    }
    if (result.structured.actions.length) {
      lines.push(
        '## Suggested Actions (non-executable)',
        ...result.structured.actions.map(
          (a) => `- ${a.task} — ${a.reason} [confidence ${a.confidence}]`,
        ),
        '',
      );
    }
  }

  const data = result.data;
  if (data?.decision || data?.why) {
    lines.push('## Decision', String(data.decision ?? ''), '', '**Reason:**', String(data.why ?? ''), '');
    if (data.date) {
      lines.push(`**Date:** ${String(data.date)}`, '');
    }
  }
  if (Array.isArray(data?.next_actions)) {
    lines.push('## Next Actions', ...(data.next_actions as Array<{ task: string; reason: string }>).map(
      (a) => `- ${a.task} — ${a.reason}`,
    ), '');
  }
  if (typeof data?.formatted === 'string') {
    lines.push(data.formatted);
  }
  return lines.join('\n');
}

export async function runAskContoriumWithQuery(question: string): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    void vscode.window.showWarningMessage('Open a folder workspace to use Ask Contorium.');
    return;
  }
  const root = folder.uri.fsPath;
  const q = question.trim();
  if (!q) {
    return;
  }
  try {
    const { askProject, syncCognitiveInteractionLayer } = await import('@contora/state-core');
    await withIdeCilAiContext(root, async () => {
      await syncCognitiveInteractionLayer(root, 'ide');
      const result = await askProject(root, q);
      const doc = await vscode.workspace.openTextDocument({
        content: formatAskResult(result),
        language: 'markdown',
      });
      await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
    });
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Ask Contorium failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function runAskContorium(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    void vscode.window.showWarningMessage('Open a folder workspace to use Ask Contorium.');
    return;
  }

  const root = folder.uri.fsPath;
  let question = '';

  try {
    const { buildSuggestedQuestions, syncCognitiveInteractionLayer, askProject } =
      await import('@contora/state-core');

    await withIdeCilAiContext(root, async () => {
      await syncCognitiveInteractionLayer(root, 'ide');
      const suggested = await buildSuggestedQuestions(root);

      if (suggested.questions.length) {
        const pick = await vscode.window.showQuickPick(
          [...suggested.questions, '$(edit) Type a custom question…'],
          {
            title: 'Ask Contorium',
            placeHolder: 'Suggested questions — or type your own',
          },
        );
        if (!pick) {
          return;
        }
        if (pick.startsWith('$(edit)')) {
          question =
            (await vscode.window.showInputBox({
              title: 'Ask Contorium',
              prompt: 'Ask about project history, decisions, impact, or next steps',
              placeHolder: 'Why was MCP added?',
            })) ?? '';
        } else {
          question = pick;
        }
      } else {
        question =
          (await vscode.window.showInputBox({
            title: 'Ask Contorium',
            prompt: 'Ask about project history, decisions, impact, or next steps',
            placeHolder: 'Why was MCP added?',
          })) ?? '';
      }

      if (!question.trim()) {
        return;
      }

      const result = await askProject(root, question.trim());
      const doc = await vscode.workspace.openTextDocument({
        content: formatAskResult(result),
        language: 'markdown',
      });
      await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
    });
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Ask Contorium failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
