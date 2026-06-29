import { routeQuery, type RoutedQuery } from '../cil/queryRouter.js';
import type { CilIntent } from '../cil/types.js';
import { readLlmConfig } from './config.js';
import { aiGenerate } from './runtime.js';

const VALID_INTENTS: CilIntent[] = [
  'action',
  'decision',
  'direction',
  'history',
  'state',
  'story',
  'debug',
  'time_travel',
  'entity',
];

function isWeakDefaultRoute(routed: RoutedQuery, question: string): boolean {
  if (routed.intent !== 'history') {
    return false;
  }
  const q = question.trim();
  if (!q || q.length < 8) {
    return true;
  }
  return !/what|why|how|when|history|decision|impact|story|focus|next|module|file|project/i.test(q);
}

async function classifyIntentWithLlm(workspaceRoot: string, question: string): Promise<RoutedQuery | null> {
  const prompt = [
    'Classify this project question into exactly one intent label.',
    'Labels: action, decision, direction, history, state, story, debug, time_travel, entity',
    'Reply with JSON only: {"intent":"...","topic":"optional short topic"}',
    '',
    `Question: ${question}`,
  ].join('\n');
  const out = await aiGenerate(workspaceRoot, 'intent_router', prompt, `intent:${question}`, {
    max_tokens: 80,
    temperature: 0,
  });
  if (!out?.text) {
    return null;
  }
  try {
    const jsonMatch = out.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }
    const parsed = JSON.parse(jsonMatch[0]) as { intent?: string; topic?: string };
    const intent = parsed.intent as CilIntent | undefined;
    if (!intent || !VALID_INTENTS.includes(intent)) {
      return null;
    }
    return { intent, topic: parsed.topic?.trim() || undefined, raw: question.trim() };
  } catch {
    return null;
  }
}

/**
 * Hybrid intent router — rule first, optional LLM fallback (优化.md).
 * Fact engines unchanged; only routing may use LLM.
 */
export async function routeIntent(workspaceRoot: string, question: string): Promise<RoutedQuery> {
  const ruled = routeQuery(question);
  const config = await readLlmConfig(workspaceRoot);
  const router = config.intent_router;
  if (!config.enabled || !config.intent_router?.enabled || config.intent_router.mode === 'rule') {
    return ruled;
  }
  if (config.intent_router.mode === 'llm') {
    const llm = await classifyIntentWithLlm(workspaceRoot, question);
    return llm ?? ruled;
  }
  // hybrid
  if (!isWeakDefaultRoute(ruled, question)) {
    return ruled;
  }
  const llm = await classifyIntentWithLlm(workspaceRoot, question);
  return llm ?? ruled;
}

export { routeQuery };
