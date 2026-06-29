import type { KernelOutput } from './types.js';
import type { ProjectIntentKernel } from './pik/types.js';
import { type FusedSemanticContext } from './semantic/fusion.js';
export interface AskV2Context {
    pik: ProjectIntentKernel;
    fusion: FusedSemanticContext;
    isDirection: boolean;
    isDrift: boolean;
}
export declare function prepareAskV2Context(workspaceRoot: string, question: string): Promise<AskV2Context>;
/** PIK-first answer for direction / identity / drift questions. */
export declare function buildDirectionKernelOutput(question: string, ctx: AskV2Context): KernelOutput;
/** Append alignment note when drift is significant on non-direction queries. */
export declare function appendAlignmentNote(answer: string, fusion: FusedSemanticContext): string;
//# sourceMappingURL=askV2.d.ts.map