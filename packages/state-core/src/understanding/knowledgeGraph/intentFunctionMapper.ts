import type { IntentFunctionMapping } from './types.js';
import { MAPPING_DISCOVERY_MIN_SCORE } from './closureConstants.js';
import { computeUnifiedConfidence } from './confidence.js';

const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'to', 'in', 'on', 'for', 'of', 'with', 'from',
  'continue', 'current', 'workspace', 'task', 'focus', 'editing', 'stage',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\u4e00-\u9fff]+/gi, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function cosineSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) {
    return 0;
  }
  const freqA = new Map<string, number>();
  const freqB = new Map<string, number>();
  for (const t of a) {
    freqA.set(t, (freqA.get(t) ?? 0) + 1);
  }
  for (const t of b) {
    freqB.set(t, (freqB.get(t) ?? 0) + 1);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [, v] of freqA) {
    normA += v * v;
  }
  for (const [, v] of freqB) {
    normB += v * v;
  }
  for (const [k, v] of freqA) {
    const w = freqB.get(k) ?? 0;
    dot += v * w;
  }
  if (!normA || !normB) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function camelTokens(name: string): string[] {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export interface FunctionDescriptor {
  id: string;
  name: string;
  file: string;
  moduleHint?: string;
  callTargets?: string[];
}

export interface IntentDescriptor {
  id: string;
  text: string;
}

export interface MappingContext {
  recentEditFiles?: Set<string>;
  gitFrequency?: Map<string, number>;
}

/** Intent ↔ Function mapping — token similarity + recency + git frequency (V3.1). */
export function mapIntentsToFunctions(
  intents: IntentDescriptor[],
  functions: FunctionDescriptor[],
  ctx: MappingContext = {},
): IntentFunctionMapping[] {
  const recent = ctx.recentEditFiles ?? new Set<string>();
  const gitFreq = ctx.gitFrequency ?? new Map<string, number>();
  const maxGit = Math.max(1, ...gitFreq.values(), 1);
  const out: IntentFunctionMapping[] = [];

  for (const intent of intents) {
    const intentTokens = tokenize(intent.text);
    for (const fn of functions) {
      const fnTokens = [
        ...tokenize(fn.name),
        ...camelTokens(fn.name),
        ...tokenize(fn.file.split('/').pop() ?? fn.file),
        ...(fn.moduleHint ? tokenize(fn.moduleHint) : []),
        ...(fn.callTargets ?? []).flatMap((c) => [...tokenize(c), ...camelTokens(c)]),
      ];
      const similarity = cosineSimilarity(intentTokens, fnTokens);
      const fileNorm = fn.file.replace(/\\/g, '/');
      const recentEdit = recent.has(fileNorm) ? 1 : 0;
      const gitScore = (gitFreq.get(fileNorm) ?? 0) / maxGit;
      const confidence = computeUnifiedConfidence({
        semanticSimilarity: similarity,
        temporalRecency: recentEdit,
        gitActivity: gitScore,
      });
      const score = confidence;

      if (score < MAPPING_DISCOVERY_MIN_SCORE) {
        continue;
      }
      const signals: string[] = [];
      if (similarity >= 0.2) {
        signals.push(`token match ${Math.round(similarity * 100)}%`);
      }
      if (recentEdit) {
        signals.push('recent edit');
      }
      if (gitScore > 0.1) {
        signals.push('git activity');
      }
      out.push({
        intentId: intent.id,
        functionId: fn.id,
        score,
        confidence,
        signals,
      });
    }
  }

  return out.sort((a, b) => b.score - a.score).slice(0, 48);
}

export { tokenize, cosineSimilarity };
