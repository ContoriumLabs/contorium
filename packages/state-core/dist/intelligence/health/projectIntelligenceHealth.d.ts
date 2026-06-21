import type { ProjectIntelligenceHealth } from '../types.js';
/** v1.2+ — intelligence asset completeness & weighted health score */
export declare function deriveProjectIntelligenceHealth(workspaceRoot: string): Promise<ProjectIntelligenceHealth>;
export declare function readProjectIntelligenceHealth(workspaceRoot: string): Promise<ProjectIntelligenceHealth | null>;
//# sourceMappingURL=projectIntelligenceHealth.d.ts.map