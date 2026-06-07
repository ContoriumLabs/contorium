"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatUnderstandingMiniGraph = formatUnderstandingMiniGraph;
/** Compact ASCII call chain for Passive status bar (optional mini-graph). */
function formatUnderstandingMiniGraph(graph, maxWidth = 40) {
    if (!graph?.call_chain?.length) {
        return undefined;
    }
    const chain = graph.call_chain
        .slice(0, 4)
        .map((s) => s.replace(/\(\)$/, ''))
        .join('→');
    const text = `⤷ ${chain}`;
    if (text.length <= maxWidth) {
        return text;
    }
    return `${text.slice(0, Math.max(8, maxWidth - 1))}…`;
}
