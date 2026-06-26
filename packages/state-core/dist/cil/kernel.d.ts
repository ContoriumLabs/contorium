/**
 * Cognitive Kernel — single dispatch center for CIL v3.
 * All engines are invoked only from here (Kernel First Principle).
 */
import type { AdapterKind } from '../types.js';
import { readProjectSnapshot } from './snapshotEngine.js';
import type { KernelInput, KernelOutput } from './types.js';
/** Cognitive Kernel — the only orchestration entry for CIL. */
export declare function runCognitiveKernel(workspaceRoot: string, input: KernelInput, writer?: AdapterKind): Promise<KernelOutput>;
export declare function syncCognitiveInteractionLayer(workspaceRoot: string, writer?: AdapterKind): Promise<{
    events: unknown[];
    adrs: unknown[];
}>;
export { readProjectSnapshot };
//# sourceMappingURL=kernel.d.ts.map