import * as fs from 'node:fs';
import * as path from 'node:path';
const WATCH_BASENAMES = new Set([
    'state.json',
    'change.json',
    'handoff.json',
    'graph.json',
    'understanding_graph.json',
    'timeline.json',
    'dashboard.signal.json',
    'dashboard.activity.json',
    'runtime.bootstrap.json',
    'mcp.handoff-injection.json',
]);
/**
 * fs.watch-based artifact refresh (replaces tight polling on large repos).
 * Falls back silently when .contora is missing.
 */
export function watchContoraArtifacts(workspaceRoot, onChange) {
    const contora = path.join(workspaceRoot, '.contora');
    let debounce;
    let watcher;
    const trigger = () => {
        if (debounce) {
            clearTimeout(debounce);
        }
        debounce = setTimeout(() => {
            debounce = undefined;
            onChange();
        }, 120);
    };
    const attach = () => {
        try {
            watcher?.close();
            watcher = fs.watch(contora, { recursive: true }, (_event, filename) => {
                if (!filename) {
                    trigger();
                    return;
                }
                const norm = String(filename).replace(/\\/g, '/');
                const base = path.basename(norm);
                if (WATCH_BASENAMES.has(base) || norm.startsWith('events/')) {
                    trigger();
                }
            });
            watcher.on('error', () => {
                watcher?.close();
                watcher = undefined;
            });
        }
        catch {
            watcher = undefined;
        }
    };
    try {
        if (fs.existsSync(contora)) {
            attach();
        }
        else {
            const parent = path.dirname(contora);
            const bootstrap = fs.watch(parent, (_event, filename) => {
                if (filename === '.contora') {
                    attach();
                }
            });
            watcher = bootstrap;
        }
    }
    catch {
        // no watch — caller keeps signal/session polling only
    }
    return () => {
        if (debounce) {
            clearTimeout(debounce);
        }
        watcher?.close();
    };
}
