"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTransferStory = buildTransferStory;
const bootstrapState_js_1 = require("../bootstrap/bootstrapState.js");
const intentVNext_js_1 = require("../intelligence/intentVNext.js");
const store_js_1 = require("../understanding/store.js");
const decisionCenter_js_1 = require("./decisionCenter.js");
const actionEngine_js_1 = require("./actionEngine.js");
const historyExplorer_js_1 = require("./historyExplorer.js");
const journeyBuilder_js_1 = require("./journeyBuilder.js");
const confidenceLabels_js_1 = require("./confidenceLabels.js");
/** Transfer V2 / Project Story — narrative export for AI continuity. */
async function buildTransferStory(workspaceRoot) {
    const [state, intents, handoff, history, center, actionItems, journey] = await Promise.all([
        (0, bootstrapState_js_1.readStateJson)(workspaceRoot),
        (0, intentVNext_js_1.readIntentGraphVNext)(workspaceRoot),
        (0, store_js_1.readHandoffArtifact)(workspaceRoot),
        (0, historyExplorer_js_1.exploreHistory)(workspaceRoot, 'last_7_days'),
        (0, decisionCenter_js_1.getDecisionCenter)(workspaceRoot),
        (0, actionEngine_js_1.deriveNextActions)(workspaceRoot),
        (0, journeyBuilder_js_1.buildProjectJourney)(workspaceRoot),
    ]);
    const currentGoal = state?.currentTask?.trim() ||
        handoff?.current_focus?.trim() ||
        intents?.nodes?.[0]?.name ||
        'Not set';
    const currentDirection = intents?.nodes?.[0]?.description?.trim() ||
        handoff?.goal?.trim() ||
        'Not recorded';
    const projectSummary = handoff?.summary?.trim() ||
        handoff?.goal?.trim() ||
        `Project with ${history.count} recent cognitive event(s)`;
    const majorDecisions = center.decisions
        .filter((d) => d.status === 'accepted' || d.status === 'proposed')
        .slice(0, 5)
        .map((d) => `${d.id}: ${d.title} — ${d.reason}`);
    const milestones = history.events.slice(0, 6).map((e) => `${e.timestamp.slice(0, 10)}: ${e.title}`);
    const pendingRisks = center.decisions
        .filter((d) => d.risk === 'high' || d.freshness === 'stale' || d.status === 'proposed')
        .slice(0, 4)
        .map((d) => {
        const extra = d.superseded_by ? ` (superseded by ${d.superseded_by})` : '';
        return `${d.title} (${(0, confidenceLabels_js_1.freshnessLabelText)(d.freshness)}, risk ${d.risk})${extra}`;
    });
    const nextActions = actionItems.map((a) => `${a.task} — ${a.reason}`);
    const lines = [
        '# Project Story',
        '',
        '## Project Goal',
        projectSummary,
        '',
        '## Current Direction',
        currentDirection,
        '',
        '## Current Focus',
        currentGoal,
        '',
        '## Major Decisions',
        ...(majorDecisions.length ? majorDecisions.map((d) => `- ${d}`) : ['- None recorded']),
        '',
        '## Important Milestones',
        ...(milestones.length ? milestones.map((e) => `- ${e}`) : ['- None recorded']),
        '',
        '## Project Journey',
        ...journey.stages.map((s) => `- ${s.version}: ${s.label}`),
        '',
        '## Current Risks',
        ...(pendingRisks.length ? pendingRisks.map((r) => `- ${r}`) : ['- None flagged']),
        '',
        '## Next Actions',
        ...nextActions.map((a) => `- ${a}`),
        '',
    ];
    return {
        project_summary: projectSummary,
        current_goal: currentGoal,
        recent_decisions: majorDecisions,
        important_events: milestones,
        pending_risks: pendingRisks,
        next_actions: nextActions,
        formatted_markdown: lines.join('\n'),
    };
}
