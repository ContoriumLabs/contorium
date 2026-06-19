import type { ChangeLog, CognitiveGraph, CognitiveIntent, CognitiveRisk, Constitution, Identity, ProjectCognitiveState, TruthLayer, UserRequestOverlay, GuardSession } from './types.js';
export declare function governanceExists(workspaceRoot: string): Promise<boolean>;
export declare function readConstitution(workspaceRoot: string): Promise<Constitution | undefined>;
export declare function writeConstitution(workspaceRoot: string, data: Constitution): Promise<void>;
export declare function readTruthLayer(workspaceRoot: string): Promise<TruthLayer | undefined>;
export declare function writeTruthLayer(workspaceRoot: string, data: TruthLayer): Promise<void>;
export declare function readIdentity(workspaceRoot: string): Promise<Identity | undefined>;
export declare function writeIdentity(workspaceRoot: string, data: Identity): Promise<void>;
export declare function writeCognitiveState(workspaceRoot: string, data: ProjectCognitiveState): Promise<void>;
export declare function writeCognitiveIntent(workspaceRoot: string, data: CognitiveIntent): Promise<void>;
export declare function writeCognitiveRisk(workspaceRoot: string, data: CognitiveRisk): Promise<void>;
export declare function writeCognitiveGraph(workspaceRoot: string, data: CognitiveGraph): Promise<void>;
export declare function readCognitiveState(workspaceRoot: string): Promise<ProjectCognitiveState | undefined>;
export declare function readCognitiveIntent(workspaceRoot: string): Promise<CognitiveIntent | undefined>;
export declare function readCognitiveGraph(workspaceRoot: string): Promise<CognitiveGraph | undefined>;
/** User-owned request overlay (merged into derived cognitive — not a second truth). */
export declare function readUserRequestOverlay(workspaceRoot: string): Promise<UserRequestOverlay | undefined>;
export declare function writeUserRequestOverlay(workspaceRoot: string, data: UserRequestOverlay): Promise<void>;
export declare function readGuardSession(workspaceRoot: string): Promise<GuardSession | undefined>;
export declare function writeGuardSession(workspaceRoot: string, data: GuardSession): Promise<void>;
export declare function readChangeLog(workspaceRoot: string): Promise<ChangeLog | undefined>;
export declare function writeChangeLog(workspaceRoot: string, data: ChangeLog): Promise<void>;
export declare function appendExecutionLog(workspaceRoot: string, entry: Record<string, unknown>): Promise<void>;
//# sourceMappingURL=store.d.ts.map