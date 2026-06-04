"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildHotspots = buildHotspots;
const closureConstants_js_1 = require("./closureConstants.js");
function basename(p) {
    return p.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? p;
}
function hotspotLifecycle(score) {
    if (score >= closureConstants_js_1.HOTSPOT_SCORE_ACTIVE) {
        return 'active';
    }
    if (score >= closureConstants_js_1.HOTSPOT_SCORE_COOLING) {
        return 'cooling';
    }
    return 'stale';
}
/** Closure §8.2 — edit AND git AND intent (git waived when no git data). */
function hotspotQualifies(args) {
    const hasEdit = args.editCount > 0;
    const hasGit = !args.gitDataAvailable || args.gitCount > 0;
    const hasIntent = args.intentLinks > 0;
    return hasEdit && hasGit && hasIntent;
}
/** Hotspot Layer — activity scoring; AND gate + lifecycle (Closure §8). */
function buildHotspots(input) {
    const gitDataAvailable = input.gitFrequency.size > 0;
    const maxGit = Math.max(1, ...input.gitFrequency.values(), 1);
    const maxEdits = Math.max(1, ...input.editCounts.values(), 1);
    const fnNodes = input.nodes.filter((n) => n.type === 'function');
    const fileNodes = input.nodes.filter((n) => n.type === 'file');
    const intentLinksByFn = new Map();
    for (const m of input.intentMappings) {
        intentLinksByFn.set(m.functionId, (intentLinksByFn.get(m.functionId) ?? 0) + 1);
    }
    const depCount = (id) => input.edges.filter((e) => e.target === id && e.type === 'calls').length +
        input.edges.filter((e) => e.source === id && e.type === 'calls').length;
    const hotspots = [];
    const consider = (args) => {
        const editCount = input.editCounts.get(args.path) ?? 0;
        const gitCount = input.gitFrequency.get(args.path) ?? 0;
        if (!hotspotQualifies({
            editCount,
            gitCount,
            intentLinks: args.intentLinks,
            gitDataAvailable,
        })) {
            return;
        }
        const editFrequency = editCount / maxEdits;
        const gitActivity = gitCount / maxGit;
        const intentWeight = Math.min(1, args.intentLinks / 2);
        const dependencyCount = args.fn ? depCount(args.fn.id) : 0;
        const depNorm = Math.min(1, dependencyCount / 8);
        const score = Math.round((editFrequency * 0.4 + gitActivity * 0.2 + intentWeight * 0.3 + depNorm * 0.1) * 1000) / 1000;
        if (score < closureConstants_js_1.HOTSPOT_SCORE_COOLING) {
            return;
        }
        hotspots.push({
            id: `hotspot_${args.targetKind}_${args.targetId}`,
            type: 'hotspot',
            targetId: args.targetId,
            targetName: args.targetName,
            targetKind: args.targetKind,
            score,
            lifecycle: hotspotLifecycle(score),
            editFrequency: editCount,
            gitActivity: gitCount,
            intentLinks: args.intentLinks,
            dependencyCount,
        });
    };
    for (const file of fileNodes) {
        const path = file.path ?? file.name;
        const linkedFns = fnNodes.filter((f) => f.path === path);
        const intentLinks = linkedFns.reduce((n, f) => n + (intentLinksByFn.get(f.id) ?? 0), 0);
        consider({
            file,
            fn: undefined,
            path,
            targetId: file.id,
            targetName: basename(path),
            targetKind: 'file',
            intentLinks,
        });
    }
    for (const fn of fnNodes.slice(0, 60)) {
        const path = fn.path ?? '';
        consider({
            file: undefined,
            fn,
            path,
            targetId: fn.id,
            targetName: fn.name,
            targetKind: 'function',
            intentLinks: intentLinksByFn.get(fn.id) ?? 0,
        });
    }
    return hotspots
        .sort((a, b) => b.score - a.score)
        .slice(0, input.max ?? closureConstants_js_1.SNAPSHOT_TOP_HOTSPOTS);
}
