"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeGraphRef = normalizeGraphRef;
exports.formatNextActionPlain = formatNextActionPlain;
exports.formatAiHandoffExecutionBlock = formatAiHandoffExecutionBlock;
exports.formatCanonicalAiMarkdown = formatCanonicalAiMarkdown;
function norm(s) {
    return s.trim().toLowerCase().replace(/\s+/g, ' ');
}
function textsSimilar(a, b) {
    const na = norm(a);
    const nb = norm(b);
    if (!na || !nb) {
        return false;
    }
    return na === nb || na.includes(nb) || nb.includes(na);
}
function basenamePath(p) {
    const parts = p.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts[parts.length - 1] ?? p;
}
/** Machine-stable graph ref: fn:name, cls:name, mod:path */
function normalizeGraphRef(ref) {
    const t = ref.trim();
    if (!t) {
        return t;
    }
    const colon = t.indexOf(':');
    if (colon > 0) {
        const kind = t.slice(0, colon).toLowerCase();
        const name = t.slice(colon + 1);
        if (kind === 'function' || kind === 'fn') {
            return `fn:${name}`;
        }
        if (kind === 'class' || kind === 'cls') {
            return `cls:${name}`;
        }
        if (kind === 'module' || kind === 'mod') {
            return `mod:${name}`;
        }
        return `${kind}:${name}`;
    }
    return `fn:${t}`;
}
/** Plain next line for canonical export (no [action] tags). */
function formatNextActionPlain(a) {
    const target = (a.target || '').trim();
    const reason = (a.reason || '').trim();
    if (!reason || norm(reason) === norm(target)) {
        return target || reason;
    }
    if (reason.toLowerCase().startsWith(target.toLowerCase())) {
        return reason;
    }
    if (target.toLowerCase().startsWith(reason.toLowerCase())) {
        return target;
    }
    return target ? `${target}` : reason;
}
function listSection(title, items, empty) {
    if (!items.length) {
        return empty ? [title, empty] : [];
    }
    return [title, ...items.map((i) => `- ${i}`)];
}
function formatSnapshotFromBuilt(built) {
    const lines = [];
    const goal = built.project_goal.trim();
    const stage = built.current_stage.trim();
    if (goal) {
        lines.push(`goal: ${goal}`);
    }
    if (stage) {
        lines.push(`stage: ${stage}`);
    }
    if (built.active_modules.length) {
        if (lines.length) {
            lines.push('');
        }
        lines.push(...listSection('modules:', built.active_modules.slice(0, 12).map(basenamePath)));
    }
    if (built.completed_milestones.length) {
        lines.push('');
        lines.push(...listSection('milestones:', built.completed_milestones.slice(0, 8).map((m) => m.slice(0, 120))));
    }
    if (built.open_problems.length) {
        lines.push('');
        lines.push(...listSection('open_problems:', built.open_problems.slice(0, 6).map((p) => p.slice(0, 160))));
    }
    if (built.next_actions.length) {
        lines.push('');
        lines.push(...listSection('next_actions:', built.next_actions.slice(0, 6)));
    }
    return lines;
}
/** Fallback when only legacy snapshot markdown is available. */
function formatSnapshotFromMarkdown(md) {
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let section = '';
    const buckets = {
        goal: [],
        stage: [],
        modules: [],
        milestones: [],
        open_problems: [],
        next_actions: [],
    };
    const pushItem = (key, item) => {
        const t = item.trim();
        if (t && !buckets[key].includes(t)) {
            buckets[key].push(t);
        }
    };
    for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (/^goal:?\s*$/i.test(t)) {
            section = 'goal';
            continue;
        }
        if (/^current stage:?\s*$/i.test(t)) {
            section = 'stage';
            continue;
        }
        if (/^active modules:?\s*$/i.test(t)) {
            section = 'modules';
            continue;
        }
        if (/^completed milestones:?\s*$/i.test(t)) {
            section = 'milestones';
            continue;
        }
        if (/^open problems:?\s*$/i.test(t)) {
            section = 'open_problems';
            continue;
        }
        if (/^next actions:?\s*$/i.test(t)) {
            section = 'next_actions';
            continue;
        }
        if (t.startsWith('- ')) {
            const item = t.slice(2).trim();
            if (section && section in buckets) {
                pushItem(section, item);
            }
            continue;
        }
        if (section === 'goal' && t && !t.startsWith('-')) {
            pushItem('goal', t.replace(/^goal:\s*/i, ''));
            section = '';
            continue;
        }
        if (section === 'stage' && t && !t.startsWith('-')) {
            pushItem('stage', t.replace(/^current stage:\s*/i, ''));
            section = '';
            continue;
        }
        if (/^goal:\s+/i.test(t)) {
            pushItem('goal', t.replace(/^goal:\s*/i, ''));
            continue;
        }
        if (/^stage:\s+/i.test(t)) {
            pushItem('stage', t.replace(/^stage:\s*/i, ''));
        }
    }
    if (buckets.goal[0]) {
        out.push(`goal: ${buckets.goal[0]}`);
    }
    if (buckets.stage[0]) {
        out.push(`stage: ${buckets.stage[0]}`);
    }
    if (buckets.modules.length) {
        out.push('');
        out.push(...listSection('modules:', buckets.modules));
    }
    if (buckets.milestones.length) {
        out.push('');
        out.push(...listSection('milestones:', buckets.milestones));
    }
    if (buckets.open_problems.length) {
        out.push('');
        out.push(...listSection('open_problems:', buckets.open_problems));
    }
    if (buckets.next_actions.length) {
        out.push('');
        out.push(...listSection('next_actions:', buckets.next_actions));
    }
    return out;
}
function deriveExecutionFocus(handoff) {
    const focus = handoff.current_focus.trim();
    const goal = handoff.goal.trim();
    if (focus && !textsSimilar(focus, goal)) {
        return focus;
    }
    const files = new Set();
    for (const k of handoff.key_changes) {
        if (k.kind === 'file') {
            files.add(basenamePath(k.symbol));
        }
        else {
            const f = k.symbol.split('::')[0];
            if (f) {
                files.add(basenamePath(f));
            }
        }
    }
    const fileList = [...files].slice(0, 2);
    const fnCount = handoff.key_changes.filter((k) => k.kind === 'function').length;
    if (fileList.length) {
        const mods = fileList.join(' + ');
        return fnCount > 0 ? `${mods} modification (${fnCount} symbols)` : `${mods} modification`;
    }
    const parts = handoff.summary.split('|').map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && !/^goal:/i.test(last)) {
        return last.replace(/^focus:\s*/i, '');
    }
    return focus || goal || 'continue current task';
}
/** V3.1 execution block — single AI decision entry (no duplicate snapshot lists). */
function formatAiHandoffExecutionBlock(handoff) {
    const lines = ['# AI HANDOFF (V3.1)'];
    const goal = handoff.goal.trim();
    const focus = deriveExecutionFocus(handoff);
    const risk = handoff.impact_summary.risk;
    if (goal) {
        lines.push(`goal: ${goal}`);
    }
    const execFocus = deriveExecutionFocus(handoff);
    if (execFocus) {
        lines.push(`focus: ${execFocus}`);
    }
    lines.push(`risk: ${risk}`);
    if (handoff.next_actions.length) {
        lines.push('next:');
        const seen = new Set();
        for (const a of handoff.next_actions.slice(0, 6)) {
            const plain = formatNextActionPlain(a);
            const key = norm(plain);
            if (!plain || seen.has(key)) {
                continue;
            }
            seen.add(key);
            lines.push(`- ${plain}`);
        }
    }
    return lines.join('\n');
}
function collectModifiedSymbols(handoff) {
    const out = [];
    const seen = new Set();
    for (const k of handoff.key_changes) {
        if (k.kind === 'function' || k.kind === 'class') {
            const sym = k.symbol.trim();
            if (sym && !seen.has(sym)) {
                seen.add(sym);
                out.push(sym);
            }
        }
    }
    return out.slice(0, 12);
}
function formatCognitiveSnapshotSection(snap) {
    const lines = ['# COGNITIVE SNAPSHOT'];
    if (snap.topIntents.length) {
        lines.push(...listSection('top_intents:', snap.topIntents));
    }
    if (snap.topHotspots.length) {
        lines.push(...listSection('top_hotspots:', snap.topHotspots));
    }
    if (snap.topFunctions.length) {
        lines.push(...listSection('top_functions:', snap.topFunctions));
    }
    if (snap.nextActions.length) {
        lines.push(...listSection('next_graph_actions:', snap.nextActions));
    }
    lines.push(`avg_confidence: ${snap.graphSummary.avgConfidence}`);
    return lines;
}
/**
 * V3.1 canonical markdown for IDE one-click copy (AI Mode).
 * Layered: snapshot → working context → change/impact/graph → execution handoff → instruction.
 */
function formatCanonicalAiMarkdown(input) {
    const lines = [];
    lines.push('# TASK ANCHOR');
    lines.push(input.taskAnchor.trim() || '(not set)');
    lines.push('');
    const snapLines = input.built
        ? formatSnapshotFromBuilt(input.built)
        : input.snapshotMarkdown?.trim()
            ? formatSnapshotFromMarkdown(input.snapshotMarkdown)
            : [];
    if (snapLines.length) {
        lines.push('# PROJECT SNAPSHOT');
        lines.push(...snapLines);
        lines.push('');
    }
    lines.push('# WORKING CONTEXT');
    lines.push(...listSection('active_files:', input.activeFiles.length ? input.activeFiles : ['(none)']));
    lines.push('');
    lines.push(...listSection('recent_git_activity:', input.recentGitActivity.length ? input.recentGitActivity : ['(none)']));
    lines.push('');
    if (input.knowledgeSnapshot) {
        lines.push(...formatCognitiveSnapshotSection(input.knowledgeSnapshot));
        lines.push('');
    }
    const handoff = input.handoff;
    if (handoff?.key_changes?.length) {
        const modified = collectModifiedSymbols(handoff);
        if (modified.length) {
            lines.push('# CHANGE SET');
            lines.push(...listSection('modified_symbols:', modified));
            lines.push('');
        }
    }
    if (handoff?.impact_summary.affected_functions.length) {
        lines.push('# IMPACT SET');
        lines.push(...listSection('impacted_symbols:', handoff.impact_summary.affected_functions.slice(0, 12)));
        lines.push('');
    }
    const graphRefs = input.knowledgeSnapshot
        ? []
        : (handoff?.context_graph_refs ?? []).map(normalizeGraphRef).filter(Boolean);
    if (graphRefs.length) {
        lines.push('# GRAPH REFS');
        for (const ref of graphRefs.slice(0, 12)) {
            lines.push(`- ${ref}`);
        }
        lines.push('');
    }
    if (handoff && (handoff.summary || handoff.current_focus || handoff.next_actions.length)) {
        lines.push(formatAiHandoffExecutionBlock(handoff));
        lines.push('');
    }
    const recent = input.timeline?.recent ?? [];
    if (recent.length) {
        lines.push('# CODE EVOLUTION');
        for (const e of recent.slice(0, 5)) {
            const syms = e.changes.map((c) => c.symbol).join(', ') || e.type;
            lines.push(`- ${e.commit} · ${basenamePath(e.file)} · ${syms} (${e.impact_level})`);
        }
        lines.push('');
    }
    if (input.insights?.length) {
        lines.push('# INSIGHTS');
        for (const line of input.insights.slice(0, 4)) {
            lines.push(`- ${line}`);
        }
        lines.push('');
    }
    const notes = (input.notes ?? '').trim();
    if (notes && notes !== '(none)') {
        lines.push('# NOTES');
        lines.push(notes);
        lines.push('');
    }
    lines.push('# INSTRUCTION');
    lines.push(input.instruction.trim() || '(none)');
    lines.push('');
    return lines.join('\n');
}
