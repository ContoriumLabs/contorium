import type { KnowledgeLifecycleIndex, ValidityState } from './types.js';
export declare const GOVERNANCE_DISMISSED_ALERTS_SCHEMA: "contorium.governance_dismissed_alerts.v1";
export type GovernanceAlertImpact = 'low' | 'medium' | 'high';
/** Proactive IDE banner payload (优化.md §11 — sidebar top, not modal). */
export interface GovernanceImpactAlert {
    id: string;
    decision_id: string;
    decision_title: string;
    validity_state: ValidityState;
    changed: string;
    affected_assumption?: string;
    impact: GovernanceAlertImpact;
    reason: string;
    confidence: number;
    detected_at: string;
    chain_steps?: string[];
}
export interface GovernanceAlertPanel {
    alerts: GovernanceImpactAlert[];
    top_alert: GovernanceImpactAlert | null;
    total_count: number;
    dismissed_count: number;
}
export declare function buildGovernanceImpactAlerts(index: KnowledgeLifecycleIndex, dismissedIds?: ReadonlySet<string>): GovernanceImpactAlert[];
export declare function buildGovernanceAlertPanel(index: KnowledgeLifecycleIndex | null | undefined, dismissedIds?: ReadonlySet<string>): GovernanceAlertPanel;
export declare function readDismissedGovernanceAlerts(workspaceRoot: string): Promise<Set<string>>;
export declare function dismissGovernanceAlert(workspaceRoot: string, alertId: string): Promise<Set<string>>;
//# sourceMappingURL=governanceAlerts.d.ts.map