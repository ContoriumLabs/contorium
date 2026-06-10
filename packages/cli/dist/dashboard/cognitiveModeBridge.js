import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
const DEFAULT_HOTKEY = { panel_key: 'm', panel_accelerator: 'Ctrl+Alt+C' };
export async function readDashboardCognitiveHotkey(workspaceRoot) {
    const envKey = process.env.CONTORIUM_COGNITIVE_PANEL_KEY?.trim();
    if (envKey?.length === 1) {
        return { ...DEFAULT_HOTKEY, panel_key: envKey };
    }
    try {
        const raw = JSON.parse(await fs.readFile(path.join(workspaceRoot, '.contora/mcp/cognitive.hotkey.json'), 'utf8'));
        return {
            panel_key: raw.panel_key ?? DEFAULT_HOTKEY.panel_key,
            panel_accelerator: raw.panel_accelerator ?? DEFAULT_HOTKEY.panel_accelerator,
        };
    }
    catch {
        return { ...DEFAULT_HOTKEY };
    }
}
const MODE_SCHEMA_VERSION = 2;
/** v1 had A=overlay B=core; v2 has A=core B=overlay */
function migrateMode(raw) {
    if (raw.mode !== 'A' && raw.mode !== 'B') {
        return 'A';
    }
    if (raw.schemaVersion === MODE_SCHEMA_VERSION) {
        return raw.mode;
    }
    return raw.mode === 'A' ? 'B' : 'A';
}
export async function readDashboardCognitiveMode(workspaceRoot) {
    try {
        const raw = JSON.parse(await fs.readFile(path.join(workspaceRoot, '.contora/mcp/cognitive.mode.json'), 'utf8'));
        return migrateMode(raw);
    }
    catch {
        return 'A';
    }
}
/** Dashboard panel → same logic as set_cognitive_mode (dynamic import MCP when available). */
export async function applyCognitiveModeFromDashboard(workspaceRoot, mode) {
    const repo = process.env.CONTORIUM_REPO;
    const applyPath = repo ? path.join(repo, 'packages/mcp/dist/cognitive/modeApply.js') : '';
    if (applyPath) {
        try {
            await fs.access(applyPath);
            const mod = (await import(pathToFileURL(applyPath).href));
            await mod.applyCognitiveModeChange(workspaceRoot, mode, 'panel');
            return { ok: true, hint: `Mode ${mode} applied — insights ${mode === 'B' ? 'rebuilt' : 'disabled'}` };
        }
        catch {
            /* fallback below */
        }
    }
    const fp = path.join(workspaceRoot, '.contora/mcp/cognitive.mode.json');
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, `${JSON.stringify({ mode, updatedAt: new Date().toISOString(), source: 'user' }, null, 2)}\n`, 'utf8');
    return {
        ok: true,
        hint: `Mode ${mode} saved — restart MCP sync for full insights rebuild`,
    };
}
export function isCtrlAltC(raw) {
    return raw.includes('\u001b') && /c/i.test(raw);
}
