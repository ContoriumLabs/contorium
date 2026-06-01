/**
 * Persisted to `.Contorium/state.json` (legacy: `.context-recall/state.json` is read on first load).
 */
export interface StateSourceMetadata {
  mode: 'event-driven' | 'scan-driven' | 'merged';
  lastWriter: 'ide' | 'mcp' | 'cli';
  lastUpdated: string;
}

export interface ProjectState {
  /** Stable session id for Context Engine memory (generated once per workspace). */
  sessionId?: string;
  currentTask: string;
  openFiles: string[];
  recentFiles: string[];
  /** Paths with staged (index) changes */
  gitStaged: string[];
  /** Working-tree paths (modified / untracked / …), non-index */
  gitWorking: string[];
  notes: string;
  lastUpdated: number;
  /** v2.2 — which adapter last wrote state (additive, optional). */
  source?: StateSourceMetadata;
}

export function defaultProjectState(): ProjectState {
  return {
    currentTask: '',
    openFiles: [],
    recentFiles: [],
    gitStaged: [],
    gitWorking: [],
    notes: '',
    lastUpdated: 0,
  };
}
