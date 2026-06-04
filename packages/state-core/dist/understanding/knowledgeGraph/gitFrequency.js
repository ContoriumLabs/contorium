"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGitFrequency = buildGitFrequency;
function norm(p) {
    return p.replace(/\\/g, '/');
}
/** Git activity weights for Hotspot Layer — from timeline + state.json git paths. */
function buildGitFrequency(timeline, state) {
    const freq = new Map();
    for (const e of timeline?.recent ?? []) {
        const f = norm(e.file);
        freq.set(f, (freq.get(f) ?? 0) + 1);
    }
    for (const p of [...state.gitStaged, ...state.gitWorking]) {
        const f = norm(p);
        freq.set(f, (freq.get(f) ?? 0) + 2);
    }
    return freq;
}
