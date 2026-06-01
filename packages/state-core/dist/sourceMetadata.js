"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachStateSource = attachStateSource;
exports.parseStateSource = parseStateSource;
function attachStateSource(state, mode, writer) {
    const source = {
        mode,
        lastWriter: writer,
        lastUpdated: new Date().toISOString(),
    };
    return { ...state, source };
}
function parseStateSource(raw) {
    if (!raw || typeof raw !== 'object') {
        return undefined;
    }
    const o = raw;
    const mode = o.mode;
    const lastWriter = o.lastWriter;
    const lastUpdated = o.lastUpdated;
    if ((mode !== 'event-driven' && mode !== 'scan-driven' && mode !== 'merged') ||
        (lastWriter !== 'ide' && lastWriter !== 'mcp' && lastWriter !== 'cli') ||
        typeof lastUpdated !== 'string') {
        return undefined;
    }
    return { mode, lastWriter, lastUpdated };
}
