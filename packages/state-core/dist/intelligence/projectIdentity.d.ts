import type { AdapterKind } from '../types.js';
import type { ProjectIdentity } from './types.js';
export declare function readProjectIdentity(workspaceRoot: string): Promise<ProjectIdentity | null>;
export declare function syncProjectIdentity(workspaceRoot: string, writer: AdapterKind, syncMode?: ProjectIdentity['sync_mode']): Promise<ProjectIdentity>;
//# sourceMappingURL=projectIdentity.d.ts.map