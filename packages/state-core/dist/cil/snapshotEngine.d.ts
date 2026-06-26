import type { AdrRecord, CognitiveEvent, ProjectSnapshotRecord } from './types.js';
export declare function linkEventVersions(events: CognitiveEvent[]): CognitiveEvent[];
export declare function writeProjectSnapshot(workspaceRoot: string, events: CognitiveEvent[], decisions?: AdrRecord[]): Promise<ProjectSnapshotRecord>;
export declare function readProjectSnapshot(workspaceRoot: string, snapshotId: string): Promise<ProjectSnapshotRecord | null>;
export declare function findSnapshotByDate(workspaceRoot: string, dateStr: string): Promise<ProjectSnapshotRecord | null>;
export declare function listProjectSnapshots(workspaceRoot: string): Promise<ProjectSnapshotRecord[]>;
//# sourceMappingURL=snapshotEngine.d.ts.map