import * as path from 'node:path';

export const LIFECYCLE_DIR = 'lifecycle';
export const LIFECYCLE_INDEX_FILE = 'index.json';
export const LIFECYCLE_META_DIR = 'decisions';
export const REVIEW_QUEUE_FILE = 'review-queue.json';

export function lifecycleRoot(workspaceRoot: string): string {
  return path.join(path.resolve(workspaceRoot), '.contora', LIFECYCLE_DIR);
}

export function lifecycleIndexPath(workspaceRoot: string): string {
  return path.join(lifecycleRoot(workspaceRoot), LIFECYCLE_INDEX_FILE);
}

export function lifecycleReviewQueuePath(workspaceRoot: string): string {
  return path.join(lifecycleRoot(workspaceRoot), REVIEW_QUEUE_FILE);
}

export function lifecycleMetaPath(workspaceRoot: string, decisionId: string): string {
  const safe = decisionId.replace(/[^\w.-]+/g, '_');
  return path.join(lifecycleRoot(workspaceRoot), LIFECYCLE_META_DIR, `${safe}.json`);
}
