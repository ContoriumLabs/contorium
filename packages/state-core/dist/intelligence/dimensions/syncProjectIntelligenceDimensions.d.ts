import type { AdapterKind, StateEngineMode } from '../../types.js';
import type { ProjectIdentity } from '../types.js';
/** Capture · Structure · Preserve — descriptive intelligence dimensions only. */
export declare function syncProjectIntelligenceDimensions(workspaceRoot: string, writer: AdapterKind, _mode?: StateEngineMode, prevIdentity?: ProjectIdentity | null): Promise<void>;
/** @deprecated use syncProjectIntelligenceDimensions */
export declare const syncCognitiveDimensions: typeof syncProjectIntelligenceDimensions;
//# sourceMappingURL=syncProjectIntelligenceDimensions.d.ts.map