import { appendDecisionLogEntry } from '../../intelligence/systems/decisionLog.js';
import type { DecisionLogArtifact } from '../../intelligence/systems/decisionLog.js';
import type { DecisionProvenanceNode } from '../../intelligence/types.js';

/** Persist a structured decision node (Preserve layer). */
export async function preserveDecisionNode(
  workspaceRoot: string,
  node: DecisionProvenanceNode,
): Promise<DecisionLogArtifact> {
  return appendDecisionLogEntry(workspaceRoot, node);
}
