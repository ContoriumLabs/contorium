"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProjectStateFromScan = buildProjectStateFromScan;
/** Scan-driven L2/L4 when no IDE events (MCP / CLI bootstrap). */
function buildProjectStateFromScan(scan, state) {
    const modules = [
        ...scan.topLevelModules.slice(0, 6),
        ...scan.recentFiles.slice(0, 4).map((f) => f.split('/').pop() ?? f),
    ];
    const active = [...new Set(modules)].slice(0, 8);
    const goal = scan.readmeHint?.trim() ||
        (active.length ? `develop ${active.slice(0, 2).join(' and ')} areas` : 'ongoing workspace development');
    const gitCount = scan.gitStaged.length + scan.gitWorking.length;
    return {
        version: 1,
        engine_version: 2,
        generatedAt: scan.scannedAt,
        task_anchor: state?.currentTask?.trim() || undefined,
        project_goal: goal,
        current_stage: scan.isGitRepo
            ? 'repository scan (tool-agnostic bootstrap)'
            : 'workspace scan (no git)',
        active_modules: active,
        recent_decisions: [],
        open_problems: gitCount >= 6 ? ['uncommitted changes across workspace'] : ['(light or undirected activity)'],
        completed_milestones: [],
        next_actions: [
            'review recent file activity',
            ...(scan.isGitRepo ? ['review and commit pending changes'] : []),
        ],
        confidence: 0.35,
    };
}
