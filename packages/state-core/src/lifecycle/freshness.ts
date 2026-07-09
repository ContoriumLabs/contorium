import type { AdrRecord, CognitiveEvent } from '../cil/types.js';
import type { DecisionLifecycleMeta, DecisionLifecycleRecord } from './types.js';
import { LIFECYCLE_POLICY } from './policy.js';

export const DEFAULT_EXPIRE_DAYS = LIFECYCLE_POLICY.defaultExpireDays;
export const STALE_VERIFY_DAYS = LIFECYCLE_POLICY.staleVerifyDays;

function daysSince(iso: string | undefined): number {
  if (!iso) {
    return 999;
  }
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) {
    return 999;
  }
  return (Date.now() - parsed) / (24 * 60 * 60 * 1000);
}

/** Infer last time a decision appeared in cognitive events (linked or title match). */
export function inferLastUsedAt(adr: AdrRecord, events: CognitiveEvent[]): string | undefined {
  let latest = 0;
  const titleNeedle = adr.title.toLowerCase().slice(0, 24);

  for (const evt of events) {
    const linked =
      evt.linked_decision_id === adr.id ||
      evt.decision === adr.id ||
      (evt.decision && adr.title && evt.decision.toLowerCase().includes(titleNeedle));
    const mentioned =
      titleNeedle.length >= 4 &&
      (evt.title.toLowerCase().includes(titleNeedle) ||
        evt.summary.toLowerCase().includes(titleNeedle) ||
        (evt.why?.toLowerCase().includes(titleNeedle) ?? false));
    if (!linked && !mentioned) {
      continue;
    }
    const ts = Date.parse(evt.timestamp);
    if (Number.isFinite(ts) && ts > latest) {
      latest = ts;
    }
  }

  return latest > 0 ? new Date(latest).toISOString() : undefined;
}

/** Freshness score 0-100 from verification age, usage, and ADR freshness label. */
export function computeFreshnessScore(
  adr: AdrRecord,
  meta: DecisionLifecycleMeta,
  lastUsedAt?: string,
): number {
  const verifiedAt = meta.verified_at ?? adr.last_verified ?? adr.date;
  const age = daysSince(verifiedAt);
  const expireDays = meta.expire_after_days ?? DEFAULT_EXPIRE_DAYS;

  let score = 100;
  if (age > expireDays) {
    score = Math.max(5, 100 - (age - expireDays) * 0.4);
  } else if (age > STALE_VERIFY_DAYS) {
    score = Math.max(20, 100 - (age - STALE_VERIFY_DAYS) * 1.2);
  }

  if (adr.freshness === 'stale') {
    score = Math.min(score, 25);
  } else if (adr.freshness === 'unknown') {
    score = Math.min(score, 40);
  }

  const usedAt = meta.last_used_at ?? lastUsedAt;
  const usedAge = daysSince(usedAt);
  if (usedAt && usedAge > expireDays * 1.5) {
    score = Math.min(score, Math.max(10, score - 15));
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function isDecisionExpired(adr: AdrRecord, meta: DecisionLifecycleMeta): boolean {
  const expireDays = meta.expire_after_days ?? DEFAULT_EXPIRE_DAYS;
  const verifiedAt = meta.verified_at ?? adr.last_verified ?? adr.date;
  return daysSince(verifiedAt) > expireDays;
}

export function daysSinceVerified(adr: AdrRecord, meta: DecisionLifecycleMeta): number {
  return Math.round(daysSince(meta.verified_at ?? adr.last_verified ?? adr.date));
}

export function daysSinceUsed(meta: DecisionLifecycleMeta, lastUsedAt?: string): number | undefined {
  const used = meta.last_used_at ?? lastUsedAt;
  if (!used) {
    return undefined;
  }
  return Math.round(daysSince(used));
}

/** Human-readable stale-authority warning. */
export function formatFreshnessWarning(
  record: Pick<
    DecisionLifecycleRecord,
    'title' | 'days_since_verified' | 'freshness_score' | 'expired' | 'last_used_at' | 'days_since_used'
  >,
): string | undefined {
  if (record.expired && record.days_since_verified != null) {
    return `This decision has not been verified for ${record.days_since_verified} days.`;
  }
  if (record.freshness_score < 50 && record.days_since_verified != null) {
    return `Freshness ${record.freshness_score}% - last verified ${record.days_since_verified} days ago.`;
  }
  if (record.days_since_used != null && record.days_since_used > DEFAULT_EXPIRE_DAYS) {
    return `"${record.title}" has not appeared in project activity for ${record.days_since_used} days.`;
  }
  return undefined;
}


