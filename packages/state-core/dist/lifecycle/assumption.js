"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAdrAssumptions = extractAdrAssumptions;
exports.detectAssumptionFailures = detectAssumptionFailures;
const bootstrapState_js_1 = require("../bootstrap/bootstrapState.js");
const eventStore_js_1 = require("../cil/eventStore.js");
const store_js_1 = require("../understanding/store.js");
const dependencyInventory_js_1 = require("./dependencyInventory.js");
const ASSUMPTION_PATTERNS = [
    { type: 'BUSINESS_ASSUMPTION', pattern: /traffic\s+(?:remains?|stays?|is)\s+(?:below|under|<)\s*([\d,]+k?)/i },
    { type: 'BUSINESS_ASSUMPTION', pattern: /(?:scale|load|users?)\s+(?:remains?|stays?)\s+(?:below|under|<)\s*([\d,]+k?)/i },
    { type: 'TECHNICAL_ASSUMPTION', pattern: /assuming\s+([^.!?\n]{12,140})/i },
    { type: 'TECHNICAL_ASSUMPTION', pattern: /(?:because|since)\s+([^.!?\n]{12,140})/i },
    { type: 'TECHNICAL_ASSUMPTION', pattern: /(\w[\w-]*)\s+(?:remains?|stays?|is)\s+available/i },
    { type: 'OPERATIONAL_ASSUMPTION', pattern: /(?:single\s+owner|team\s+owns|maintained\s+by)\s+([^.!?\n]{4,80})/i },
];
/** Extract assumptive statements from ADR reason text. */
function extractAdrAssumptions(adr) {
    const text = `${adr.title} ${adr.reason}`;
    const out = [];
    const seen = new Set();
    for (const { type, pattern } of ASSUMPTION_PATTERNS) {
        const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
        let m;
        while ((m = re.exec(text)) !== null) {
            const statement = (m[1] ?? m[0]).trim().replace(/\s+/g, ' ');
            if (statement.length < 8 || seen.has(statement.toLowerCase())) {
                continue;
            }
            seen.add(statement.toLowerCase());
            out.push({ statement, type });
        }
    }
    // Tech availability assumptions inferred from strong ADR claims
    for (const term of (0, dependencyInventory_js_1.extractTechTerms)(text)) {
        if (new RegExp(`(?:use|adopt|require)\\s+${term}`, 'i').test(text)) {
            const statement = `${term} remains available`;
            if (!seen.has(statement)) {
                seen.add(statement);
                out.push({ statement, type: 'TECHNICAL_ASSUMPTION' });
            }
        }
    }
    return out.slice(0, 8);
}
function contradictsAssumption(statement, blob) {
    const lower = statement.toLowerCase();
    const b = blob.toLowerCase();
    const belowMatch = lower.match(/(?:below|under|<)\s*([\d,]+)\s*(k|m)?/);
    if (belowMatch) {
        const limit = Number(belowMatch[1].replace(/,/g, '')) * (belowMatch[2] === 'k' ? 1000 : 1);
        const scaleHit = b.match(/(\d{2,}[\d,]*)\s*(?:k|K)?\s*(?:users?|requests?|rps|qps|traffic)/) ??
            b.match(/scaled?\s+to\s+(\d{2,}[\d,]*)/);
        if (scaleHit && limit > 0) {
            const observed = Number(scaleHit[1].replace(/,/g, ''));
            if (observed > limit * 1.2) {
                return `Observed scale (${scaleHit[0]}) exceeds assumption "${statement}"`;
            }
        }
        if (/scaled|growth spike|10x|100x|high traffic|traffic surge/.test(b) && limit > 0) {
            return `Activity suggests scale exceeded assumption "${statement}"`;
        }
    }
    if (/monolith|single service/.test(lower) && /microservice|split service|service mesh/.test(b)) {
        return `Architecture drift conflicts with "${statement}"`;
    }
    if (/sqlite|embedded db/.test(lower) && /postgres|mysql|clustered db/.test(b)) {
        return `Storage scale conflicts with "${statement}"`;
    }
    for (const term of Object.keys(dependencyInventory_js_1.TECH_TERM_TO_PACKAGES)) {
        if (lower.includes(term) &&
            /available|remains|required/.test(lower) &&
            new RegExp(`(?:removed|dropping|without|no longer use[sd]?)\\s+${term}|${term}\\s+removed`, 'i').test(b)) {
            return `Narrative indicates ${term} is no longer available — conflicts with "${statement}"`;
        }
    }
    return undefined;
}
function techMissingFromManifests(statement, installed) {
    const lower = statement.toLowerCase();
    for (const [term, packages] of Object.entries(dependencyInventory_js_1.TECH_TERM_TO_PACKAGES)) {
        if (!lower.includes(term) || !/available|remains|required|use /.test(lower)) {
            continue;
        }
        const hasPkg = packages.some((p) => installed.has(p.toLowerCase()));
        if (!hasPkg) {
            return `Assumption "${statement}" fails: no ${term}-related package in workspace manifests`;
        }
    }
    return undefined;
}
/** Heuristic assumption failure from handoff, events, focus, and manifests. */
async function detectAssumptionFailures(workspaceRoot, adr, assumptions) {
    const extracted = assumptions?.length ? assumptions : extractAdrAssumptions(adr);
    if (!extracted.length) {
        return [];
    }
    const [state, handoff, events, installed] = await Promise.all([
        (0, bootstrapState_js_1.readStateJson)(workspaceRoot).catch(() => null),
        (0, store_js_1.readHandoffArtifact)(workspaceRoot).catch(() => null),
        (0, eventStore_js_1.readAllCognitiveEvents)(workspaceRoot).catch(() => []),
        (0, dependencyInventory_js_1.collectWorkspaceDependencyNames)(workspaceRoot),
    ]);
    const eventBlob = events
        .slice(0, 24)
        .map((e) => `${e.title}\n${e.summary}\n${e.why ?? ''}`)
        .join('\n');
    const blob = [
        handoff?.goal ?? '',
        handoff?.summary ?? '',
        state?.currentTask ?? '',
        state?.notes ?? '',
        eventBlob,
    ].join('\n');
    const signals = [];
    const now = new Date().toISOString();
    for (const a of extracted) {
        const failure = contradictsAssumption(a.statement, blob) ?? techMissingFromManifests(a.statement, installed);
        if (!failure) {
            continue;
        }
        signals.push({
            type: 'ASSUMPTION_FAILURE',
            detected_at: now,
            reason: failure,
            severity: 'high',
            evidence: a.statement,
            detail: `Assumption (${a.type}) may no longer hold`,
        });
    }
    return signals;
}
