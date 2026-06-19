"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGovernanceExportAppendixFull = buildGovernanceExportAppendixFull;
exports.buildGovernanceAwareExportText = buildGovernanceAwareExportText;
const chpHandoff_js_1 = require("../understanding/chpHandoff.js");
const governanceArtifacts_js_1 = require("./governanceArtifacts.js");
const governanceReview_js_1 = require("./governanceReview.js");
/** Governance appendix = YAML section + unified DECISION/SCOPE/TRACE supplement. */
async function buildGovernanceExportAppendixFull(workspaceRoot, review) {
    const [section, bundle] = await Promise.all([
        (0, governanceReview_js_1.formatGovernanceExportSection)(workspaceRoot, review),
        (0, governanceArtifacts_js_1.loadGovernanceArtifactBundle)(workspaceRoot),
    ]);
    const effectiveBundle = review ? { ...bundle, review: review ?? bundle.review } : bundle;
    const supplement = (0, governanceArtifacts_js_1.buildGovernanceSupplement)(effectiveBundle);
    return `${section}${supplement}`.trim();
}
/**
 * Unified export body — handoff/CHP + governance appendix.
 * Used by CLI [c], handoff --copy, contorium export, IDE, MCP export.
 */
async function buildGovernanceAwareExportText(input) {
    const review = input.review ??
        (await (0, governanceArtifacts_js_1.loadGovernanceArtifactBundle)(input.workspaceRoot)).review ??
        null;
    const governanceBlock = await buildGovernanceExportAppendixFull(input.workspaceRoot, review);
    const chp = (0, chpHandoff_js_1.buildChpHandoffStateSync)({
        workspaceRoot: input.workspaceRoot,
        handoff: input.handoff,
        change: input.change,
        currentTask: input.currentTask,
        lastWriter: input.lastWriter,
    });
    if (chp) {
        const trimmed = input.filter?.trim();
        const chpState = trimmed
            ? {
                ...chp,
                recent_changes: chp.recent_changes.filter((c) => c.name.toLowerCase().includes(trimmed.toLowerCase())),
            }
            : chp;
        const body = (0, chpHandoff_js_1.formatChpMarkdown)(chpState, input.handoff, input.timeline ?? undefined);
        return governanceBlock ? `${body}\n\n${governanceBlock}` : body;
    }
    return governanceBlock || undefined;
}
