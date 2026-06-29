import type { ProjectIntentKernel } from './types.js';
/** Derive PIK from PIL/CIL artifacts — goal structure, not event summary. */
export declare function generateProjectIntentKernel(workspaceRoot: string): Promise<ProjectIntentKernel>;
/** Load PIK or derive once when missing / stale focus changed. */
export declare function ensureProjectIntentKernel(workspaceRoot: string): Promise<ProjectIntentKernel>;
//# sourceMappingURL=generator.d.ts.map