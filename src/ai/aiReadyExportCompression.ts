import type { AiReadyJsonExport } from './buildAiReadyExport';
import { estimateTokens } from '../core/budget/tokenEstimator';
import { trimStringToTokenBudget } from '../core/budget/contextTrimmer';
import type { ExportFormat } from '../core/adapters/exportAdapters';
import { estimateExportAdapterOverheadTokens } from '../core/adapters/exportAdapters';
import type { ProviderManager } from './providers/providerManager';
import { enrichPromptForProvider } from '../runtime';
import { EXPORT_IDEAL_LOCAL_TOKENS, EXPORT_LLM_THRESHOLD_TOKENS } from '../constants';

interface MdSection {
  title: string;
  body: string;
}

function titleNorm(t: string): string {
  return t.trim().toUpperCase();
}

function parseAiReadyMarkdown(md: string): MdSection[] | null {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: MdSection[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (!line.startsWith('# ')) {
      i++;
      continue;
    }
    const title = line.slice(2).trim();
    i++;
    const buf: string[] = [];
    while (i < lines.length) {
      const L = lines[i] ?? '';
      if (L.startsWith('# ')) {
        break;
      }
      buf.push(L);
      i++;
    }
    out.push({ title, body: buf.join('\n').trimEnd() });
  }
  const keys = new Set(out.map((s) => titleNorm(s.title)));
  const hasAnchor = keys.has('TASK ANCHOR') || keys.has('TASK');
  if (!hasAnchor || !keys.has('INSTRUCTION')) {
    return null;
  }
  return out;
}

function serializeAiReadyMarkdown(sections: MdSection[]): string {
  const parts: string[] = [];
  for (const s of sections) {
    parts.push(`# ${s.title}`, s.body, '');
  }
  return parts.join('\n').replace(/\n+$/, '\n');
}

function bulletLines(body: string): string[] {
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('-'))
    .map((l) => l.replace(/^-\s*/, '').trim())
    .filter(Boolean);
}

function bulletsMd(items: readonly string[]): string {
  return items.map((x) => `- ${x}`).join('\n');
}

function truncateWords(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) {
    return t;
  }
  const slice = t.slice(0, maxLen);
  const lastSp = slice.lastIndexOf(' ');
  const cut = lastSp > maxLen * 0.45 ? slice.slice(0, lastSp) : slice;
  return cut.trimEnd() + '…';
}

function findSection(sections: MdSection[], key: string): MdSection | undefined {
  return sections.find((s) => titleNorm(s.title) === key);
}

/**
 * Structured local compression: drop lowest-signal bullets first, then shorten prose (no arbitrary mid-file chop).
 */
export function compressAiReadyMarkdownLocal(md: string, targetTokens: number): string {
  const parsed = parseAiReadyMarkdown(md);
  if (!parsed) {
    return md;
  }
  const sections = parsed.map((s) => ({ ...s, body: s.body }));
  const tok = () => estimateTokens(serializeAiReadyMarkdown(sections));
  let guard = 0;
  while (tok() > targetTokens && guard < 120) {
    guard++;
    const ctx = findSection(sections, 'WORKING CONTEXT');
    if (ctx) {
      const bodyLow = ctx.body.toLowerCase();
      const recentIdx = Math.max(
        bodyLow.indexOf('recent_git_activity:'),
        bodyLow.indexOf('recent work:'),
      );
      const activePart = recentIdx > 0 ? ctx.body.slice(0, recentIdx) : ctx.body;
      const recentPart = recentIdx > 0 ? ctx.body.slice(recentIdx) : '';
      const activeBullets = bulletLines(activePart);
      const recentBullets = bulletLines(recentPart);
      if (recentBullets.length > 2) {
        ctx.body =
          'active_files:\n' +
          bulletsMd(activeBullets.length ? activeBullets : ['(none)']) +
          '\n\nrecent_git_activity:\n' +
          bulletsMd(recentBullets.slice(0, -1));
        continue;
      }
      if (recentBullets.length === 2) {
        ctx.body =
          'active_files:\n' +
          bulletsMd(activeBullets.length ? activeBullets : ['(none)']) +
          '\n\nrecent_git_activity:\n' +
          bulletsMd([recentBullets[0]!]);
        continue;
      }
      if (activeBullets.length > 2) {
        ctx.body =
          'active_files:\n' +
          bulletsMd(activeBullets.slice(0, -1)) +
          '\n\nrecent_git_activity:\n' +
          bulletsMd(recentBullets.length ? recentBullets : ['(none)']);
        continue;
      }
    }
    const insights = findSection(sections, 'INSIGHTS');
    if (insights) {
      const b = bulletLines(insights.body);
      if (b.length > 2) {
        insights.body = bulletsMd(b.slice(0, -1));
        continue;
      }
      if (b.length === 1 && b[0]!.length > 90) {
        insights.body = bulletsMd([truncateWords(b[0]!, 86)]);
        continue;
      }
    }
    const snap = findSection(sections, 'PROJECT SNAPSHOT');
    if (snap && snap.body.length > 200) {
      snap.body = truncateWords(snap.body, Math.max(160, Math.floor(snap.body.length * 0.75)));
      continue;
    }
    const notes = findSection(sections, 'NOTES');
    if (notes && notes.body.length > 24) {
      notes.body = truncateWords(notes.body, Math.max(24, Math.floor(notes.body.length * 0.65)));
      continue;
    }
    const instr = findSection(sections, 'INSTRUCTION');
    if (instr && instr.body.length > 40) {
      instr.body = truncateWords(instr.body, Math.max(40, Math.floor(instr.body.length * 0.7)));
      continue;
    }
    const task =
      findSection(sections, 'TASK ANCHOR') ?? findSection(sections, 'TASK');
    if (task && task.body.length > 48) {
      task.body = truncateWords(task.body.trim(), Math.max(24, Math.floor(task.body.length * 0.75)));
      continue;
    }
    break;
  }
  return serializeAiReadyMarkdown(sections);
}

export function compressAiReadyJsonLocal(obj: AiReadyJsonExport, targetTokens: number): AiReadyJsonExport {
  const o: AiReadyJsonExport = {
    ...obj,
    workingContext: {
      activeFiles: [...obj.workingContext.activeFiles],
      recentWork: [...obj.workingContext.recentWork],
      recentGitActivity: [...(obj.workingContext.recentGitActivity ?? [])],
    },
    insights: obj.insights ? [...obj.insights] : undefined,
  };
  let guard = 0;
  while (estimateTokens(JSON.stringify(o)) > targetTokens && guard < 80) {
    guard++;
    if (o.insights && o.insights.length > 1) {
      o.insights.pop();
      continue;
    }
    if (o.workingContext.recentWork.length > 1) {
      o.workingContext.recentWork.pop();
      continue;
    }
    if (o.workingContext.recentGitActivity && o.workingContext.recentGitActivity.length > 1) {
      o.workingContext.recentGitActivity.pop();
      continue;
    }
    if (o.workingContext.activeFiles.length > 1) {
      o.workingContext.activeFiles.pop();
      continue;
    }
    if (o.projectSnapshot && o.projectSnapshot.length > 120) {
      o.projectSnapshot = truncateWords(
        o.projectSnapshot,
        Math.max(120, Math.floor(o.projectSnapshot.length * 0.72)),
      );
      continue;
    }
    const rw0 = o.workingContext.recentWork[0];
    if (rw0 && rw0.length > 40) {
      o.workingContext.recentWork = [truncateWords(rw0, 36)];
      continue;
    }
    if (o.notes.length > 12 && o.notes !== '(none)') {
      o.notes = truncateWords(o.notes, Math.max(12, Math.floor(o.notes.length * 0.65)));
      continue;
    }
    if (o.instruction.length > 20 && o.instruction !== '(none)') {
      o.instruction = truncateWords(o.instruction, Math.max(20, Math.floor(o.instruction.length * 0.7)));
      continue;
    }
    if (o.taskAnchor.length > 16 && o.taskAnchor !== '(not set)') {
      o.taskAnchor = truncateWords(o.taskAnchor, Math.max(16, Math.floor(o.taskAnchor.length * 0.75)));
      continue;
    }
    break;
  }
  return o;
}

const EXPORT_MD_COMPRESS_SYSTEM = `You are compressing a fixed-structure workspace handoff for another AI model.

Strict rules:
- Output ONLY valid markdown using these section headers when present in the input: # TASK ANCHOR, optional # PROJECT SNAPSHOT, # WORKING CONTEXT, optional # INSIGHTS, optional # NOTES, and # INSTRUCTION.
- Preserve the same header order as the input. Do not add new sections.
- Do not invent repository facts, file names, or intents; only shorten, merge redundant bullets, or tighten wording.
- Prefer removing lower-value bullets over deleting # TASK ANCHOR or # INSTRUCTION entirely.
- Stay at or below the user's approximate token target. Plain markdown only (no code fences around the whole doc).`;

async function compressAiReadyMarkdownWithLlm(
  md: string,
  targetTokens: number,
  providers: ProviderManager,
): Promise<string> {
  const pair = {
    system: EXPORT_MD_COMPRESS_SYSTEM,
    user: `Approximate target: ${targetTokens} tokens or fewer.\n\n---\n\n${md}`,
  };
  const enriched = enrichPromptForProvider('compression', pair);
  const out = await providers.completeChat([
    { role: 'system', content: enriched.system },
    { role: 'user', content: enriched.user },
  ]);
  const t = out.trim();
  return t || md;
}

function innerBudgetForAdapter(budget: number, fmt: ExportFormat): number {
  if (budget <= 0) {
    return 0;
  }
  const overhead = fmt === 'json' ? 0 : estimateExportAdapterOverheadTokens(fmt);
  return Math.max(48, budget - overhead - 24);
}

/**
 * Local-first: aim under ~500 tokens when possible, allow local-only up to ~800;
 * BYOK runs only when the handoff is still over ~800 tokens (large / complex).
 * Then enforce the user inner budget with further local passes and rare line trim.
 */
export async function compressExportMarkdownForBudget(
  baseMd: string,
  budgetTokens: number,
  fmt: ExportFormat,
  providers: ProviderManager,
  allowLlmFallback: boolean,
): Promise<string> {
  if (budgetTokens <= 0) {
    return baseMd;
  }
  const inner = innerBudgetForAdapter(budgetTokens, fmt);
  if (inner <= 0) {
    return baseMd;
  }

  let md = compressAiReadyMarkdownLocal(baseMd, Math.min(inner, EXPORT_IDEAL_LOCAL_TOKENS));
  if (estimateTokens(md) > Math.min(inner, EXPORT_LLM_THRESHOLD_TOKENS)) {
    md = compressAiReadyMarkdownLocal(md, Math.min(inner, EXPORT_LLM_THRESHOLD_TOKENS));
  }

  if (allowLlmFallback && estimateTokens(md) > EXPORT_LLM_THRESHOLD_TOKENS) {
    try {
      const llmTarget = Math.min(inner, EXPORT_LLM_THRESHOLD_TOKENS);
      md = await compressAiReadyMarkdownWithLlm(md, llmTarget, providers);
    } catch {
      /* BYOK off, missing key, or network */
    }
  }

  if (estimateTokens(md) > inner) {
    md = compressAiReadyMarkdownLocal(md, Math.floor(Math.min(inner, EXPORT_LLM_THRESHOLD_TOKENS) * 0.85));
  }
  if (estimateTokens(md) > inner) {
    md = compressAiReadyMarkdownLocal(md, Math.floor(inner * 0.82));
  }
  if (estimateTokens(md) > inner) {
    md = trimStringToTokenBudget(md, inner);
  }
  return md;
}

export function compressExportJsonForBudget(obj: AiReadyJsonExport, budgetTokens: number): AiReadyJsonExport {
  if (budgetTokens <= 0) {
    return obj;
  }
  const target = Math.max(1, Math.floor(budgetTokens * 0.96));
  return compressAiReadyJsonLocal(obj, target);
}
