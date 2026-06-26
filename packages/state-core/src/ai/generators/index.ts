import { buildTransferStory } from '../../cil/transferStory.js';
import { buildProjectEssence } from '../../cil/memoryCompression.js';
import { buildProjectDna } from '../../cil/projectDna.js';
import { aiGenerate } from '../runtime.js';
import { buildWhyPrompt } from '../prompts/why.js';
import {
  buildAskEnhancePrompt,
  buildDnaPrompt,
  buildEssencePrompt,
  buildStoryPrompt,
} from '../prompts/narrative.js';
import type { TransferStoryPayload, ProjectEssence, ProjectDna } from '../../cil/types.js';

export async function generateWhyExplanation(
  workspaceRoot: string,
  input: {
    question: string;
    decision?: string;
    reason?: string;
    date?: string;
    events?: string[];
    adrs?: string[];
  },
): Promise<string | null> {
  const prompt = buildWhyPrompt(input);
  const out = await aiGenerate(workspaceRoot, 'why', prompt, `why:${input.question}`);
  return out?.text ?? null;
}

export async function generateStoryWithAi(
  workspaceRoot: string,
): Promise<TransferStoryPayload & { llm_enhanced?: boolean }> {
  const rule = await buildTransferStory(workspaceRoot);
  const out = await aiGenerate(
    workspaceRoot,
    'story',
    buildStoryPrompt(rule.formatted_markdown),
    'story:v1',
  );
  if (!out?.text) {
    return rule;
  }
  return {
    ...rule,
    formatted_markdown: out.text,
    project_summary: out.text.split('\n').find((l) => l.trim() && !l.startsWith('#'))?.trim() ?? rule.project_summary,
    llm_enhanced: true,
  };
}

export async function generateEssenceWithAi(
  workspaceRoot: string,
): Promise<ProjectEssence & { llm_enhanced?: boolean }> {
  const rule = await buildProjectEssence(workspaceRoot);
  const md = rule.formatted_markdown ?? '';
  const out = await aiGenerate(workspaceRoot, 'essence', buildEssencePrompt(md), 'essence:v1');
  if (!out?.text) {
    return rule;
  }
  return { ...rule, formatted_markdown: out.text, llm_enhanced: true };
}

export async function generateDnaWithAi(workspaceRoot: string): Promise<ProjectDna & { llm_enhanced?: boolean }> {
  const rule = await buildProjectDna(workspaceRoot);
  const text = rule.formatted?.join('\n') ?? '';
  const out = await aiGenerate(workspaceRoot, 'dna', buildDnaPrompt(text), 'dna:v1');
  if (!out?.text) {
    return rule;
  }
  return { ...rule, formatted: out.text.split('\n'), llm_enhanced: true };
}

export async function enhanceAskAnswer(
  workspaceRoot: string,
  question: string,
  ruleAnswer: string,
  facts?: string[],
): Promise<string | null> {
  const prompt = buildAskEnhancePrompt({ question, ruleAnswer, facts });
  const out = await aiGenerate(workspaceRoot, 'ask_enhance', prompt, `ask:${question}:${ruleAnswer.slice(0, 80)}`);
  return out?.text ?? null;
}
