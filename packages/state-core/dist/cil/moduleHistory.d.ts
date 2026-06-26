import type { CognitiveEvent, ModuleHistoryRecord } from './types.js';
/** Persist per-module event feeds under .contora/module-history/ */
export declare function syncModuleHistory(workspaceRoot: string, events: CognitiveEvent[]): Promise<Map<string, ModuleHistoryRecord>>;
export declare function readModuleHistoryRecord(workspaceRoot: string, module: string): Promise<ModuleHistoryRecord | null>;
export declare function exploreModuleHistory(workspaceRoot: string, module: string, events?: CognitiveEvent[]): Promise<{
    module: string;
    formatted: string[];
    record: ModuleHistoryRecord | null;
}>;
export declare function filterEventsByModule(events: CognitiveEvent[], module: string): CognitiveEvent[];
//# sourceMappingURL=moduleHistory.d.ts.map