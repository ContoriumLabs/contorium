import type { AdapterKind } from '../types.js';
import type { ChangeArtifact, HandoffArtifact, ProjectGraph } from './types.js';
/** Runtime Understanding Graph — call chains + impact from recent changes. */
export interface UnderstandingGraph {
    version: 1;
    generatedAt: number;
    recent_change: {
        name: string;
        file?: string;
        change_type?: string;
    };
    call_chain: string[];
    affected: string[];
    agent: string;
}
export declare function buildUnderstandingGraph(args: {
    graph: ProjectGraph;
    change: ChangeArtifact;
    handoff: HandoffArtifact;
    agent?: AdapterKind | string;
    now?: number;
}): UnderstandingGraph | undefined;
//# sourceMappingURL=understandingGraphBuilder.d.ts.map