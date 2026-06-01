import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { formatBootstrapSnapshotMarkdown } from './minimalSnapshot.js';
const BUILDER_DIR = ['.contora', 'state-builder'];
export function buildBootstrapProjectState(scan, state) {
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
export async function writeBootstrapArtifacts(workspaceRoot, scan, state) {
    const dir = path.join(workspaceRoot, ...BUILDER_DIR);
    await fs.mkdir(dir, { recursive: true });
    const built = buildBootstrapProjectState(scan, state);
    const md = formatBootstrapSnapshotMarkdown(scan, state?.currentTask ?? '');
    await Promise.all([
        fs.writeFile(path.join(dir, 'project-state.json'), JSON.stringify(built, null, 2), 'utf8'),
        fs.writeFile(path.join(dir, 'project-snapshot.md'), md, 'utf8'),
    ]);
}
