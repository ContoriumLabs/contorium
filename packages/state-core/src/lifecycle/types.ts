import type { AdrStatus } from '../cil/types.js';

export const KNOWLEDGE_LIFECYCLE_SCHEMA = 'contorium.lifecycle.v3' as const;
export const KNOWLEDGE_HEALTH_SCHEMA = 'contorium.knowledge_health.v1' as const;
export const REVIEW_QUEUE_SCHEMA = 'contorium.review_queue.v1' as const;

/** Lifecycle status overlay — maps ADR status + graph edges. */
export type LifecycleDecisionStatus =
  | 'ACTIVE'
  | 'SUPERSEDED'
  | 'DEPRECATED'
  | 'ARCHIVED'
  | 'UNKNOWN';

export type VerificationType = 'automatic' | 'manual' | 'llm_assisted' | 'none';

export type ValiditySignalType =
  | 'CODE_CHANGE'
  | 'DEPENDENCY_CHANGE'
  | 'DEPENDENCY_REMOVAL'
  | 'OWNER_CHANGE'
  | 'ASSUMPTION_FAILURE'
  | 'ARCHITECTURE_CHANGE'
  | 'ADR_CONFLICT'
  | 'SUPERSEDED';

/** Validity state — why a decision may no longer be authoritative (优化.md §9). */
export type ValidityState =
  | 'VALID'
  | 'WARNING'
  | 'DECAYING'
  | 'SUSPECTED_INVALID'
  | 'NEEDS_REVALIDATION'
  | 'INVALIDATED'
  | 'ARCHIVED';

export type InvalidationChainLinkType =
  | ValiditySignalType
  | 'CHANGE_EVENT'
  | 'DECISION_IMPACT';

export interface InvalidationChainLink {
  type: InvalidationChainLinkType;
  event?: string;
  assumption?: string;
  impact?: 'low' | 'medium' | 'high';
  detail?: string;
}

export type ValiditySignalSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ValiditySignal {
  type: ValiditySignalType;
  detected_at: string;
  reason: string;
  severity: ValiditySignalSeverity;
  evidence?: string;
  detail?: string;
}

export interface AdrAssumption {
  statement: string;
  type: 'BUSINESS_ASSUMPTION' | 'TECHNICAL_ASSUMPTION' | 'OPERATIONAL_ASSUMPTION';
}

export interface SupersededContext {
  reason?: string;
  replacement?: string;
}

export interface DecisionLifecycleMeta {
  owner?: string;
  /** Set when owner changes — triggers OWNER_CHANGE validity signal. */
  previous_owner?: string;
  owner_changed_at?: string;
  reviewer?: string;
  confirmed_by?: string;
  verified_at?: string;
  verified_by?: string;
  verification_type?: VerificationType;
  /** Days until review required; default 180 for accepted ADRs. */
  expire_after_days?: number;
  last_used_at?: string;
  /** Optional persisted assumptions (otherwise extracted from ADR reason). */
  assumptions?: AdrAssumption[];
  /** Why the decision was last revalidated (优化.md §10). */
  verified_reason?: string;
  verification_evidence?: string[];
  /** Clears transient invalidation baselines after verify. */
  last_invalidation_reset_at?: string;
}

export interface LifecycleEvidenceRef {
  source: 'adr' | 'code' | 'event' | 'metadata';
  path?: string;
  term?: string;
  detail: string;
  confidence?: number;
}

export interface KnowledgeConfidenceDimensions {
  source: number;
  freshness: number;
  conflict: number;
  ownership: number;
  verification: number;
  consistency: number;
  usage: number;
  overall: number;
}

export interface DecisionLifecycleRecord {
  decision_id: string;
  title: string;
  adr_status: AdrStatus;
  lifecycle_status: LifecycleDecisionStatus;
  created_at: string;
  last_verified_at?: string;
  days_since_verified?: number;
  last_used_at?: string;
  days_since_used?: number;
  freshness_score: number;
  expired: boolean;
  needs_review: boolean;
  meta: DecisionLifecycleMeta;
  confidence: KnowledgeConfidenceDimensions;
  superseded_by?: string;
  supersedes?: string[];
  evolution_chain: string[];
  conflict_refs: string[];
  evidence: LifecycleEvidenceRef[];
  formatted_warnings: string[];
  /** v2 — validity causality layer */
  validity_state: ValidityState;
  validity_signals: ValiditySignal[];
  invalidation_score: number;
  decay_penalty: number;
  superseded_context?: SupersededContext;
  assumptions?: AdrAssumption[];
  /** v3 — causal chain from change event to decision impact (优化.md §8). */
  invalidation_reason_chain?: InvalidationChainLink[];
}

export interface DecisionValidityHealth {
  active_decisions: number;
  valid_decisions: number;
  warning_decisions: number;
  decaying_decisions: number;
  suspected_invalid_decisions: number;
  needs_revalidation_decisions: number;
  invalidated_decisions: number;
  unresolved_impacts: number;
}

export interface KnowledgeHealthDimensions {
  completeness: number;
  freshness: number;
  ownership: number;
  verification: number;
  conflict: number;
  drift: number;
  review_debt: number;
  overall: number;
}

export interface KnowledgeHealthReport {
  schema: typeof KNOWLEDGE_HEALTH_SCHEMA;
  updated_at: string;
  projection_of: 'cognitive_events';
  derived_from: string[];
  score: number;
  dimensions: KnowledgeHealthDimensions;
  expired_decisions: number;
  stale_decisions: number;
  conflict_count: number;
  missing_owner_count: number;
  unverified_count: number;
  /** v3 — lifecycle validity rollup (优化.md §14). */
  decision_validity_health?: DecisionValidityHealth;
  formatted: string[];
}

export interface ReviewQueueItem {
  decision_id: string;
  title: string;
  reason:
    | 'expired'
    | 'stale'
    | 'unverified'
    | 'conflict'
    | 'missing_owner'
    | 'invalidation_trigger';
  /** Present when reason === invalidation_trigger */
  trigger_type?: ValiditySignalType;
  detail: string;
  days?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action_hint?: string;
  evidence?: LifecycleEvidenceRef[];
}

export interface ReviewQueueArtifact {
  schema: typeof REVIEW_QUEUE_SCHEMA;
  updated_at: string;
  items: ReviewQueueItem[];
  formatted: string[];
}

export interface KnowledgeLifecycleIndex {
  schema: typeof KNOWLEDGE_LIFECYCLE_SCHEMA;
  updated_at: string;
  projection_of: 'cognitive_events';
  derived_from: string[];
  decisions: DecisionLifecycleRecord[];
  health: KnowledgeHealthReport;
  review_queue: ReviewQueueItem[];
}
