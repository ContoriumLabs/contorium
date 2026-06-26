import type { HistoryExplorerResult, HistoryRange } from './types.js';
import type { CognitiveEvent } from './types.js';
export declare function exploreHistory(workspaceRoot: string, range?: HistoryRange): Promise<HistoryExplorerResult>;
export declare function getRecentEvents(workspaceRoot: string, limit?: number): Promise<CognitiveEvent[]>;
export declare function getModuleHistory(workspaceRoot: string, modulePath: string, limit?: number): Promise<CognitiveEvent[]>;
export declare function exploreModuleHistoryFeed(workspaceRoot: string, module: string): Promise<{
    module: string;
    formatted: string[];
}>;
//# sourceMappingURL=historyExplorer.d.ts.map