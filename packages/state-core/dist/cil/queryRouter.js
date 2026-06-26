"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeQuery = routeQuery;
/** Map natural language → structured CIL intent (Query Router). */
function routeQuery(question) {
    const q = question.toLowerCase().trim();
    const raw = question.trim();
    if (/what should i do next|what next|next action|next step/.test(q)) {
        return { intent: 'action', raw };
    }
    if (/state on|project on|snapshot on|what was.*on \d{4}|decisions existed on|focus on \d{4}/.test(q) ||
        (/\d{4}-\d{2}-\d{2}/.test(q) && /on|before|after|at/.test(q))) {
        const dateMatch = q.match(/\d{4}-\d{2}-\d{2}/);
        const retrospective = /what do we know now about|know now about|retrospective|in hindsight|looking back now/.test(q);
        return {
            intent: 'time_travel',
            topic: dateMatch?.[0],
            perspective: retrospective ? 'retrospective' : 'historical',
            raw,
        };
    }
    if (/tell me (everything )?about|everything related to|related to|what links to/.test(q)) {
        const topic = q
            .replace(/tell me (everything )?about\s+/i, '')
            .replace(/everything related to\s+/i, '')
            .replace(/related to\s+/i, '')
            .replace(/what links to\s+/i, '')
            .replace(/\?$/, '')
            .trim();
        return { intent: 'entity', topic: topic || undefined, raw };
    }
    if (/^why not\b|why wasn't|why isn't/.test(q)) {
        const topic = q.replace(/^why\s+(not|wasn't|isn't)\s+/i, '').replace(/\?$/, '').trim();
        return { intent: 'decision', topic: topic || undefined, raw };
    }
    if (/^why\b|why was|why does|decision|adr|unresolved decision/.test(q)) {
        const topic = q
            .replace(/^why\s+(was|does|did|is)\s+/i, '')
            .replace(/.*decision\s+/i, '')
            .replace(/\?$/, '')
            .trim();
        return { intent: 'decision', topic: topic || undefined, raw };
    }
    if (/what happened|recent|this week|today|yesterday|history|module history/.test(q)) {
        let range = 'last_7_days';
        if (q.includes('today')) {
            range = 'today';
        }
        else if (q.includes('yesterday')) {
            range = 'yesterday';
        }
        else if (q.includes('30 day') || q.includes('month')) {
            range = 'last_30_days';
        }
        return { intent: 'history', range, raw };
    }
    if (/state on|project state|current focus|what matters|focus now|cognitive health|health score/.test(q)) {
        const dateMatch = q.match(/\d{4}-\d{2}-\d{2}/);
        if (dateMatch) {
            return { intent: 'time_travel', topic: dateMatch[0], raw };
        }
        if (/health|cognitive health/.test(q)) {
            return { intent: 'state', topic: 'health', raw };
        }
        return { intent: 'state', raw };
    }
    if (/tell me this project|project story|describe project|what is this project|story|essence|evolved through/.test(q)) {
        return { intent: 'story', raw };
    }
    if (/replay|how this project evolved|evolution replay/.test(q)) {
        return { intent: 'history', topic: 'replay', raw };
    }
    if (/blast radius|impact|what breaks|affects|what changed|who modified|modified/.test(q)) {
        const topic = q
            .replace(/what changed in\s+/i, '')
            .replace(/who modified\s+/i, '')
            .replace(/.*impact\s+/i, '')
            .replace(/blast radius\s+/i, '')
            .replace(/\?$/, '')
            .trim();
        return { intent: 'debug', topic: topic || undefined, raw };
    }
    if (/journey|evolution|roadmap/.test(q)) {
        return { intent: 'debug', topic: 'journey', raw };
    }
    return { intent: 'history', topic: q || undefined, raw };
}
