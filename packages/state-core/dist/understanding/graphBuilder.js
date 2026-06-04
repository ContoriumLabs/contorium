"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildChangeNeighborhoodGraph = buildChangeNeighborhoodGraph;
exports.deriveChangeArtifact = deriveChangeArtifact;
const types_js_1 = require("./types.js");
const extractor_js_1 = require("./extractor.js");
const symbolValidator_js_1 = require("./symbolValidator.js");
const MAX_NODES = 240;
const MAX_NEIGHBOR_FILES = 12;
function moduleNodeId(file) {
    return (0, extractor_js_1.nodeId)(file, 'module', file);
}
async function buildChangeNeighborhoodGraph(workspaceRoot, changedFiles, now = Date.now()) {
    const extractions = new Map();
    const neighborFiles = new Set(changedFiles);
    for (const file of changedFiles) {
        const ext = await (0, extractor_js_1.extractFile)(workspaceRoot, file);
        if (!ext) {
            continue;
        }
        extractions.set(file, (0, symbolValidator_js_1.refineExtraction)(ext));
        for (const sym of ext.symbols) {
            if (sym.kind === 'import' && sym.importTarget) {
                const resolved = (0, extractor_js_1.resolveRelativeImport)(file, sym.importTarget);
                if (resolved && neighborFiles.size < changedFiles.length + MAX_NEIGHBOR_FILES) {
                    neighborFiles.add(resolved);
                }
            }
        }
    }
    for (const file of neighborFiles) {
        if (extractions.has(file)) {
            continue;
        }
        const ext = await (0, extractor_js_1.extractFile)(workspaceRoot, file);
        if (ext) {
            extractions.set(file, (0, symbolValidator_js_1.refineExtraction)(ext));
        }
    }
    const nodes = [];
    const edges = [];
    for (const [file, ext] of extractions) {
        nodes.push({ id: moduleNodeId(file), kind: 'module', name: file, file });
        for (const sym of ext.symbols) {
            const id = (0, extractor_js_1.nodeId)(file, sym.kind, sym.name);
            if (sym.kind === 'function' || sym.kind === 'class') {
                nodes.push({ id, kind: sym.kind, name: sym.name, file, line: sym.line });
                edges.push({ from: moduleNodeId(file), to: id, kind: 'contains' });
            }
            else if (sym.kind === 'import') {
                nodes.push({ id, kind: 'import', name: sym.name, file, line: sym.line });
                edges.push({ from: moduleNodeId(file), to: id, kind: 'imports' });
            }
        }
    }
    for (const [file, ext] of extractions) {
        const localFns = new Set((0, extractor_js_1.symbolNamesByKind)(ext, 'function'));
        for (const call of ext.calls) {
            if (!localFns.has(call)) {
                continue;
            }
            const fromCandidates = ext.symbols.filter((s) => s.kind === 'function');
            for (const caller of fromCandidates) {
                const fromId = (0, extractor_js_1.nodeId)(file, 'function', caller.name);
                const toId = (0, extractor_js_1.nodeId)(file, 'function', call);
                if (fromId !== toId) {
                    edges.push({ from: fromId, to: toId, kind: 'calls' });
                }
            }
        }
    }
    const cappedNodes = nodes.slice(0, MAX_NODES);
    const nodeIds = new Set(cappedNodes.map((n) => n.id));
    const cappedEdges = edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to)).slice(0, MAX_NODES * 2);
    return {
        graph: {
            version: 2,
            generatedAt: now,
            scope: 'change-neighborhood',
            nodes: cappedNodes,
            edges: cappedEdges,
        },
        extractions,
    };
}
function deriveChangeArtifact(changedFiles, extractions, now = Date.now()) {
    const key_changes = [];
    for (const file of changedFiles) {
        key_changes.push({ symbol: file, kind: 'file', change_type: 'modified' });
        const ext = extractions.get(file);
        if (!ext) {
            continue;
        }
        for (const fn of (0, extractor_js_1.symbolNamesByKind)(ext, 'function')) {
            key_changes.push({ symbol: `${file}::${fn}`, kind: 'function', change_type: 'modified' });
        }
        for (const cls of (0, extractor_js_1.symbolNamesByKind)(ext, 'class')) {
            key_changes.push({ symbol: `${file}::${cls}`, kind: 'class', change_type: 'modified' });
        }
    }
    return {
        version: types_js_1.UNDERSTANDING_VERSION,
        generatedAt: now,
        changed_files: changedFiles,
        key_changes,
    };
}
