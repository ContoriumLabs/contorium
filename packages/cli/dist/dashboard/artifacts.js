import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { readChangeArtifact, readHandoffArtifact, readHandoffInjectionState, readKnowledgeSnapshot, readProjectGraph, readProjectTimeline, readUnderstandingGraph, readWorkspaceStatus, } from '@contora/state-core';
const ARTIFACT_FILES = [
    'state.json',
    'change.json',
    'handoff.json',
    'graph.json',
    'graph/knowledge.json',
    'graph/snapshot.json',
    'understanding_graph.json',
    'timeline.json',
    'dashboard.activity.json',
    'dashboard.status.json',
    'mcp.handoff-injection.json',
    'mcp/cognitive.mode.json',
    'mcp/cognitive-insights.json',
];
export async function artifactSignature(workspaceRoot) {
    const contora = path.join(workspaceRoot, '.contora');
    const parts = [];
    for (const rel of ARTIFACT_FILES) {
        try {
            const st = await fs.stat(path.join(contora, rel));
            parts.push(`${rel}:${st.mtimeMs}`);
        }
        catch {
            parts.push(`${rel}:missing`);
        }
    }
    try {
        const eventsDir = path.join(contora, 'events');
        const files = (await fs.readdir(eventsDir)).filter((f) => f.endsWith('.jsonl'));
        for (const f of files.sort()) {
            const st = await fs.stat(path.join(eventsDir, f));
            parts.push(`events/${f}:${st.mtimeMs}:${st.size}`);
        }
    }
    catch {
        parts.push('events:missing');
    }
    return parts.join('|');
}
async function readRecentEvents(workspaceRoot, limit = 8) {
    const eventsDir = path.join(workspaceRoot, '.contora', 'events');
    let files = [];
    try {
        files = (await fs.readdir(eventsDir)).filter((f) => f.endsWith('.jsonl'));
    }
    catch {
        return [];
    }
    if (!files.length) {
        return [];
    }
    const all = [];
    for (const file of files) {
        const text = await fs.readFile(path.join(eventsDir, file), 'utf8');
        const lines = text.split('\n').filter((l) => l.trim());
        for (const line of lines.slice(-limit)) {
            try {
                const raw = JSON.parse(line);
                const type = String(raw.type ?? 'event');
                const timestamp = Number(raw.timestamp ?? Date.now());
                const detail = type === 'git_change'
                    ? `${Array.isArray(raw.modified) ? raw.modified.length : 0} modified`
                    : undefined;
                all.push({
                    type,
                    file: typeof raw.file === 'string' ? raw.file : undefined,
                    timestamp,
                    detail,
                });
            }
            catch {
                // skip malformed lines
            }
        }
    }
    return all
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
}
export async function loadDashboardState(workspaceRoot) {
    const [status, change, handoff, understandingGraph, graph, snapshot, timeline, recentEvents, handoffInjection] = await Promise.all([
        readWorkspaceStatus(workspaceRoot),
        readChangeArtifact(workspaceRoot),
        readHandoffArtifact(workspaceRoot),
        readUnderstandingGraph(workspaceRoot),
        readProjectGraph(workspaceRoot),
        readKnowledgeSnapshot(workspaceRoot),
        readProjectTimeline(workspaceRoot),
        readRecentEvents(workspaceRoot),
        readHandoffInjectionState(workspaceRoot),
    ]);
    return {
        workspaceRoot,
        loadedAt: Date.now(),
        status: {
            mode: status.mode,
            lastWriter: status.source?.lastWriter,
            lastUpdated: status.source?.lastUpdated,
            eventCount: status.eventCount,
            gitWorking: status.gitWorking,
            gitStaged: status.gitStaged,
            currentTask: status.currentTask,
        },
        change,
        handoff,
        understandingGraph,
        graph,
        snapshot,
        timeline,
        recentEvents,
        handoffInjection,
    };
}
