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
exports.GOVERNANCE_DISMISSED_ALERTS_SCHEMA = void 0;
exports.buildGovernanceImpactAlerts = buildGovernanceImpactAlerts;
exports.buildGovernanceAlertPanel = buildGovernanceAlertPanel;
exports.readDismissedGovernanceAlerts = readDismissedGovernanceAlerts;
exports.dismissGovernanceAlert = dismissGovernanceAlert;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
exports.GOVERNANCE_DISMISSED_ALERTS_SCHEMA = 'contorium.governance_dismissed_alerts.v1';
function dismissedAlertsPath(workspaceRoot) {
    return path.join(path.resolve(workspaceRoot), '.contora', 'governance', 'dismissed_impact_alerts.json');
}
const ACTIONABLE_STATES = new Set([
    'WARNING',
    'DECAYING',
    'SUSPECTED_INVALID',
    'NEEDS_REVALIDATION',
]);
const IMPACT_RANK = {
    low: 1,
    medium: 2,
    high: 3,
};
function impactFromRecord(record) {
    const chainImpact = record.invalidation_reason_chain?.find((c) => c.type === 'DECISION_IMPACT')?.impact;
    if (chainImpact) {
        return chainImpact;
    }
    if (record.validity_state === 'NEEDS_REVALIDATION' || record.validity_state === 'SUSPECTED_INVALID') {
        return 'high';
    }
    if (record.validity_state === 'DECAYING' || record.decay_penalty >= 35) {
        return 'medium';
    }
    return 'low';
}
function changedFromRecord(record) {
    const chainEvent = record.invalidation_reason_chain?.find((c) => c.type === 'CHANGE_EVENT')?.event;
    if (chainEvent) {
        return chainEvent;
    }
    const dep = record.invalidation_reason_chain?.find((c) => c.type === 'DEPENDENCY_REMOVAL' || c.type === 'DEPENDENCY_CHANGE');
    if (dep?.event) {
        return dep.event;
    }
    const top = [...record.validity_signals].sort((a, b) => {
        const rank = { critical: 4, high: 3, medium: 2, low: 1 };
        return rank[b.severity] - rank[a.severity];
    })[0];
    return top?.reason ?? 'Project change may affect this decision';
}
function assumptionFromRecord(record) {
    const fromChain = record.invalidation_reason_chain?.find((c) => c.type === 'ASSUMPTION_FAILURE')?.assumption;
    if (fromChain) {
        return fromChain;
    }
    return record.assumptions?.[0]?.statement;
}
function alertIdFor(record, changed) {
    const seed = changed.replace(/[^\w.-]+/g, '_').slice(0, 48);
    return `${record.decision_id}:${seed}`;
}
function recordToAlert(record) {
    if (!ACTIONABLE_STATES.has(record.validity_state)) {
        return null;
    }
    if (record.lifecycle_status !== 'ACTIVE') {
        return null;
    }
    const hasSignals = record.validity_signals.length > 0 || (record.invalidation_reason_chain?.length ?? 0) > 0;
    if (!hasSignals && record.validity_state === 'WARNING') {
        return null;
    }
    if (record.validity_state === 'DECAYING' && record.decay_penalty < 25 && !record.invalidation_reason_chain?.length) {
        return null;
    }
    const changed = changedFromRecord(record);
    const impact = impactFromRecord(record);
    const assumption = assumptionFromRecord(record);
    const topSignal = [...record.validity_signals].sort((a, b) => {
        const rank = { critical: 4, high: 3, medium: 2, low: 1 };
        return rank[b.severity] - rank[a.severity];
    })[0];
    return {
        id: alertIdFor(record, changed),
        decision_id: record.decision_id,
        decision_title: record.title,
        validity_state: record.validity_state,
        changed,
        affected_assumption: assumption,
        impact,
        reason: topSignal?.detail ??
            record.invalidation_reason_chain?.find((c) => c.type === 'DECISION_IMPACT')?.detail ??
            `This decision may no longer match the current ${assumption ? 'assumptions' : 'codebase'}`,
        confidence: record.confidence.overall / 100,
        detected_at: topSignal?.detected_at ?? new Date().toISOString(),
        chain_steps: record.invalidation_reason_chain
            ?.map((c) => c.event ?? c.assumption ?? c.impact)
            .filter((x) => Boolean(x))
            .slice(0, 6),
    };
}
function buildGovernanceImpactAlerts(index, dismissedIds = new Set()) {
    const alerts = [];
    for (const record of index.decisions) {
        const alert = recordToAlert(record);
        if (!alert || dismissedIds.has(alert.id)) {
            continue;
        }
        alerts.push(alert);
    }
    return alerts.sort((a, b) => {
        const impact = IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact];
        if (impact !== 0) {
            return impact;
        }
        return a.confidence - b.confidence;
    });
}
function buildGovernanceAlertPanel(index, dismissedIds = new Set()) {
    if (!index?.decisions.length) {
        return { alerts: [], top_alert: null, total_count: 0, dismissed_count: dismissedIds.size };
    }
    const alerts = buildGovernanceImpactAlerts(index, dismissedIds);
    return {
        alerts,
        top_alert: alerts[0] ?? null,
        total_count: alerts.length,
        dismissed_count: dismissedIds.size,
    };
}
async function readDismissedGovernanceAlerts(workspaceRoot) {
    try {
        const raw = JSON.parse(await fs.readFile(dismissedAlertsPath(workspaceRoot), 'utf8'));
        if (raw?.schema === exports.GOVERNANCE_DISMISSED_ALERTS_SCHEMA && Array.isArray(raw.dismissed_ids)) {
            return new Set(raw.dismissed_ids);
        }
    }
    catch {
        // no dismiss file yet
    }
    return new Set();
}
async function dismissGovernanceAlert(workspaceRoot, alertId) {
    const dismissed = await readDismissedGovernanceAlerts(workspaceRoot);
    dismissed.add(alertId);
    const artifact = {
        schema: exports.GOVERNANCE_DISMISSED_ALERTS_SCHEMA,
        updated_at: new Date().toISOString(),
        dismissed_ids: [...dismissed],
    };
    await fs.mkdir(path.dirname(dismissedAlertsPath(workspaceRoot)), { recursive: true });
    await fs.writeFile(dismissedAlertsPath(workspaceRoot), `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    return dismissed;
}
