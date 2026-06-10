import type { WorkspaceContext } from './contextBuilder.js';
import type { IntentInference } from './types.js';
export declare function inferIntent(ctx: WorkspaceContext): IntentInference;
export declare function generateKeywords(ctx: WorkspaceContext, intent: IntentInference): string[];
