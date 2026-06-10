import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { COGNITIVE_MODE_SCHEMA_VERSION, } from './types.js';
const MODE_FILE = 'cognitive.mode.json';
function modePath(workspaceRoot) {
    return path.join(path.resolve(workspaceRoot), '.contora', 'mcp', MODE_FILE);
}
function defaultModeState() {
    return {
        mode: 'A',
        updatedAt: new Date(0).toISOString(),
        source: 'mcp',
        schemaVersion: COGNITIVE_MODE_SCHEMA_VERSION,
    };
}
/** v1 had A=overlay B=core; v2 has A=core B=overlay — invert legacy values. */
export function migrateCognitiveMode(raw) {
    if (raw.mode !== 'A' && raw.mode !== 'B') {
        return defaultModeState();
    }
    if (raw.schemaVersion === COGNITIVE_MODE_SCHEMA_VERSION) {
        return raw;
    }
    return {
        mode: raw.mode === 'A' ? 'B' : 'A',
        updatedAt: raw.updatedAt,
        source: raw.source,
        schemaVersion: COGNITIVE_MODE_SCHEMA_VERSION,
    };
}
/** Default A = core runtime. Mode B enables cognitive overlay (includes A). */
export async function readCognitiveMode(workspaceRoot) {
    try {
        const raw = JSON.parse(await fs.readFile(modePath(workspaceRoot), 'utf8'));
        if (raw.mode === 'A' || raw.mode === 'B') {
            return migrateCognitiveMode(raw);
        }
    }
    catch {
        /* default */
    }
    return defaultModeState();
}
export function isCognitiveOverlayEnabled(mode) {
    return mode === 'B';
}
export async function writeCognitiveMode(workspaceRoot, mode, source = 'mcp') {
    const payload = {
        mode,
        updatedAt: new Date().toISOString(),
        source,
        schemaVersion: COGNITIVE_MODE_SCHEMA_VERSION,
    };
    const fp = modePath(workspaceRoot);
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return payload;
}
