import type { AdapterKind, StateEngineMode } from '../types.js';
import type { ProjectIdentity, ProjectIntelligenceRepositoryState, ProjectIntelligenceSnapshot } from './types.js';
/**
 * Project Intelligence Repository sync v1.1.3
 * Capture · Structure · Preserve — descriptive records only.
 */
export declare function syncProjectIntelligenceRepository(workspaceRoot: string, writer: AdapterKind, mode?: StateEngineMode, prevIdentity?: ProjectIdentity | null): Promise<{
    repository: ProjectIntelligenceRepositoryState;
    snapshot: ProjectIntelligenceSnapshot;
}>;
/** @deprecated use syncProjectIntelligenceRepository */
export declare const runCognitiveEngine: typeof syncProjectIntelligenceRepository;
//# sourceMappingURL=projectIntelligenceSync.d.ts.map