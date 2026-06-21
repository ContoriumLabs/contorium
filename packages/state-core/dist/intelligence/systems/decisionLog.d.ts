import type { DecisionProvenanceNode } from '../types.js';
export declare const DECISION_LOG_SCHEMA: "decision_log.v1";
export interface DecisionLogEntry {
    decision_id: string;
    intent_id: string;
    selected: string;
    reason: string;
    impact: string[];
    created_at: string;
}
export interface DecisionLogArtifact {
    schema: typeof DECISION_LOG_SCHEMA;
    updated_at: string;
    entries: DecisionLogEntry[];
}
export declare function readDecisionLog(workspaceRoot: string): Promise<DecisionLogArtifact | null>;
export declare function appendDecisionLogEntry(workspaceRoot: string, node: DecisionProvenanceNode): Promise<DecisionLogArtifact>;
//# sourceMappingURL=decisionLog.d.ts.map