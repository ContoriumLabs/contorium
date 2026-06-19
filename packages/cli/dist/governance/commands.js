import { createControlSurface, writeGovernanceReview, buildGovernanceReviewArtifact, } from '@contora/state-core';
import { loadDashboardState } from '../dashboard/artifacts.js';
import { buildDashboardExportText } from '../dashboard/exportContext.js';
import { copyToClipboard } from '../handoff/clipboard.js';
import { importMcpGovernanceV4 } from '../mcpResolve.js';
function flagValue(name) {
    const i = process.argv.indexOf(name);
    if (i < 0 || !process.argv[i + 1]) {
        return undefined;
    }
    return process.argv[i + 1];
}
export const GOVERNANCE_USAGE = `Contorium governance — unified artifact + export (state-core)

  contorium governance review [path] --target <file>   Static review → review.json only
  contorium governance cycle [path] [--target <file>]    Full cycle → governance/*.json
  contorium governance export [path] [--copy]             Unified export (same as handoff --copy)
`;
export async function cmdGovernanceReview(root) {
    const target = flagValue('--target');
    if (!target) {
        console.error('contorium governance review: --target <relative-file> required');
        process.exit(1);
    }
    const control = createControlSurface(root, 'cli');
    const result = await control.checkAction({
        type: 'file_write',
        target_path: target,
        description: `CLI governance review: ${target}`,
    });
    if (result.loop !== 'check') {
        console.error('contorium governance review: check failed');
        process.exit(1);
    }
    const artifact = buildGovernanceReviewArtifact(result, target, {
        reviewSource: 'static_file',
        reviewScope: 'current_file',
    });
    await writeGovernanceReview(root, artifact);
    console.log(JSON.stringify({ workspaceRoot: root, review: artifact.file, risk: artifact.risk, wrote: ['review.json'] }, null, 2));
}
export async function cmdGovernanceCycle(root) {
    const mod = await importMcpGovernanceV4();
    if (!mod?.runGovernanceCycle) {
        console.error('contorium governance cycle: MCP dist not found — run npm run build:mcp from repo root');
        process.exit(1);
    }
    const target = flagValue('--target');
    const cycle = await mod.runGovernanceCycle(root, {
        active_file: target,
        persist: true,
        mode: 'soft',
    });
    console.log(JSON.stringify(cycle, null, 2));
}
export async function cmdGovernanceExport(root) {
    const dashState = await loadDashboardState(root);
    const text = await buildDashboardExportText(root, dashState);
    if (!text) {
        console.error('contorium governance export: not ready');
        process.exit(1);
    }
    if (process.argv.includes('--copy')) {
        if (copyToClipboard(text)) {
            console.error('Governance export copied to clipboard');
            return;
        }
        process.stderr.write('Clipboard unavailable — output below\n');
    }
    process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
}
export async function cmdGovernance(root) {
    const sub = process.argv[3];
    switch (sub) {
        case 'review':
            await cmdGovernanceReview(root);
            return;
        case 'cycle':
            await cmdGovernanceCycle(root);
            return;
        case 'export':
            await cmdGovernanceExport(root);
            return;
        default:
            process.stderr.write(GOVERNANCE_USAGE);
            process.exit(sub ? 1 : 0);
    }
}
