import type { AskProjectResult, CilStructuredResponse, KernelOutput } from './types.js';
export declare function buildStructuredResponse(output: KernelOutput): CilStructuredResponse;
export declare function kernelOutputToAskResult(query: string, output: KernelOutput): AskProjectResult;
//# sourceMappingURL=formatter.d.ts.map