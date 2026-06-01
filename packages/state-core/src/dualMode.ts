import type { BootstrapStateJson, DualModeInput, StateEngineMode, WorkspaceScanFacts } from './types.js';

/** Resolve engine mode from available inputs. */
export function resolveStateEngineMode(
  eventCount: number,
  hasExistingState: boolean,
): StateEngineMode {
  if (eventCount > 0 && hasExistingState) {
    return 'merged';
  }
  if (eventCount > 0) {
    return 'event-driven';
  }
  return 'scan-driven';
}

/** Merge scan facts into state without overwriting user task/notes. */
export function mergeStateWithScan(
  state: BootstrapStateJson,
  scan: WorkspaceScanFacts,
): BootstrapStateJson {
  const recent =
    state.recentFiles.length > 0
      ? state.recentFiles
      : scan.recentFiles.slice(0, 20);
  const gitStaged = state.gitStaged.length > 0 ? state.gitStaged : scan.gitStaged;
  const gitWorking = state.gitWorking.length > 0 ? state.gitWorking : scan.gitWorking;
  return {
    ...state,
    recentFiles: recent,
    gitStaged,
    gitWorking,
    lastUpdated: Math.max(state.lastUpdated, scan.scannedAt),
  };
}

export function buildDualModeInput(args: {
  state: BootstrapStateJson;
  eventCount: number;
  scan: WorkspaceScanFacts;
}): DualModeInput {
  const hasState = args.state.lastUpdated > 0 || args.state.currentTask.length > 0;
  const mode = resolveStateEngineMode(args.eventCount, hasState);
  const merged =
    mode === 'merged' || mode === 'scan-driven'
      ? mergeStateWithScan(args.state, args.scan)
      : args.state;
  return { mode, state: merged, eventCount: args.eventCount, scan: args.scan };
}
