import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { writeJsonFile, readJsonFile } from '../intelligence/dimensions/io.js';
import { computeKnowledgeLifecycle } from './engine.js';
import {
  lifecycleIndexPath,
  lifecycleMetaPath,
  lifecycleReviewQueuePath,
  lifecycleRoot,
} from './paths.js';
import type { DecisionLifecycleMeta, KnowledgeLifecycleIndex, ReviewQueueArtifact } from './types.js';
import { KNOWLEDGE_LIFECYCLE_SCHEMA, REVIEW_QUEUE_SCHEMA } from './types.js';

export async function persistKnowledgeLifecycle(workspaceRoot: string): Promise<KnowledgeLifecycleIndex> {
  const root = lifecycleRoot(workspaceRoot);
  await fs.mkdir(path.join(root, 'decisions'), { recursive: true });

  const index = await computeKnowledgeLifecycle(workspaceRoot);
  await writeJsonFile(lifecycleIndexPath(workspaceRoot), index);

  const reviewArtifact: ReviewQueueArtifact = {
    schema: REVIEW_QUEUE_SCHEMA,
    updated_at: index.updated_at,
    items: index.review_queue,
    formatted: index.review_queue.length
      ? index.review_queue.flatMap((item) => {
          const days = item.days != null ? ` | ${item.days} days` : '';
          const lines = [`- [${item.severity}] ${item.title} - ${item.reason}${days}`, `  ${item.detail}`];
          if (item.action_hint) {
            lines.push(`  Next: ${item.action_hint}`);
          }
          return lines;
        })
      : ['No items need review.'],
  };
  await writeJsonFile(lifecycleReviewQueuePath(workspaceRoot), reviewArtifact);

  return index;
}

export async function readKnowledgeLifecycle(
  workspaceRoot: string,
): Promise<KnowledgeLifecycleIndex | null> {
  const raw = await readJsonFile<KnowledgeLifecycleIndex>(lifecycleIndexPath(workspaceRoot));
  if (raw?.schema === KNOWLEDGE_LIFECYCLE_SCHEMA && Array.isArray(raw.decisions)) {
    return raw;
  }
  return null;
}

export async function readReviewQueueArtifact(
  workspaceRoot: string,
): Promise<ReviewQueueArtifact | null> {
  const raw = await readJsonFile<ReviewQueueArtifact>(lifecycleReviewQueuePath(workspaceRoot));
  if (raw?.schema === REVIEW_QUEUE_SCHEMA && Array.isArray(raw.items)) {
    return raw;
  }
  return null;
}

export async function writeDecisionLifecycleMeta(
  workspaceRoot: string,
  decisionId: string,
  meta: DecisionLifecycleMeta,
): Promise<void> {
  await writeJsonFile(lifecycleMetaPath(workspaceRoot, decisionId), meta);
}

export async function readDecisionLifecycleMeta(
  workspaceRoot: string,
  decisionId: string,
): Promise<DecisionLifecycleMeta | null> {
  return readJsonFile<DecisionLifecycleMeta>(lifecycleMetaPath(workspaceRoot, decisionId));
}
