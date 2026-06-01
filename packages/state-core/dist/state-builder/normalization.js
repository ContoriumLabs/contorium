"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeProjectBuiltState = normalizeProjectBuiltState;
exports.filterWeakInferenceLines = filterWeakInferenceLines;
function normKey(s) {
    return s.trim().toLowerCase().replace(/\s+/g, ' ');
}
function dedupeStrings(items, max) {
    const seen = new Set();
    const out = [];
    for (const raw of items) {
        const t = raw.trim();
        if (t.length < 3) {
            continue;
        }
        const k = normKey(t);
        if (seen.has(k)) {
            continue;
        }
        seen.add(k);
        out.push(t);
        if (out.length >= max) {
            break;
        }
    }
    return out;
}
function compressSimilarActions(actions, taskAnchor) {
    const taskK = normKey(taskAnchor);
    const out = [];
    const seenRoots = new Set();
    for (const raw of actions) {
        let t = raw.trim();
        if (!t) {
            continue;
        }
        t = t.replace(/^continue:\s*/i, '').trim();
        const k = normKey(t);
        if (taskK.length >= 4 && (k === taskK || k.includes(taskK) || taskK.includes(k))) {
            continue;
        }
        const root = k.slice(0, Math.min(32, k.length));
        if (seenRoots.has(root)) {
            continue;
        }
        seenRoots.add(root);
        out.push(t);
    }
    return out.slice(0, 6);
}
function echoesTask(text, taskAnchor) {
    const t = normKey(text);
    const a = normKey(taskAnchor);
    if (!a || a.length < 4) {
        return false;
    }
    return t === a || t.includes(a) || a.includes(t);
}
function stripTaskFromGoal(goal, taskAnchor) {
    if (!goal.trim() || echoesTask(goal, taskAnchor)) {
        return '';
    }
    return goal.trim();
}
function stripTaskFromStage(stage, taskAnchor) {
    if (!stage.trim() || echoesTask(stage, taskAnchor)) {
        return stage.trim();
    }
    return stage.trim();
}
/** L3 — dedupe, layer split, loop guard, semantic compression. */
function normalizeProjectBuiltState(raw, taskAnchor) {
    const goal = stripTaskFromGoal(raw.project_goal, taskAnchor);
    const stage = stripTaskFromStage(raw.current_stage, taskAnchor);
    const modules = dedupeStrings(raw.active_modules, 8);
    const problems = dedupeStrings(raw.open_problems.filter((p) => !echoesTask(p, taskAnchor)), 6);
    const milestones = dedupeStrings(raw.completed_milestones, 5);
    const decisions = dedupeStrings(raw.recent_decisions.filter((d) => !echoesTask(d, taskAnchor)), 8);
    const next_actions = compressSimilarActions(raw.next_actions.filter((a) => !echoesTask(a, taskAnchor)), taskAnchor);
    const confidence = Math.min(1, raw.confidence * 0.6 +
        (goal ? 0.15 : 0) +
        (modules.length ? 0.15 : 0) +
        (next_actions.length ? 0.1 : 0));
    return {
        ...raw,
        project_goal: goal.slice(0, 240),
        current_stage: stage.slice(0, 120),
        active_modules: modules,
        recent_decisions: decisions,
        open_problems: problems,
        completed_milestones: milestones,
        next_actions,
        confidence: Math.round(confidence * 100) / 100,
    };
}
function filterWeakInferenceLines(lines, taskAnchor) {
    return dedupeStrings(lines.filter((l) => {
        const t = l.trim();
        if (t.length < 4) {
            return false;
        }
        if (/^stated focus:/i.test(t)) {
            return false;
        }
        return !echoesTask(t, taskAnchor);
    }), 8);
}
