import type { AdapterKind } from '../../types.js';
import type { CaptureDecisionInput, CaptureDecisionResult, CaptureFocusResult, CaptureNoteResult } from './types.js';
export type { CaptureDecisionInput, CaptureDecisionResult, CaptureFocusResult, CaptureNoteResult };
/** PIL Capture — persist current project focus. */
export declare function captureProjectFocus(workspaceRoot: string, focus: string, writer?: AdapterKind): Promise<CaptureFocusResult>;
/** PIL Capture — append a timestamped project note. */
export declare function captureProjectNote(workspaceRoot: string, text: string, writer?: AdapterKind): Promise<CaptureNoteResult>;
/** PIL Capture — record a decision (Structure → Preserve). */
export declare function captureProjectDecision(workspaceRoot: string, input: CaptureDecisionInput): Promise<CaptureDecisionResult>;
//# sourceMappingURL=index.d.ts.map