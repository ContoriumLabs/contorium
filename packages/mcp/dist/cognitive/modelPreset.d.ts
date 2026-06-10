import type { WorkspaceContext } from './contextBuilder.js';
import type { IntentInference, ModelPresetSuggestion } from './types.js';
export declare function suggestModelPreset(ctx: WorkspaceContext, intent: IntentInference): ModelPresetSuggestion;
