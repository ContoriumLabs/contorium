/** V3.2 — infer change type / severity from diff or snippet (not path alone). */
export type ChangeType = 'comment' | 'style' | 'test' | 'config' | 'logic' | 'api' | 'architecture' | 'database' | 'security' | 'unknown';
export type ChangeSeverity = 'low' | 'medium' | 'high' | 'critical';
export interface ChangeAnalysisInput {
    target_path?: string;
    code_snippet?: string;
    diff_text?: string;
    lines_added?: number;
    lines_removed?: number;
}
export interface ChangeAnalysis {
    change_type: ChangeType;
    severity: ChangeSeverity;
    lines_added: number;
    lines_removed: number;
    /** Multiple change categories detected in the same diff. */
    mixed: boolean;
    type_hints: ChangeType[];
    signals: string[];
}
/** Derive analysis confidence from change signals (never a fixed constant). */
export declare function computeChangeConfidence(change: Pick<ChangeAnalysis, 'change_type' | 'mixed' | 'lines_added' | 'lines_removed' | 'type_hints'>): number;
export declare function analyzeChange(input: ChangeAnalysisInput): ChangeAnalysis;
//# sourceMappingURL=changeAnalyzer.d.ts.map