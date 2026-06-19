import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
/** Resolve sibling @contorium/mcp dist module (monorepo dev layout). */
export function resolveMcpDistModule(relativePath) {
    const candidates = [
        path.join(here, '../../mcp/dist', relativePath),
        path.join(here, '../../../mcp/dist', relativePath),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return undefined;
}
export async function importMcpGovernanceV4() {
    const modPath = resolveMcpDistModule('governanceV4.js');
    if (!modPath) {
        return null;
    }
    const { pathToFileURL } = await import('node:url');
    return import(pathToFileURL(modPath).href);
}
