"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHP_VERSION = void 0;
exports.buildChpHandoffStateSync = buildChpHandoffStateSync;
exports.buildChpHandoffState = buildChpHandoffState;
exports.formatChpCompact = formatChpCompact;
exports.formatChpMarkdown = formatChpMarkdown;
exports.getProjectHandoff = getProjectHandoff;
const path = __importStar(require("node:path"));
const bootstrapState_js_1 = require("../bootstrap/bootstrapState.js");
const formatHandoff_js_1 = require("./formatHandoff.js");
const store_js_1 = require("./store.js");
/** Contorium Handoff Protocol v1 — shared AI state shape. */
exports.CHP_VERSION = 1;
function projectName(workspaceRoot) {
    return path.basename(path.resolve(workspaceRoot)) || 'project';
}
function isoTime(ms) {
    return new Date(ms).toISOString();
}
function mapKeyChange(kc) {
    const type = kc.kind === 'function'
        ? 'function_update'
        : kc.kind === 'class'
            ? 'class_update'
            : 'file_update';
    const name = kc.kind === 'function' ? `${kc.symbol}()` : kc.symbol;
    return { type, name, change_type: kc.change_type };
}
function lastChangeLabel(changes) {
    if (!changes.length) {
        return '—';
    }
    return changes[0].name;
}
function lastActionFromChanges(changes) {
    if (!changes.length) {
        return 'idle';
    }
    const first = changes[0];
    switch (first.change_type) {
        case 'added':
            return `add_${first.type.replace('_update', '')}`;
        case 'removed':
            return `remove_${first.type.replace('_update', '')}`;
        case 'modified':
            return `modify_${first.type.replace('_update', '')}`;
        default:
            return first.type;
    }
}
/** Build CHP v1 from in-memory runtime slices (sync — dashboard / IDE status bar). */
function buildChpHandoffStateSync(input) {
    const root = path.resolve(input.workspaceRoot);
    const handoff = input.handoff ?? null;
    const change = input.change ?? null;
    const currentTask = input.currentTask?.trim() ||
        handoff?.current_focus?.trim() ||
        '';
    const lastWriter = input.lastWriter ?? 'runtime';
    const keyChanges = handoff?.key_changes?.length
        ? handoff.key_changes
        : change?.key_changes ?? [];
    const recentChanges = keyChanges.slice(0, 8).map(mapKeyChange);
    if (!handoff && !currentTask && !recentChanges.length) {
        return null;
    }
    const generatedAt = handoff?.generatedAt ?? change?.generatedAt ?? Date.now();
    return {
        version: exports.CHP_VERSION,
        project: projectName(root),
        workspace_root: root,
        current_task: currentTask || handoff?.current_focus?.trim() || '(not set)',
        goal: handoff?.goal?.trim() || currentTask || '(not set)',
        recent_changes: recentChanges,
        agent_context: {
            active_agent: String(lastWriter),
            last_action: lastActionFromChanges(recentChanges),
        },
        summary: handoff?.summary?.trim() || 'No handoff summary yet.',
        last_updated: isoTime(generatedAt),
    };
}
/** Build CHP v1 state from runtime artifacts (single read model). */
async function buildChpHandoffState(input) {
    const root = path.resolve(input.workspaceRoot);
    const [handoff, change, state] = await Promise.all([
        input.handoff !== undefined ? Promise.resolve(input.handoff) : (0, store_js_1.readHandoffArtifact)(root),
        input.change !== undefined ? Promise.resolve(input.change) : (0, store_js_1.readChangeArtifact)(root),
        (0, bootstrapState_js_1.readStateJson)(root),
    ]);
    return buildChpHandoffStateSync({
        workspaceRoot: root,
        handoff,
        change,
        currentTask: input.currentTask?.trim() || state?.currentTask?.trim(),
        lastWriter: input.lastWriter ?? state?.source?.lastWriter,
    });
}
/** CHP compact one-liner for Passive CLI / IDE status bar. */
function formatChpCompact(state, filter) {
    const task = truncatePlain(state.current_task, 36);
    const last = truncatePlain(lastChangeLabel(state.recent_changes), 28);
    const agent = state.agent_context.active_agent;
    const filterNote = filter?.trim() ? ` · filter:${filter.trim()}` : '';
    return `[Contorium] task: ${task} | last: ${last} | agent: ${agent}${filterNote}`;
}
function truncatePlain(text, max) {
    if (text.length <= max) {
        return text;
    }
    return `${text.slice(0, Math.max(0, max - 1))}…`;
}
/** CHP markdown — AI chat injection (wraps V3.1 handoff block when available). */
function formatChpMarkdown(chp, handoff, timeline) {
    if (handoff) {
        const base = (0, formatHandoff_js_1.formatHandoffMarkdown)(handoff, timeline);
        const header = [
            `# Project: ${chp.project}`,
            `Current Task: ${chp.current_task}`,
            `Agent: ${chp.agent_context.active_agent} · last action: ${chp.agent_context.last_action}`,
            '',
        ].join('\n');
        return `${header}${base}`;
    }
    const lines = [
        `# Project: ${chp.project}`,
        '',
        `Current Task: ${chp.current_task}`,
        `Goal: ${chp.goal}`,
        '',
        'Recent Changes:',
    ];
    if (chp.recent_changes.length) {
        for (const c of chp.recent_changes.slice(0, 8)) {
            lines.push(`- ${c.name}${c.change_type ? ` (${c.change_type})` : ''}`);
        }
    }
    else {
        lines.push('- (none)');
    }
    lines.push('');
    lines.push('Agent Context:');
    lines.push(`- active: ${chp.agent_context.active_agent}`);
    lines.push(`- last action: ${chp.agent_context.last_action}`);
    lines.push('');
    lines.push('Summary:');
    lines.push(chp.summary);
    lines.push('');
    return lines.join('\n');
}
/** Unified get_handoff — read runtime artifacts and format. */
async function getProjectHandoff(workspaceRoot, format = 'compact', filter) {
    const root = path.resolve(workspaceRoot);
    const [chp, handoff, timeline] = await Promise.all([
        buildChpHandoffState({ workspaceRoot: root }),
        (0, store_js_1.readHandoffArtifact)(root),
        (0, store_js_1.readProjectTimeline)(root),
    ]);
    if (!chp) {
        return { found: false };
    }
    const filtered = filter?.trim()
        ? {
            ...chp,
            recent_changes: chp.recent_changes.filter((c) => c.name.toLowerCase().includes(filter.trim().toLowerCase())),
        }
        : chp;
    switch (format) {
        case 'json':
            return { found: true, state: filtered, text: JSON.stringify(filtered, null, 2) };
        case 'markdown':
            return {
                found: true,
                state: filtered,
                text: formatChpMarkdown(filtered, handoff, timeline),
            };
        default:
            return { found: true, state: filtered, text: formatChpCompact(filtered, filter) };
    }
}
