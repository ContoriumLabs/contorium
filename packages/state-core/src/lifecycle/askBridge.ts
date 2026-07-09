import { readAllAdrRecords } from '../cil/eventStore.js';
import {
  computeKnowledgeLifecycle,
  findDecisionLifecycle,
  formatDecisionLifecycleAnswer,
} from './engine.js';
import { readKnowledgeLifecycle } from './store.js';
import type { DecisionLifecycleRecord } from './types.js';

/** Lifecycle filter — enrich decision Ask answers with trust metadata (优化.md §11). */
export async function enrichDecisionAskAnswer(
  workspaceRoot: string,
  baseAnswer: string,
  match?: { id?: string; title?: string },
  topic?: string,
): Promise<{ answer: string; lifecycle?: DecisionLifecycleRecord }> {
  let index = await readKnowledgeLifecycle(workspaceRoot);
  if (!index?.decisions.length) {
    index = await computeKnowledgeLifecycle(workspaceRoot);
  }

  const needle = match?.id ?? match?.title ?? topic ?? '';
  const record = needle ? findDecisionLifecycle(index, needle) : index.decisions[0];
  if (!record) {
    return { answer: baseAnswer };
  }

  const adrs = await readAllAdrRecords(workspaceRoot);
  const trustBlock = formatDecisionLifecycleAnswer(record, adrs);
  return {
    answer: `${baseAnswer}\n\n---\n\n## Knowledge trust (Lifecycle)\n\n${trustBlock}`,
    lifecycle: record,
  };
}

/** Extract decision ids/titles referenced in kernel structured results (for lifecycle filtering). */
export function extractDecisionRefsFromAskResult(
  intent: string,
  data: Record<string, unknown> | undefined,
): string[] {
  if (!data) {
    return [];
  }
  const refs = new Set<string>();

  if (intent === 'history' && Array.isArray(data.events)) {
    for (const raw of data.events) {
      if (!raw || typeof raw !== 'object') {
        continue;
      }
      const ev = raw as Record<string, unknown>;
      if (typeof ev.linked_decision_id === 'string') {
        refs.add(ev.linked_decision_id);
      }
      if (typeof ev.decision === 'string') {
        refs.add(ev.decision);
      }
      if (typeof ev.title === 'string' && ev.title.length >= 4) {
        refs.add(ev.title);
      }
    }
  }

  if (intent === 'action' && Array.isArray(data.items)) {
    for (const raw of data.items) {
      if (!raw || typeof raw !== 'object') {
        continue;
      }
      const item = raw as Record<string, unknown>;
      if (typeof item.decision_ref === 'string') {
        refs.add(item.decision_ref);
      }
      const task = typeof item.task === 'string' ? item.task : '';
      const m = task.match(/decision:\s*(.+)/i);
      if (m?.[1]) {
        refs.add(m[1].trim());
      }
    }
  }

  if (intent === 'entity') {
    const record = data.record as Record<string, unknown> | undefined;
    if (record && Array.isArray(record.decisions)) {
      for (const d of record.decisions) {
        if (typeof d === 'string') {
          refs.add(d);
        }
      }
    }
  }

  if (intent === 'state' && Array.isArray(data.review_queue)) {
    for (const raw of data.review_queue) {
      if (!raw || typeof raw !== 'object') {
        continue;
      }
      const item = raw as Record<string, unknown>;
      if (typeof item.decision_id === 'string') {
        refs.add(item.decision_id);
      }
      if (typeof item.title === 'string') {
        refs.add(item.title);
      }
    }
  }

  return [...refs];
}
