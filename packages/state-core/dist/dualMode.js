"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveStateEngineMode = resolveStateEngineMode;
exports.mergeStateWithScan = mergeStateWithScan;
exports.buildDualModeInput = buildDualModeInput;
/** Resolve engine mode from available inputs. */
function resolveStateEngineMode(eventCount, hasExistingState) {
    if (eventCount > 0 && hasExistingState) {
        return 'merged';
    }
    if (eventCount > 0) {
        return 'event-driven';
    }
    return 'scan-driven';
}
function mergeRecentFileLists(existing, scanned) {
    const seen = new Set();
    const out = [];
    const push = (p) => {
        const n = p.replace(/\\/g, '/').trim();
        if (!n || seen.has(n)) {
            return;
        }
        seen.add(n);
        out.push(n);
    };
    for (const p of scanned) {
        push(p);
    }
    for (const p of existing) {
        push(p);
    }
    return out.slice(0, 24);
}
/** Merge scan facts into state without overwriting user task/notes. */
function mergeStateWithScan(state, scan) {
    const recent = mergeRecentFileLists(state.recentFiles, scan.recentFiles);
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
function buildDualModeInput(args) {
    const hasState = args.state.lastUpdated > 0 || args.state.currentTask.length > 0;
    const mode = resolveStateEngineMode(args.eventCount, hasState);
    const merged = mode === 'merged' || mode === 'scan-driven'
        ? mergeStateWithScan(args.state, args.scan)
        : args.state;
    return { mode, state: merged, eventCount: args.eventCount, scan: args.scan };
}
