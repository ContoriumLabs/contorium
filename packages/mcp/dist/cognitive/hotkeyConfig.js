import * as fs from 'node:fs/promises';
import * as path from 'node:path';
const DEFAULT_CONFIG = {
    version: 1,
    panel_accelerator: 'Ctrl+Alt+C',
    panel_key: 'm',
};
function configPath(workspaceRoot) {
    return path.join(path.resolve(workspaceRoot), '.contora', 'mcp', 'cognitive.hotkey.json');
}
export async function readCognitiveHotkeyConfig(workspaceRoot) {
    try {
        const raw = JSON.parse(await fs.readFile(configPath(workspaceRoot), 'utf8'));
        if (raw.version === 1) {
            return {
                ...DEFAULT_CONFIG,
                ...raw,
            };
        }
    }
    catch {
        /* default */
    }
    const envKey = process.env.CONTORIUM_COGNITIVE_PANEL_KEY?.trim();
    if (envKey?.length === 1) {
        return { ...DEFAULT_CONFIG, panel_key: envKey };
    }
    return { ...DEFAULT_CONFIG };
}
export async function writeCognitiveHotkeyConfig(workspaceRoot, patch) {
    const current = await readCognitiveHotkeyConfig(workspaceRoot);
    const next = { ...current, ...patch, version: 1 };
    const fp = configPath(workspaceRoot);
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    return next;
}
/** Detect Ctrl+Alt+C style sequences in raw TTY input (best-effort). */
export function isPanelAcceleratorChunk(raw, accelerator = 'Ctrl+Alt+C') {
    if (accelerator !== 'Ctrl+Alt+C') {
        return false;
    }
    if (raw.includes('\u001b') && (raw.includes('c') || raw.includes('C'))) {
        return true;
    }
    return raw === '\u0003' || raw === '\u0018';
}
