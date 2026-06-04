import { REBUILD_FILE_THRESHOLD, REBUILD_IDLE_MS } from './closureConstants.js';

export type KnowledgeRebuildTrigger =
  | 'git_commit'
  | 'file_batch'
  | 'intent_change'
  | 'idle'
  | 'initial'
  | 'change';

export interface RebuildTriggerInput {
  changedFileCount: number;
  intentChanged: boolean;
  lastBuildAt?: number;
  now: number;
  hasNewCommit?: boolean;
  isInitial?: boolean;
}

/** When to rebuild knowledge.json (Closure §9.3). */
export function resolveKnowledgeRebuildTrigger(input: RebuildTriggerInput): KnowledgeRebuildTrigger {
  if (input.isInitial) {
    return 'initial';
  }
  if (input.hasNewCommit) {
    return 'git_commit';
  }
  if (input.changedFileCount >= REBUILD_FILE_THRESHOLD) {
    return 'file_batch';
  }
  if (input.intentChanged) {
    return 'intent_change';
  }
  if (input.lastBuildAt != null && input.now - input.lastBuildAt >= REBUILD_IDLE_MS) {
    return 'idle';
  }
  return 'change';
}

export function shouldRebuildKnowledgeGraph(input: RebuildTriggerInput): boolean {
  if (input.isInitial || !input.lastBuildAt) {
    return true;
  }
  const trigger = resolveKnowledgeRebuildTrigger(input);
  if (trigger === 'idle' && input.changedFileCount === 0) {
    return true;
  }
  return input.changedFileCount > 0 || input.intentChanged || !!input.hasNewCommit;
}
