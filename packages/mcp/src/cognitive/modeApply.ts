import { buildCognitiveInsights } from './cognitiveOverlay.js';
import { isCognitiveOverlayEnabled, readCognitiveMode, writeCognitiveMode } from './modeStore.js';
import type { CognitiveInsights, CognitiveModeState, ContoriumMcpMode } from './types.js';

export type CognitiveModeSource = 'mcp' | 'user' | 'agent' | 'panel' | 'hotkey';

export interface ApplyCognitiveModeResult {
  workspaceRoot: string;
  mode: CognitiveModeState;
  cognitive_overlay_enabled: boolean;
  insights?: CognitiveInsights;
  hint?: string;
}

/** Single entry for set_cognitive_mode, dashboard panel, and hotkey — same logic everywhere. */
export async function applyCognitiveModeChange(
  workspaceRoot: string,
  mode: ContoriumMcpMode,
  source: CognitiveModeSource = 'mcp',
): Promise<ApplyCognitiveModeResult> {
  const writer: CognitiveModeState['source'] =
    source === 'panel' || source === 'hotkey' ? 'user' : source;
  const state = await writeCognitiveMode(workspaceRoot, mode, writer);
  const enabled = isCognitiveOverlayEnabled(state.mode);

  if (mode === 'B') {
    const insights = await buildCognitiveInsights(workspaceRoot);
    return {
      workspaceRoot,
      mode: state,
      cognitive_overlay_enabled: enabled,
      insights,
      hint: 'Mode B — core (A) + cognitive overlay active (read-only suggestions).',
    };
  }

  return {
    workspaceRoot,
    mode: state,
    cognitive_overlay_enabled: enabled,
    hint: 'Mode A — core runtime. Existing Contorium runtime unchanged.',
  };
}

export async function readCognitiveModeSummary(workspaceRoot: string): Promise<{
  mode: ContoriumMcpMode;
  cognitive_overlay_enabled: boolean;
  updatedAt: string;
}> {
  const state = await readCognitiveMode(workspaceRoot);
  return {
    mode: state.mode,
    cognitive_overlay_enabled: isCognitiveOverlayEnabled(state.mode),
    updatedAt: state.updatedAt,
  };
}
