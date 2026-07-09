import { readAllAdrRecords } from '../cil/eventStore.js';
import { findDecisionLifecycle } from './engine.js';
import { readKnowledgeLifecycle } from './store.js';
import type { DecisionLifecycleRecord, KnowledgeLifecycleIndex } from './types.js';

function recordsMentionedInText(text: string, records: DecisionLifecycleRecord[]): DecisionLifecycleRecord[] {
  const lower = text.toLowerCase();
  return records.filter((r) => {
    const title = r.title.toLowerCase();
    return title.length >= 4 && (lower.includes(title) || lower.includes(r.decision_id.toLowerCase()));
  });
}

/** Attach stale-trust warnings when history/entity/state answers touch aged decisions. */
export function formatLifecycleTrustWarnings(
  index: KnowledgeLifecycleIndex | null | undefined,
  answerText: string,
  intent: string,
): string | undefined {
  if (!index?.decisions.length) {
    return undefined;
  }
  if (intent === 'decision' || intent === 'direction') {
    return undefined;
  }

  const mentioned = recordsMentionedInText(answerText, index.decisions);
  const flagged = mentioned.filter(
    (r) =>
      r.needs_review ||
      r.expired ||
      r.conflict_refs.length > 0 ||
      r.lifecycle_status !== 'ACTIVE' ||
      r.confidence.overall < 50 ||
      (r.validity_state && r.validity_state !== 'VALID'),
  );

  const lines: string[] = [];

  if (flagged.length) {
    lines.push('**Lifecycle trust warnings** (decisions referenced in this answer):');
    for (const r of flagged.slice(0, 5)) {
      lines.push(
        `- **${r.title}** — validity ${r.validity_state ?? 'UNKNOWN'}, trust ${r.confidence.overall}%, freshness ${r.freshness_score}%`,
      );
      const topSignal = r.validity_signals?.[0];
      if (topSignal && r.validity_state !== 'VALID') {
        lines.push(`  - ${topSignal.type}: ${topSignal.reason}`);
      }
      for (const w of r.formatted_warnings.slice(0, 2)) {
        lines.push(`  - ${w}`);
      }
    }
  } else if (intent === 'state' && index.review_queue.length > 0) {
    lines.push(
      `**Review queue:** ${index.review_queue.length} decision(s) need attention (Knowledge Health ${index.health.score}%).`,
    );
    for (const item of index.review_queue.slice(0, 4)) {
      lines.push(`- ${item.title} (${item.reason}): ${item.detail}`);
    }
  } else if (index.review_queue.length >= 3 && (intent === 'history' || intent === 'entity')) {
    lines.push(
      `**Note:** ${index.review_queue.length} project decisions are in the review queue — historical facts may include stale authority.`,
    );
  }

  if (!lines.length) {
    return undefined;
  }
  return lines.join('\n');
}

export async function appendLifecycleTrustWarnings(
  workspaceRoot: string,
  answer: string,
  intent: string,
): Promise<string> {
  const index =
    (await readKnowledgeLifecycle(workspaceRoot)) ??
    undefined;
  const block = formatLifecycleTrustWarnings(index, answer, intent);
  if (!block) {
    return answer;
  }
  return `${answer}\n\n---\n\n${block}`;
}

/** Resolve lifecycle record for IDE owner/verify pickers. */
export async function listLifecycleDecisionsForPicker(
  workspaceRoot: string,
): Promise<Array<{ id: string; label: string; record: DecisionLifecycleRecord }>> {
  let index = await readKnowledgeLifecycle(workspaceRoot);
  if (!index?.decisions.length) {
    const { computeKnowledgeLifecycle } = await import('./engine.js');
    index = await computeKnowledgeLifecycle(workspaceRoot);
  }
  const adrs = await readAllAdrRecords(workspaceRoot);
  return index.decisions.map((r) => {
    const adr = adrs.find((a) => a.id === r.decision_id);
    return {
      id: r.decision_id,
      label: adr?.title ?? r.title,
      record: r,
    };
  });
}

export async function findLifecycleRecordByPickerId(
  workspaceRoot: string,
  decisionId: string,
): Promise<DecisionLifecycleRecord | undefined> {
  const index = await readKnowledgeLifecycle(workspaceRoot);
  if (!index) {
    return undefined;
  }
  return findDecisionLifecycle(index, decisionId);
}
