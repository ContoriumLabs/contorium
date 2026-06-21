import type { GovernanceReviewArtifact } from '../governance/governanceReview.js';
import type { GovernanceDecisionAction } from '../governance/governanceArtifacts.js';
import type { DecisionProvenanceGraph, DecisionProvenanceNode } from './types.js';
export declare function readDecisionProvenanceGraph(workspaceRoot: string): Promise<DecisionProvenanceGraph | null>;
export declare function deriveDecisionProvenanceNode(input: {
    review: GovernanceReviewArtifact;
    action: GovernanceDecisionAction;
    linked_intent?: string;
}): DecisionProvenanceNode;
/** @deprecated Use deriveDecisionProvenanceNode */
export declare const buildDecisionProvenanceNode: typeof deriveDecisionProvenanceNode;
export declare function appendDecisionProvenanceNode(workspaceRoot: string, node: DecisionProvenanceNode): Promise<DecisionProvenanceGraph>;
//# sourceMappingURL=decisionProvenance.d.ts.map