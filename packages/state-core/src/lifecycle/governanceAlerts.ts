import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  DecisionLifecycleRecord,
  KnowledgeLifecycleIndex,
  ValidityState,
} from './types.js';

export const GOVERNANCE_DISMISSED_ALERTS_SCHEMA = 'contorium.governance_dismissed_alerts.v1' as const;

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

interface DismissedAlertsArtifact {
  schema: typeof GOVERNANCE_DISMISSED_ALERTS_SCHEMA;
  updated_at: string;
  dismissed_ids: string[];
}

function dismissedAlertsPath(workspaceRoot: string): string {
  return path.join(path.resolve(workspaceRoot), '.contora', 'governance', 'dismissed_impact_alerts.json');
}

const ACTIONABLE_STATES = new Set<ValidityState>([
  'WARNING',
  'DECAYING',
  'SUSPECTED_INVALID',
  'NEEDS_REVALIDATION',
]);

const IMPACT_RANK: Record<GovernanceAlertImpact, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function impactFromRecord(record: DecisionLifecycleRecord): GovernanceAlertImpact {
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

function changedFromRecord(record: DecisionLifecycleRecord): string {
  const chainEvent = record.invalidation_reason_chain?.find((c) => c.type === 'CHANGE_EVENT')?.event;
  if (chainEvent) {
    return chainEvent;
  }
  const dep = record.invalidation_reason_chain?.find(
    (c) => c.type === 'DEPENDENCY_REMOVAL' || c.type === 'DEPENDENCY_CHANGE',
  );
  if (dep?.event) {
    return dep.event;
  }
  const top = [...record.validity_signals].sort((a, b) => {
    const rank = { critical: 4, high: 3, medium: 2, low: 1 } as const;
    return rank[b.severity] - rank[a.severity];
  })[0];
  return top?.reason ?? 'Project change may affect this decision';
}

function assumptionFromRecord(record: DecisionLifecycleRecord): string | undefined {
  const fromChain = record.invalidation_reason_chain?.find((c) => c.type === 'ASSUMPTION_FAILURE')?.assumption;
  if (fromChain) {
    return fromChain;
  }
  return record.assumptions?.[0]?.statement;
}

function alertIdFor(record: DecisionLifecycleRecord, changed: string): string {
  const seed = changed.replace(/[^\w.-]+/g, '_').slice(0, 48);
  return `${record.decision_id}:${seed}`;
}

function recordToAlert(record: DecisionLifecycleRecord): GovernanceImpactAlert | null {
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
    const rank = { critical: 4, high: 3, medium: 2, low: 1 } as const;
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
    reason:
      topSignal?.detail ??
      record.invalidation_reason_chain?.find((c) => c.type === 'DECISION_IMPACT')?.detail ??
      `This decision may no longer match the current ${assumption ? 'assumptions' : 'codebase'}`,
    confidence: record.confidence.overall / 100,
    detected_at: topSignal?.detected_at ?? new Date().toISOString(),
    chain_steps: record.invalidation_reason_chain
      ?.map((c) => c.event ?? c.assumption ?? c.impact)
      .filter((x): x is string => Boolean(x))
      .slice(0, 6),
  };
}

export function buildGovernanceImpactAlerts(
  index: KnowledgeLifecycleIndex,
  dismissedIds: ReadonlySet<string> = new Set(),
): GovernanceImpactAlert[] {
  const alerts: GovernanceImpactAlert[] = [];
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

export function buildGovernanceAlertPanel(
  index: KnowledgeLifecycleIndex | null | undefined,
  dismissedIds: ReadonlySet<string> = new Set(),
): GovernanceAlertPanel {
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

export async function readDismissedGovernanceAlerts(workspaceRoot: string): Promise<Set<string>> {
  try {
    const raw = JSON.parse(
      await fs.readFile(dismissedAlertsPath(workspaceRoot), 'utf8'),
    ) as DismissedAlertsArtifact;
    if (raw?.schema === GOVERNANCE_DISMISSED_ALERTS_SCHEMA && Array.isArray(raw.dismissed_ids)) {
      return new Set(raw.dismissed_ids);
    }
  } catch {
    // no dismiss file yet
  }
  return new Set();
}

export async function dismissGovernanceAlert(workspaceRoot: string, alertId: string): Promise<Set<string>> {
  const dismissed = await readDismissedGovernanceAlerts(workspaceRoot);
  dismissed.add(alertId);
  const artifact: DismissedAlertsArtifact = {
    schema: GOVERNANCE_DISMISSED_ALERTS_SCHEMA,
    updated_at: new Date().toISOString(),
    dismissed_ids: [...dismissed],
  };
  await fs.mkdir(path.dirname(dismissedAlertsPath(workspaceRoot)), { recursive: true });
  await fs.writeFile(dismissedAlertsPath(workspaceRoot), `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return dismissed;
}
