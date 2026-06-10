import type { WorkspaceContext } from './contextBuilder.js';
import type { IntentInference, ModelPresetKind, ModelPresetSuggestion } from './types.js';

const PRESET_HINTS: Record<ModelPresetKind, string> = {
  SMART: 'General auto routing — GPT/Claude for mixed tasks',
  FAST: 'Lightweight model for quick edits and small diffs',
  REASON: 'Claude-style extended reasoning for architecture decisions',
  CODE: 'Code-specialized model for implementation and refactors',
  LOCAL: 'Offline/local model for privacy-sensitive workspaces',
};

export function suggestModelPreset(
  ctx: WorkspaceContext,
  intent: IntentInference,
): ModelPresetSuggestion {
  const blob = `${ctx.projectType} ${intent.intent} ${intent.action_pattern} ${ctx.fileTypes.join(' ')}`.toLowerCase();

  let mode: ModelPresetKind = 'SMART';
  let reason = 'Mixed workspace activity — default balanced preset';

  if (/local|offline|privacy|airgap/.test(blob)) {
    mode = 'LOCAL';
    reason = 'Privacy or offline context detected';
  } else if (intent.action_pattern === 'debug' || intent.intent.includes('debug')) {
    mode = 'REASON';
    reason = 'Debugging benefits from extended reasoning';
  } else if (
    /\.ts|\.js|\.py|\.go|\.rs|extension|mcp|backend|refactor/.test(blob) ||
    intent.action_pattern === 'edit' ||
    intent.action_pattern === 'refactor'
  ) {
    mode = 'CODE';
    reason = 'Detected code modification in active project';
  } else if (/docs|readme|explore|spike/.test(blob) || intent.action_pattern === 'explore') {
    mode = 'FAST';
    reason = 'Lightweight exploration or documentation task';
  } else if (/architecture|design|plan|review/.test(blob)) {
    mode = 'REASON';
    reason = 'Architecture or review task detected';
  }

  return {
    mode,
    reason,
    preset_hint: PRESET_HINTS[mode],
  };
}
