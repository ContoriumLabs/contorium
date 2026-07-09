import type { AdrRecord, CognitiveEvent, CognitiveEventIndex } from './types.js';
export declare function readCognitiveEventIndex(workspaceRoot: string): Promise<CognitiveEventIndex | null>;
export declare function readCognitiveEvent(workspaceRoot: string, eventId: string): Promise<CognitiveEvent | null>;
export declare function writeCognitiveEvent(workspaceRoot: string, event: CognitiveEvent): Promise<void>;
export declare function readAllCognitiveEvents(workspaceRoot: string): Promise<CognitiveEvent[]>;
export declare function readAdrRecord(workspaceRoot: string, adrId: string): Promise<AdrRecord | null>;
export declare function writeAdrRecord(workspaceRoot: string, adr: AdrRecord): Promise<void>;
export declare function readAllAdrRecords(workspaceRoot: string): Promise<AdrRecord[]>;
export declare function persistCilIndex(workspaceRoot: string, eventIds: string[], adrIds: string[], projections?: CognitiveEventIndex['projections']): Promise<CognitiveEventIndex>;
//# sourceMappingURL=eventStore.d.ts.map