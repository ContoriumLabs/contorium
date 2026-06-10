import { buildCognitiveInsights } from './cognitiveOverlay.js';
import { isCognitiveOverlayEnabled, readCognitiveMode, writeCognitiveMode } from './modeStore.js';
/** Single entry for set_cognitive_mode, dashboard panel, and hotkey — same logic everywhere. */
export async function applyCognitiveModeChange(workspaceRoot, mode, source = 'mcp') {
    const writer = source === 'panel' || source === 'hotkey' ? 'user' : source;
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
export async function readCognitiveModeSummary(workspaceRoot) {
    const state = await readCognitiveMode(workspaceRoot);
    return {
        mode: state.mode,
        cognitive_overlay_enabled: isCognitiveOverlayEnabled(state.mode),
        updatedAt: state.updatedAt,
    };
}
