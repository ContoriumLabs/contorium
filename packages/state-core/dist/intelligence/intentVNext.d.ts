import type { IntentGraphVNext, IntentNodeVNext } from './types.js';
export declare function readIntentNodesVNext(workspaceRoot: string): Promise<IntentNodeVNext[]>;
export declare function deriveIntentGraphVNext(workspaceRoot: string): Promise<IntentGraphVNext | null>;
/** @deprecated Use deriveIntentGraphVNext — reflects legacy intent-graph into vNext paths. */
export declare function mirrorIntentGraphVNext(workspaceRoot: string): Promise<IntentGraphVNext | null>;
/** Project (write) vNext intent graph from caller-supplied nodes. */
export declare function projectIntentGraphVNext(workspaceRoot: string, graph: IntentGraphVNext): Promise<void>;
export declare function readIntentGraphVNext(workspaceRoot: string): Promise<IntentGraphVNext | null>;
//# sourceMappingURL=intentVNext.d.ts.map