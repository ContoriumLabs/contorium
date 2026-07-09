import { kernelOutputToAskResult } from './formatter.js';
import { runCognitiveKernel } from './kernel.js';
import { enhanceAskAnswer, generateWhyExplanation } from '../ai/generators/index.js';
import { exploreHistory } from './historyExplorer.js';
import { getDecisionCenter } from './decisionCenter.js';
import { buildProjectJourney } from './journeyBuilder.js';
import { readHandoffArtifact } from '../understanding/store.js';
import type { AskProjectResult, AskSemanticBundle } from './types.js';
import {
  appendAlignmentNote,
  buildDirectionKernelOutput,
  prepareAskV2Context,
} from './askV2.js';
import { enrichDecisionAskAnswer } from '../lifecycle/askBridge.js';
import { appendLifecycleTrustWarnings } from '../lifecycle/askHints.js';

function toSemanticBundle(
  fusion: Awaited<ReturnType<typeof prepareAskV2Context>>['fusion'],
  pikSource: string,
): AskSemanticBundle {
  return {
    primary_intent: fusion.primary_intent_statement,
    alignment_score: fusion.current_alignment_score,
    drift: fusion.drift,
    recommended_next_focus: fusion.recommended_next_focus,
    pik_source: pikSource,
    reasoning_trace: fusion.reasoning_trace,
  };
}

/** Ask Contorium v2 — PIK + semantic fusion, then cognitive kernel. */
export async function askProject(workspaceRoot: string, question: string): Promise<AskProjectResult> {
  const ctx = await prepareAskV2Context(workspaceRoot, question);
  const semantic = toSemanticBundle(ctx.fusion, ctx.pik.source);

  if (ctx.isDirection || ctx.isDrift) {
    const output = buildDirectionKernelOutput(question, ctx);
    return {
      ...kernelOutputToAskResult(question, output),
      semantic,
    };
  }

  const output = await runCognitiveKernel(workspaceRoot, { mode: 'ask', query: question });
  let base = kernelOutputToAskResult(question, output);
  base = {
    ...base,
    answer: appendAlignmentNote(base.answer, ctx.fusion),
    semantic,
  };

  if (output.intent === 'decision') {
    const result = base.data as Record<string, unknown> | undefined;
    const center = await getDecisionCenter(workspaceRoot);
    const enriched = await enrichDecisionAskAnswer(
      workspaceRoot,
      base.answer,
      {
        id: result?.decision ? String(result.decision) : undefined,
        title: typeof result?.decision === 'string' ? String(result.decision) : undefined,
      },
      question,
    );
    let decisionAnswer = enriched.answer;
    const llmWhy = await generateWhyExplanation(workspaceRoot, {
      question,
      decision: String(result?.decision ?? ''),
      reason: String(result?.why ?? result?.answer ?? ''),
      date: result?.date ? String(result.date) : undefined,
      adrs: center.decisions.slice(0, 4).map((d) => `${d.title}: ${d.reason}`),
    });
    if (llmWhy) {
      const llmEnriched = await enrichDecisionAskAnswer(
        workspaceRoot,
        llmWhy,
        {
          id: result?.decision ? String(result.decision) : undefined,
          title: typeof result?.decision === 'string' ? String(result.decision) : undefined,
        },
        question,
      );
      decisionAnswer = llmEnriched.answer;
      base = {
        ...base,
        answer: appendAlignmentNote(decisionAnswer, ctx.fusion),
        data: {
          ...result,
          answer: decisionAnswer,
          llm_enhanced: true,
          lifecycle: enriched.lifecycle,
        },
        trace: [...(base.trace ?? []), { engine: 'ai_layer', phase: 'why', at: new Date().toISOString() }],
        semantic,
      };
      return base;
    }
    base = {
      ...base,
      answer: appendAlignmentNote(decisionAnswer, ctx.fusion),
      data: { ...result, answer: decisionAnswer, lifecycle: enriched.lifecycle },
      semantic,
    };
    return base;
  }

  const enhanced = await enhanceAskAnswer(
    workspaceRoot,
    question,
    base.answer,
    base.structured?.fact,
  );
  if (enhanced) {
    base = { ...base, answer: appendAlignmentNote(enhanced, ctx.fusion), semantic };
  }

  base = {
    ...base,
    answer: await appendLifecycleTrustWarnings(workspaceRoot, base.answer, output.intent),
  };
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
