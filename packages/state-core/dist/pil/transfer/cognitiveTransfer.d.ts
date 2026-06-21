import type { BootstrapStateJson } from '../../types.js';
import type { ProjectBuiltState } from '../../state-builder/types.js';
import type { HandoffArtifact } from '../../understanding/types.js';
import type { KnowledgeSnapshot } from '../../understanding/knowledgeGraph/types.js';
import { trimStringToTokenBudget } from './tokenBudget.js';
export { trimStringToTokenBudget };
/** v2.3 Transfer Context — target ~300–800 tokens. */
export declare const TRANSFER_CONTEXT_TOKEN_TARGET = 800;
export declare const FULL_INTELLIGENCE_TOKEN_TARGET = 8000;
export interface TransferContextSnapshot {
    focus: string;
    goal: string;
    stage: string;
    changes: string[];
    constraints: {
        protected: string[];
        rules: string[];
    };
    continuation: string[];
    confidence: number | null;
}
export type TransferExportMode = 'cognitive-snapshot' | 'full-intelligence';
export interface TransferExportInput {
    workspaceRoot: string;
    state?: BootstrapStateJson | null;
    handoff?: HandoffArtifact;
    builtState?: ProjectBuiltState;
    knowledgeSnapshot?: KnowledgeSnapshot;
    /** Legacy intent-graph text fallback (IDE-only graph). */
    legacyIntentText?: string;
}
export declare function loadTransferExportInput(workspaceRoot: string): Promise<TransferExportInput>;
export declare function buildTransferContextSnapshot(input: TransferExportInput): Promise<TransferContextSnapshot>;
export declare function formatTransferContextMarkdown(snapshot: TransferContextSnapshot): string;
export declare function formatTransferContextJson(snapshot: TransferContextSnapshot): string;
export declare function toTransferContextPayload(snapshot: TransferContextSnapshot): {
    focus: string;
    goal: string;
    stage: string;
    changes: string[];
    constraints: string[];
    continuation: string[];
    confidence: number | null;
};
export declare function finalizeTransferContextText(text: string, asJson: boolean): string;
export declare function buildFullIntelligenceMarkdown(input: TransferExportInput): Promise<string>;
export declare function transferExportModeLabel(mode: TransferExportMode): string;
//# sourceMappingURL=cognitiveTransfer.d.ts.map