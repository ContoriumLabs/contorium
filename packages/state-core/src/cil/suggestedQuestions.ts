import { readStateJson } from '../bootstrap/bootstrapState.js';
import { computeCognitiveHealth } from './cognitiveHealth.js';
import { detectDecisionContradictions } from './decisionConsistency.js';
import { readAllAdrRecords, readAllCognitiveEvents } from './eventStore.js';
import { getBlastRadius } from './impactExplorer.js';
import type { SuggestedQuestionsResult } from './types.js';

/** Auto-generate top questions for Ask Contorium (onboarding UX). */
export async function buildSuggestedQuestions(
  workspaceRoot: string,
): Promise<SuggestedQuestionsResult> {
  const [events, adrs, state, health] = await Promise.all([
    readAllCognitiveEvents(workspaceRoot),
    readAllAdrRecords(workspaceRoot),
    readStateJson(workspaceRoot),
    computeCognitiveHealth(workspaceRoot).catch(() => null),
  ]);

  const questions: string[] = [];

  const mcpEvent = events.find((e) => /mcp/i.test(e.title));
  if (mcpEvent) {
    questions.push('Why was MCP added?');
  } else {
    questions.push('What is this project?');
  }

  const focus = state?.currentTask?.trim();
  if (focus) {
    questions.push(`What is current focus?`);
  } else {
    questions.push('What should I do next?');
  }

  const unresolved = adrs.filter((a) => a.status === 'proposed');
  if (unresolved.length) {
    questions.push('Which decisions are unresolved?');
  }

  questions.push('What changed this week?');

  const conflicts = detectDecisionContradictions(adrs);
  if (conflicts.length) {
    questions.push('Which decisions conflict?');
  }

  if (health && health.score < 85) {
    questions.push('Is the project healthy?');
  }

  const recentFile = events.find((e) => e.files.length)?.files[0];
  if (recentFile) {
    const mod = recentFile.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') ?? '';
    if (mod.length >= 3) {
      try {
        const blast = await getBlastRadius(workspaceRoot, mod);
        if (blast.blast_radius >= 0.5) {
          questions.push(`What is highest risk module (${mod})?`);
        }
      } catch {
        /* optional */
      }
    }
  }

  const unique = [...new Set(questions)].slice(0, 8);

  return {
    questions: unique,
    formatted: ['Suggested Questions', '', ...unique.map((q, i) => `${i + 1}. ${q}`)],
  };
}
