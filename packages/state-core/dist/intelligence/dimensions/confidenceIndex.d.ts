import type { CognitionConfidenceMeta, ConfidenceIndexArtifact, ConfidenceIndexEntry, ConfidenceSignalSources } from '../types.js';
/** Descriptive confidence scoring — not prescriptive recommendations. */
export declare function deriveConfidenceFromSignals(signals: ConfidenceSignalSources): {
    entry: Omit<ConfidenceIndexEntry, 'entity_id' | 'updated_at'>;
    meta: CognitionConfidenceMeta;
};
export declare function readConfidenceIndex(workspaceRoot: string): Promise<ConfidenceIndexArtifact | null>;
export declare function queryConfidenceIndex(index: ConfidenceIndexArtifact, entityId?: string): ConfidenceIndexEntry[];
export declare function writeConfidenceIndex(workspaceRoot: string, entities: ConfidenceIndexEntry[]): Promise<ConfidenceIndexArtifact>;
//# sourceMappingURL=confidenceIndex.d.ts.map