import type { BootstrapStateJson } from '../types.js';
import type { ChangeArtifact, IntentFusion } from './types.js';
import type { ProjectBuiltState } from '../state-builder/types.js';
export declare function fuseIntent(args: {
    state: BootstrapStateJson;
    change: ChangeArtifact;
    built?: ProjectBuiltState | null;
}): IntentFusion;
//# sourceMappingURL=intentFusion.d.ts.map