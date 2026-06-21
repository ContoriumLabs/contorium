/** PIL Retrieve — workspace state bundle. */
export declare function retrieveProjectState(workspaceRoot: string): Promise<{
    state: import("../../types.js").BootstrapStateJson | null;
    status: {
        workspaceRoot: string;
        hasState: boolean;
        mode: import("../../types.js").StateEngineMode | "unknown";
        source?: import("../../types.js").StateSourceMetadata;
        eventCount: number;
        gitWorking: number;
        gitStaged: number;
        currentTask: string;
    };
    built_state: import("../../index.js").ProjectBuiltState | undefined;
}>;
export declare function retrieveIntentGraph(workspaceRoot: string): Promise<import("../../index.js").IntentGraphVNext | null>;
export declare function retrieveDecisionBundle(workspaceRoot: string): Promise<{
    decision: import("../../governance/governanceArtifacts.js").GovernanceDecisionArtifact | null;
    decision_graph: import("../../index.js").DecisionProvenanceGraph | null;
    decision_log: import("../../intelligence/systems/decisionLog.js").DecisionLogArtifact | null;
}>;
export declare function retrieveTimeline(workspaceRoot: string): Promise<import("../../index.js").ProjectEvolutionTimeline | null>;
export declare function retrieveGraph(workspaceRoot: string): Promise<import("../../index.js").ProjectGraph | undefined>;
export declare function retrieveConfidence(workspaceRoot: string, entityId?: string): Promise<{
    index: import("../../index.js").ConfidenceIndexArtifact | null;
    entities: import("../../index.js").ConfidenceIndexEntry[];
}>;
export declare function retrieveImpact(workspaceRoot: string, entityId?: string): Promise<{
    graph: import("../../index.js").ImpactGraphArtifact | null;
    entries: import("../../index.js").ImpactGraphEntry[];
}>;
export declare function retrieveWhy(workspaceRoot: string): Promise<import("../../index.js").WhyLayerArtifact | null>;
export declare function retrieveHealth(workspaceRoot: string): Promise<import("../../index.js").ProjectIntelligenceHealth | null>;
export declare function retrieveEvolution(workspaceRoot: string, anchor?: string): Promise<{
    graph: import("../../index.js").EvolutionGraphArtifact | null;
    chains: import("../../index.js").EvolutionGraphChain[];
}>;
export declare function retrieveProvenance(workspaceRoot: string, anchor?: string): Promise<{
    chain: import("../../index.js").ProvenanceChainArtifact | null;
    entries: import("../../index.js").ProvenanceChainEntry[];
}>;
export declare function retrieveHandoff(workspaceRoot: string): Promise<import("../../index.js").HandoffArtifact | undefined>;
//# sourceMappingURL=index.d.ts.map