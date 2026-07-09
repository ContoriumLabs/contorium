import type { AdrRecord } from '../cil/types.js';
export interface CodeDecisionTension {
    decision_id: string;
    decision_title: string;
    decision_term: string;
    code_signal: string;
    detail: string;
    confidence: number;
    evidence_path?: string;
    matched_decision_term?: string;
    matched_code_term?: string;
}
/** Scan recent file paths for signals that tension with accepted ADR decisions. */
export declare function detectCodeDecisionTensions(adrs: AdrRecord[], recentPaths: string[], workspaceRoot?: string): Promise<CodeDecisionTension[]>;
//# sourceMappingURL=codeContradiction.d.ts.map