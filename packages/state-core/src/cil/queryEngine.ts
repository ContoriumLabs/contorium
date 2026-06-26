import { kernelOutputToAskResult } from './formatter.js';
import { runCognitiveKernel } from './kernel.js';
import { enhanceAskAnswer, generateWhyExplanation } from '../ai/generators/index.js';
import { exploreHistory } from './historyExplorer.js';
import { getDecisionCenter } from './decisionCenter.js';
import { buildProjectJourney } from './journeyBuilder.js';
import { readHandoffArtifact } from '../understanding/store.js';
import type { AskProjectResult } from './types.js';

/** Ask Contorium — routed through Cognitive Kernel only. */
export async function askProject(workspaceRoot: string, question: string): Promise<AskProjectResult> {
  const output = await runCognitiveKernel(workspaceRoot, { mode: 'ask', query: question });
  let base = kernelOutputToAskResult(question, output);

  if (output.intent === 'decision') {
    const result = base.data as Record<string, unknown> | undefined;
    const center = await getDecisionCenter(workspaceRoot);
    const llmWhy = await generateWhyExplanation(workspaceRoot, {
      question,
      decision: String(result?.decision ?? ''),
      reason: String(result?.why ?? result?.answer ?? ''),
      date: result?.date ? String(result.date) : undefined,
      adrs: center.decisions.slice(0, 4).map((d) => `${d.title}: ${d.reason}`),
    });
    if (llmWhy) {
      base = {
        ...base,
        answer: llmWhy,
        data: { ...result, answer: llmWhy, llm_enhanced: true },
        trace: [...(base.trace ?? []), { engine: 'ai_layer', phase: 'why', at: new Date().toISOString() }],
      };
      return base;
    }
    return base;
  }

  const enhanced = await enhanceAskAnswer(
    workspaceRoot,
    question,
    base.answer,
    base.structured?.fact,
  );
  if (enhanced) {
    return { ...base, answer: enhanced };
  }
  return base;
}

export async function getProjectStory(workspaceRoot: string): Promise<{
  story: string;
  formatted: string[];
}> {
  const output = await runCognitiveKernel(workspaceRoot, { mode: 'story' });
  const story = output.result as { formatted_markdown?: string; project_summary?: string };
  const formatted = story.formatted_markdown?.split('\n') ?? [story.project_summary ?? ''];
  return { story: formatted.join('\n'), formatted };
}

/** @deprecated prefer runCognitiveKernel — kept for legacy callers */
export async function getProjectStoryLegacy(workspaceRoot: string) {
  const [history, center, journey, handoff] = await Promise.all([
    exploreHistory(workspaceRoot, 'last_7_days'),
    getDecisionCenter(workspaceRoot),
    buildProjectJourney(workspaceRoot),
    readHandoffArtifact(workspaceRoot),
  ]);
  const formatted = [
    'Project Story',
    '',
    handoff?.goal ? `Goal: ${handoff.goal}` : '',
    '',
    `Recent events: ${history.count}`,
    ...history.formatted.slice(0, 12),
    '',
    ...center.formatted.slice(0, 16),
    '',
    ...journey.formatted.slice(0, 12),
  ].filter(Boolean);
  return { story: formatted.join('\n'), formatted };
}
