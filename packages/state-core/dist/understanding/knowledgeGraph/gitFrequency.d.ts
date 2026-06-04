import type { BootstrapStateJson } from '../../types.js';
import type { ProjectTimeline } from '../types.js';
/** Git activity weights for Hotspot Layer — from timeline + state.json git paths. */
export declare function buildGitFrequency(timeline: ProjectTimeline | undefined, state: BootstrapStateJson): Map<string, number>;
//# sourceMappingURL=gitFrequency.d.ts.map