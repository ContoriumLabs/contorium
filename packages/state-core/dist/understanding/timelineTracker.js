"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProjectTimeline = buildProjectTimeline;
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
function norm(p) {
    return p.replace(/\\/g, '/');
}
function graphRef(kind, name) {
    return `${kind}:${name}`;
}
function riskFromChangeCount(n) {
    if (n >= 4) {
        return 'high';
    }
    if (n >= 2) {
        return 'medium';
    }
    return 'low';
}
async function recentGitCommits(workspaceRoot, max = 5) {
    try {
        const { stdout } = await execFileAsync('git', ['-C', workspaceRoot, 'log', `-${max}`, '--pretty=format:---%n%H|%ct', '--name-status'], { timeout: 15_000, maxBuffer: 2 * 1024 * 1024 });
        const rows = [];
        let current;
        for (const line of stdout.split('\n')) {
            if (line === '---') {
                current = undefined;
                continue;
            }
            const header = line.match(/^([0-9a-f]{7,40})\|(\d+)$/);
            if (header) {
                current = { hash: header[1], timestamp: Number(header[2]) * 1000 };
                continue;
            }
            if (!current || line.length < 2) {
                continue;
            }
            const status = line[0];
            const file = norm(line.slice(1).trim().split('\t').pop() ?? line.slice(2).trim());
            if (!file) {
                continue;
            }
            let type = 'modify';
            if (status === 'A') {
                type = 'add';
            }
            else if (status === 'D') {
                type = 'delete';
            }
            else if (status === 'R') {
                type = 'rename';
            }
            rows.push({ hash: current.hash, timestamp: current.timestamp, type, file });
        }
        return rows;
    }
    catch {
        return [];
    }
}
function keyChangesForFile(change, file) {
    return change.key_changes.filter((k) => (k.kind === 'file' && k.symbol === file) || k.symbol.startsWith(`${file}::`));
}
function linkedNodes(graph, file, keyChanges) {
    const names = new Set(keyChanges.map((k) => k.symbol.split('::').pop() ?? k.symbol));
    const refs = [];
    for (const n of graph.nodes) {
        if (n.file !== file) {
            continue;
        }
        if (names.has(n.name)) {
            refs.push(graphRef(n.kind, n.name));
        }
    }
    return refs.slice(0, 8);
}
async function buildProjectTimeline(workspaceRoot, changedFiles, change, graph, now = Date.now(), maxCommits = 5) {
    const commits = await recentGitCommits(workspaceRoot, maxCommits);
    const watch = new Set(changedFiles.map(norm));
    const byFile = new Map();
    for (const row of commits) {
        if (!watch.has(row.file) && !changedFiles.some((f) => row.file.startsWith(f))) {
            continue;
        }
        const kc = keyChangesForFile(change, row.file);
        const entry = {
            commit: row.hash.slice(0, 7),
            timestamp: row.timestamp,
            type: row.type,
            file: row.file,
            changes: kc.map((k) => ({
                symbol: k.symbol.split('::').pop() ?? k.symbol,
                change: k.change_type === 'added' ? 'symbol_added' : 'logic_modified',
            })),
            impact_level: riskFromChangeCount(kc.length),
            linked_graph_nodes: linkedNodes(graph, row.file, kc),
        };
        const list = byFile.get(row.file) ?? [];
        list.push(entry);
        byFile.set(row.file, list);
    }
    const files = [...byFile.entries()].map(([file, history]) => ({ file, history }));
    const recent = commits
        .filter((r) => watch.has(r.file))
        .slice(0, maxCommits)
        .map((row) => {
        const kc = keyChangesForFile(change, row.file);
        return {
            commit: row.hash.slice(0, 7),
            timestamp: row.timestamp,
            type: row.type,
            file: row.file,
            changes: kc.map((k) => ({
                symbol: k.symbol.split('::').pop() ?? k.symbol,
                change: k.change_type === 'added' ? 'symbol_added' : 'logic_modified',
            })),
            impact_level: riskFromChangeCount(kc.length),
            linked_graph_nodes: linkedNodes(graph, row.file, kc),
        };
    });
    return {
        version: 1,
        generatedAt: now,
        files,
        recent,
    };
}
