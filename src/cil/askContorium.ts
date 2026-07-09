import * as vscode from 'vscode';
import type { AskProjectResult } from '@contora/state-core';
import { withIdeCilAiContext } from '../ai/cilLlmBridge';

function formatSemanticSection(result: AskProjectResult): string {
  if (result.intent !== 'direction') {
    return '';
  }
  const sem = result.semantic;
  if (!sem) {
    return '';
  }
  const lines = [
    '## Project direction (PIK)',
    '',
    `**Primary intent:** ${sem.primary_intent}`,
    `**Alignment:** ${Math.round(sem.alignment_score * 100)}%`,
    `**Drift:** ${sem.drift.severity} (${sem.drift.drift_type}) — ${sem.drift.explanation}`,
    '',
  ];
  if (sem.recommended_next_focus.length) {
    lines.push(
      '**Goal-aligned focus:**',
      ...sem.recommended_next_focus.map((t: string) => `- ${t}`),
      '',
    );
  }
  lines.push(`_PIK source: \`${sem.pik_source}\` · \`.contora/intent/kernel.json\`_`, '');
  return lines.join('\n');
}

function appendFormattedBlocks(
  lines: string[],
  data: Record<string, unknown> | undefined,
  intent?: string,
): void {
  if (!data) {
    return;
  }
  const fmt = data.formatted;
  const answerAlreadyHasHistory =
    intent === 'history' && lines.some((l) => l.includes('Project History') || l.includes('cognitive event'));
  if (typeof fmt === 'string' && fmt.trim()) {
    if (!answerAlreadyHasHistory) {
      lines.push(fmt.trim(), '');
    }
  } else if (Array.isArray(fmt) && fmt.length && !answerAlreadyHasHistory) {
    lines.push(
      ...fmt
        .map(String)
        .filter((line) => !isContoraPathLine(line.trim())),
      '',
    );
  }
  const health = data.health as { formatted?: string[]; score?: number } | undefined;
  if (health?.formatted?.length) {
    lines.push('## Cognitive Health', ...health.formatted.map(String), '');
  }
  const knowledgeHealth = data.knowledge_health as { formatted?: string[]; score?: number } | undefined;
  if (knowledgeHealth?.formatted?.length) {
    lines.push('## Knowledge Health (Lifecycle)', ...knowledgeHealth.formatted.map(String), '');
  }
  const reviewQueue = data.review_queue as Array<{ title: string; reason: string; detail: string }> | undefined;
  if (reviewQueue?.length) {
    lines.push(
      '## Review Queue',
      ...reviewQueue.slice(0, 12).map((item) => `- **${item.title}** (${item.reason}) — ${item.detail}`),
      '',
    );
  }
  const lifecycle = data.lifecycle as { confidence?: { overall?: number } } | undefined;
  if (lifecycle && !lines.some((l) => l.includes('Knowledge trust'))) {
    /* lifecycle block rendered via answer for decision intent */
  }
}

function stripContoraPathsFromText(text: string): string {
  return text
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return true;
      }
      if (isContoraPathLine(trimmed)) {
        return false;
      }
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

function isContoraPathLine(line: string): boolean {
  const t = line.replace(/^\s{2}/, '').trim();
  return t.startsWith('.contora/') || t === '.contora';
}

function formatAskDataSources(result: AskProjectResult): string {
  const engineSources: Record<string, string> = {
    kernel: 'Cognitive Kernel (orchestrator)',
    pik: 'Project Intent Kernel (direction & goals)',
    semantic_fusion: 'PIK + state + handoff + intents + events + ADRs → alignment & drift',
    ask_v2: 'Ask v2 — direction queries prioritize PIK over event logs',
    query_router: 'Rule router — optional LLM intent when `contora.cilAiEnabled`',
    event_engine: 'Cognitive events — synced from timeline, git changes, decisions, focus',
    decision_engine: 'ADR records + decision provenance graph',
    action_engine: 'Focus, handoff, intent graph, events, ADRs, impact graph',
    state_engine: 'Workspace state + intent graph',
    narrative_layer: 'Transfer story / project narrative (rule-built)',
    snapshot_engine: 'Project snapshots & time travel',
    lifecycle: 'Decision freshness, trust, review queue',
    knowledge_graph: 'Entity knowledge links',
    module_projection: 'Per-module event history',
    handoff_replay: 'Handoff replay stages',
    journey_builder: 'Project journey stages (events + decisions)',
    impact_engine: 'Impact / blast-radius graph',
    ai_layer: 'LLM polish only — does not invent facts',
  };

  const lines = ['## Data sources', ''];
  lines.push(`**Routed intent:** \`${result.intent}\``, '');

  if (result.trace?.length) {
    lines.push('**Engines used:**');
    const seen = new Set<string>();
    for (const step of result.trace) {
      const key = `${step.engine}:${step.phase}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const desc = engineSources[step.engine] ?? 'Local project intelligence store';
      lines.push(`- \`${step.engine}\` / ${step.phase} — ${desc}`);
    }
    lines.push('');
  }

  const data = result.data as Record<string, unknown> | undefined;
  if (data?.llm_enhanced) {
    lines.push('*Answer text was LLM-enhanced from the rule-based facts above.*', '');
  } else {
    lines.push('*Primary answer is rule-based from workspace artifacts (no LLM rewrite).*', '');
  }

  lines.push('*Primary answer is rule-based from workspace intelligence (no LLM rewrite).*');
  return lines.join('\n');
}

function formatAskResult(result: AskProjectResult): string {
  const answer = stripContoraPathsFromText(result.answer);
  const lines = [`# Ask Contorium`, '', `**Question:** ${result.question}`, '', answer, ''];

  const semanticBlock = formatSemanticSection(result);
  if (semanticBlock) {
    lines.push(semanticBlock);
  }

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

  const data = result.data as Record<string, unknown> | undefined;
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
  appendFormattedBlocks(lines, data, result.intent);

  lines.push(stripContoraPathsFromText(formatAskDataSources(result)));
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
      await syncCognitiveInteractionLayer(root, 'ide').catch((syncErr) => {
        console.warn('[Contorium] CIL sync before ask (non-fatal):', syncErr);
      });
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
      await syncCognitiveInteractionLayer(root, 'ide').catch((syncErr) => {
        console.warn('[Contorium] CIL sync before ask (non-fatal):', syncErr);
      });
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
              prompt: 'History · Decisions · Story · Health · MCP · Next steps',
              placeHolder: 'e.g. What happened? · What is MCP? · Is the project healthy?',
            })) ?? '';
        } else {
          question = pick;
        }
      } else {
        question =
          (await vscode.window.showInputBox({
            title: 'Ask Contorium',
            prompt: 'History · Decisions · Story · Health · MCP · Next steps',
            placeHolder: 'e.g. What happened? · What is MCP? · Is the project healthy?',
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
