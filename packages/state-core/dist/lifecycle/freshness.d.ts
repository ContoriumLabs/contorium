import type { AdrRecord, CognitiveEvent } from '../cil/types.js';
import type { DecisionLifecycleMeta, DecisionLifecycleRecord } from './types.js';
export declare const DEFAULT_EXPIRE_DAYS: 180;
export declare const STALE_VERIFY_DAYS: 60;
/** Infer last time a decision appeared in cognitive events (linked or title match). */
export declare function inferLastUsedAt(adr: AdrRecord, events: CognitiveEvent[]): string | undefined;
/** Freshness score 0-100 from verification age, usage, and ADR freshness label. */
export declare function computeFreshnessScore(adr: AdrRecord, meta: DecisionLifecycleMeta, lastUsedAt?: string): number;
export declare function isDecisionExpired(adr: AdrRecord, meta: DecisionLifecycleMeta): boolean;
export declare function daysSinceVerified(adr: AdrRecord, meta: DecisionLifecycleMeta): number;
export declare function daysSinceUsed(meta: DecisionLifecycleMeta, lastUsedAt?: string): number | undefined;
/** Human-readable stale-authority warning. */
export declare function formatFreshnessWarning(record: Pick<DecisionLifecycleRecord, 'title' | 'days_since_verified' | 'freshness_score' | 'expired' | 'last_used_at' | 'days_since_used'>): string | undefined;
//# sourceMappingURL=freshness.d.ts.map