import * as fs from 'node:fs/promises';
import { conflictsFile } from './paths.js';

export interface McpStateConflictSource {
  source: string;
  detail: string;
}

export interface McpStateConflict {
  id: string;
  type: string;
  title: string;
  sources: McpStateConflictSource[];
  status: string;
  action: string;
  detectedAt: number;
}

export interface McpConflictsArtifact {
  version: number;
  generatedAt: number;
  conflicts: McpStateConflict[];
}

export async function loadStateConflicts(workspaceRoot: string): Promise<McpConflictsArtifact | null> {
  const fp = conflictsFile(workspaceRoot);
  try {
    const text = await fs.readFile(fp, 'utf8');
    const o = JSON.parse(text) as Record<string, unknown>;
    if (!o || o.version !== 1) {
      return null;
    }
    const conflicts: McpStateConflict[] = [];
    if (Array.isArray(o.conflicts)) {
      for (const item of o.conflicts) {
        if (!item || typeof item !== 'object') {
          continue;
        }
        const c = item as Record<string, unknown>;
        const sources: McpStateConflictSource[] = [];
        if (Array.isArray(c.sources)) {
          for (const s of c.sources) {
            if (s && typeof s === 'object' && typeof (s as { detail?: string }).detail === 'string') {
              sources.push({
                source: String((s as { source?: string }).source ?? 'unknown'),
                detail: (s as { detail: string }).detail,
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
  } catch {
    return null;
  }
}
