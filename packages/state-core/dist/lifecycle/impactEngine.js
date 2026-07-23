"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeDecisionImpacts = computeDecisionImpacts;
exports.formatDecisionWhyChain = formatDecisionWhyChain;
const dependencyInventory_js_1 = require("./dependencyInventory.js");
function impactRank(level) {
    return level === 'high' ? 3 : level === 'medium' ? 2 : 1;
}
function mergeImpact(a, b) {
    return impactRank(a) >= impactRank(b) ? a : b;
}
function severityForImpact(impact) {
    return impact === 'high' ? 'high' : impact === 'medium' ? 'medium' : 'low';
}
function eventMatchesDependency(event, dep) {
    const hay = `${event.detail ?? ''} ${(event.files ?? []).join(' ')}`.toLowerCase();
    const d = dep.toLowerCase();
    if (hay.includes(d)) {
        return true;
    }
    const pkgs = dependencyInventory_js_1.TECH_TERM_TO_PACKAGES[d] ?? [];
    return pkgs.some((p) => hay.includes(p.toLowerCase()));
}
function eventMatchesModule(event, modulePath) {
    const base = modulePath.split('/').pop() ?? modulePath;
    return (event.files ?? []).some((f) => f.includes(base) || f.includes(modulePath));
}
function assumptionBrokenByEvent(assumption, event) {
    const a = assumption.toLowerCase();
    const detail = (event.detail ?? '').toLowerCase();
    const terms = Object.keys(dependencyInventory_js_1.TECH_TERM_TO_PACKAGES);
    if (event.type === 'DEPENDENCY_REMOVAL' || event.type === 'DEPENDENCY_CHANGE') {
        for (const term of terms) {
            if (!a.includes(term)) {
                continue;
            }
            if (detail.includes(`${term} removed`) ||
                detail.includes(`without ${term}`) ||
                detail.includes(`dependency removed`) ||
                (dependencyInventory_js_1.TECH_TERM_TO_PACKAGES[term] ?? []).some((p) => detail.includes(p.toLowerCase()) && /removed|drop/.test(detail))) {
                return event.type === 'DEPENDENCY_REMOVAL'
                    ? `${term} dependency removed`
                    : `${term} dependency changed`;
            }
        }
        if (/removed|no matching dependency|migrated away/.test(detail)) {
            for (const term of terms) {
                if (a.includes(term)) {
                    return detail;
                }
            }
        }
    }
    if (event.type === 'BUSINESS_CHANGE' && /traffic|scale|users?/.test(a)) {
        return 'Business scale changed';
    }
    if (event.type === 'ARCHITECTURE_CHANGE' && /monolith|microservice|architecture/.test(a)) {
        return detail || 'Architecture change detected';
    }
    if (event.type === 'CODE_CHANGE' && event.files?.length) {
        for (const file of event.files) {
            if (a.includes(file.split('/').pop() ?? file)) {
                return `Related module changed: ${file}`;
            }
        }
    }
    return undefined;
}
/** Propagate change events through dependency graph → reason chains (优化.md §7–8). */
function computeDecisionImpacts(events, depGraph, assumptionGraph) {
    const assumptionsById = new Map(assumptionGraph.assumptions.map((a) => [a.id, a]));
    const results = new Map();
    for (const node of depGraph.decisions) {
        for (const event of events) {
            // Candidates need explicit confidence; still surface as WARNING-level via lower impact
            if (event.status === 'candidate' && (event.confidence ?? 0) < 0.65) {
                continue;
            }
            const candidateSoft = event.status === 'candidate';
            let impact;
            let reason = '';
            const chain = [
                {
                    type: 'CHANGE_EVENT',
                    event: event.detail ?? event.type,
                    detail: event.source,
                },
            ];
            const depHit = node.depends_on.dependencies.find((dep) => eventMatchesDependency(event, dep));
            if (depHit && (event.type === 'DEPENDENCY_REMOVAL' || event.type === 'DEPENDENCY_CHANGE')) {
                impact = event.type === 'DEPENDENCY_REMOVAL' ? 'high' : 'medium';
                if (candidateSoft) {
                    impact = 'low';
                }
                reason = `${depHit} dependency ${event.type === 'DEPENDENCY_REMOVAL' ? 'removed' : 'changed'}`;
                chain.push({ type: event.type === 'DEPENDENCY_REMOVAL' ? 'DEPENDENCY_REMOVAL' : 'DEPENDENCY_CHANGE', event: reason });
            }
            const moduleHit = node.depends_on.modules.find((mod) => eventMatchesModule(event, mod));
            if (moduleHit && event.type === 'CODE_CHANGE') {
                impact = mergeImpact(impact ?? 'low', 'medium');
                reason = reason || `Module ${moduleHit} changed`;
                chain.push({ type: 'CODE_CHANGE', event: moduleHit });
            }
            for (const assumptionId of node.depends_on.assumptions) {
                const assumptionNode = assumptionsById.get(assumptionId);
                if (!assumptionNode) {
                    continue;
                }
                const broken = assumptionBrokenByEvent(assumptionNode.assumption, event);
                if (!broken) {
                    continue;
                }
                impact = mergeImpact(impact ?? 'medium', depHit && event.type === 'DEPENDENCY_REMOVAL' ? 'high' : 'medium');
                reason = reason || broken;
                chain.push({
                    type: 'ASSUMPTION_FAILURE',
                    assumption: assumptionNode.assumption,
                    event: broken,
                });
            }
            if (!impact) {
                continue;
            }
            if (candidateSoft && impact !== 'low') {
                impact = 'low';
                reason = `Candidate: ${reason}`;
            }
            chain.push({ type: 'DECISION_IMPACT', impact });
            const existing = results.get(node.decision);
            const next = {
                decision_id: node.decision,
                impact: existing ? mergeImpact(existing.impact, impact) : impact,
                reason: existing?.reason ?? reason,
                chain: existing ? [...existing.chain, ...chain] : chain,
            };
            results.set(node.decision, next);
        }
    }
    const out = [];
    for (const result of results.values()) {
        const signalType = result.chain.some((c) => c.type === 'DEPENDENCY_REMOVAL') ? 'DEPENDENCY_REMOVAL' :
            result.chain.some((c) => c.type === 'ASSUMPTION_FAILURE') ? 'ASSUMPTION_FAILURE' :
                result.chain.some((c) => c.type === 'CODE_CHANGE') ? 'CODE_CHANGE' :
                    'ARCHITECTURE_CHANGE';
        out.push({
            ...result,
            signal: {
                type: signalType,
                detected_at: new Date().toISOString(),
                reason: result.reason,
                severity: severityForImpact(result.impact),
                evidence: result.chain
                    .map((c) => c.assumption ?? c.event)
                    .filter(Boolean)
                    .slice(0, 2)
                    .join(' · '),
                detail: 'Impact propagated via decision dependency graph',
            },
        });
    }
    return out;
}
function formatDecisionWhyChain(chain) {
    const lines = [];
    let step = 1;
    for (const link of chain) {
        if (link.type === 'CHANGE_EVENT' && link.event) {
            lines.push(`${step}. ${link.event}`);
            step += 1;
        }
        else if (link.type === 'ASSUMPTION_FAILURE' && link.assumption) {
            lines.push(`${step}. Assumption failed: ${link.assumption}`);
            step += 1;
        }
        else if (link.type === 'DEPENDENCY_REMOVAL' || link.type === 'DEPENDENCY_CHANGE') {
            lines.push(`${step}. ${link.event ?? 'Dependency changed'}`);
            step += 1;
        }
        else if (link.type === 'CODE_CHANGE' && link.event) {
            lines.push(`${step}. Code changed: ${link.event}`);
            step += 1;
        }
        else if (link.type === 'DECISION_IMPACT' && link.impact) {
            lines.push(`${step}. Impact: ${link.impact} — review required`);
            step += 1;
        }
    }
    return lines;
}
