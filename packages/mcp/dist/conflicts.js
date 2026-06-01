import * as fs from 'node:fs/promises';
import { conflictsFile } from './paths.js';
export async function loadStateConflicts(workspaceRoot) {
    const fp = conflictsFile(workspaceRoot);
    try {
        const text = await fs.readFile(fp, 'utf8');
        const o = JSON.parse(text);
        if (!o || o.version !== 1) {
            return null;
        }
        const conflicts = [];
        if (Array.isArray(o.conflicts)) {
            for (const item of o.conflicts) {
                if (!item || typeof item !== 'object') {
                    continue;
                }
                const c = item;
                const sources = [];
                if (Array.isArray(c.sources)) {
                    for (const s of c.sources) {
                        if (s && typeof s === 'object' && typeof s.detail === 'string') {
                            sources.push({
                                source: String(s.source ?? 'unknown'),
                                detail: s.detail,
                            });
                        }
                    }
                }
                conflicts.push({
                    id: typeof c.id === 'string' ? c.id : 'conf_unknown',
                    type: typeof c.type === 'string' ? c.type : 'unknown',
                    title: typeof c.title === 'string' ? c.title : 'Conflict',
                    sources,
                    status: typeof c.status === 'string' ? c.status : 'UNRESOLVED',
                    action: typeof c.action === 'string' ? c.action : 'Developer review required',
                    detectedAt: typeof c.detectedAt === 'number' ? c.detectedAt : 0,
                });
            }
        }
        return {
            version: 1,
            generatedAt: typeof o.generatedAt === 'number' ? o.generatedAt : 0,
            conflicts,
        };
    }
    catch {
        return null;
    }
}
