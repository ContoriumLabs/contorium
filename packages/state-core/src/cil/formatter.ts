import type {
  AskProjectResult,
  CilStructuredResponse,
  KernelOutput,
  NextActionItem,
} from './types.js';

export function buildStructuredResponse(output: KernelOutput): CilStructuredResponse {
  const result = output.result as Record<string, unknown> | undefined;
  const facts: string[] = [];
  const insights: string[] = [];
  const actions: NextActionItem[] = [];

  if (typeof result?.answer === 'string') {
    facts.push(String(result.answer));
  }
  if (Array.isArray(result?.events)) {
    for (const e of result.events as Array<{ title?: string; timestamp?: string }>) {
      if (e.title) {
        facts.push(`${e.timestamp?.slice(0, 10) ?? ''}: ${e.title}`.trim());
      }
    }
  }
  if (result?.decision || result?.why) {
    insights.push(String(result.why ?? result.decision ?? ''));
  }
  if (Array.isArray(result?.next_actions)) {
    actions.push(...(result.next_actions as NextActionItem[]));
  }
  if (output.intent === 'action' && Array.isArray(result?.items)) {
    actions.push(...(result.items as NextActionItem[]));
  }

  return { fact: facts.slice(0, 12), insight: insights.slice(0, 8), actions: actions.slice(0, 8) };
}

export function kernelOutputToAskResult(query: string, output: KernelOutput): AskProjectResult {
  const result = output.result as Record<string, unknown> | undefined;
  const answer =
    (typeof result?.answer === 'string' && result.answer) ||
    (typeof result?.summary === 'string' && result.summary) ||
    output.intent;

  return {
    question: query,
    intent: output.intent,
    answer,
    data: result,
    structured: buildStructuredResponse(output),
    trace: output.trace,
  };
}
