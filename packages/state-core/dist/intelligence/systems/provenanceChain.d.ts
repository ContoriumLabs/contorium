import type { ProvenanceChainArtifact, ProvenanceChainEntry } from '../types.js';
export declare function readProvenanceChain(workspaceRoot: string): Promise<ProvenanceChainArtifact | null>;
export declare function queryProvenanceChain(artifact: ProvenanceChainArtifact, anchor?: string): ProvenanceChainEntry[];
/** Derive trace-back chains: WHY → DECISION → INTENT → TIMELINE (descriptive only). */
export declare function deriveProvenanceChains(workspaceRoot: string): Promise<ProvenanceChainArtifact>;
//# sourceMappingURL=provenanceChain.d.ts.map