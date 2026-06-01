/** Contorium State Engine v2 — conflict-aware artifacts (audit only, no auto-resolution). */

export type StateSource = 'ide' | 'mcp' | 'git' | 'events';

export type StateConflictType = 'goal' | 'decision' | 'module';

export interface StateConflictSource {
  source: StateSource | 'state';
  detail: string;
}

export interface StateConflict {
  id: string;
  type: StateConflictType;
  title: string;
  sources: StateConflictSource[];
  status: 'UNRESOLVED';
  action: 'Developer review required';
  detectedAt: number;
}

export interface ConflictsArtifact {
  version: 1;
  generatedAt: number;
  conflicts: StateConflict[];
}

export interface TaggedEntry {
  text: string;
  source: StateSource;
}

export const CONFLICTS_ARTIFACT_VERSION = 1 as const;

export function emptyConflictsArtifact(now = Date.now()): ConflictsArtifact {
  return {
    version: CONFLICTS_ARTIFACT_VERSION,
    generatedAt: now,
    conflicts: [],
  };
}
