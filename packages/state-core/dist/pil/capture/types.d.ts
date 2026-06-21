export interface CaptureFocusResult {
    workspaceRoot: string;
    captured: 'focus';
    focus: string;
    lastUpdated: number;
}
export interface CaptureNoteResult {
    workspaceRoot: string;
    captured: 'note';
    line: string;
    lastUpdated: number;
}
export interface CaptureDecisionInput {
    selected: string;
    reason?: string;
    intent_id?: string;
    decision_id?: string;
}
export interface CaptureDecisionResult {
    workspaceRoot: string;
    captured: 'decision';
    decision_id: string;
    selected: string;
    log_entries: number;
}
//# sourceMappingURL=types.d.ts.map