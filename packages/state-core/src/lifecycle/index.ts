export type {
  DecisionLifecycleMeta,
  DecisionLifecycleRecord,
  KnowledgeConfidenceDimensions,
  KnowledgeHealthDimensions,
  KnowledgeHealthReport,
  KnowledgeLifecycleIndex,
  LifecycleDecisionStatus,
  ReviewQueueArtifact,
  ReviewQueueItem,
  VerificationType,
  ValidityState,
  ValiditySignal,
  ValiditySignalType,
  AdrAssumption,
  SupersededContext,
} from './types.js';

export {
  KNOWLEDGE_LIFECYCLE_SCHEMA,
  KNOWLEDGE_HEALTH_SCHEMA,
  REVIEW_QUEUE_SCHEMA,
} from './types.js';

export {
  lifecycleRoot,
  lifecycleIndexPath,
  lifecycleReviewQueuePath,
  lifecycleMetaPath,
  LIFECYCLE_DIR,
} from './paths.js';

export {
  DEFAULT_EXPIRE_DAYS,
  STALE_VERIFY_DAYS,
  computeFreshnessScore,
  daysSinceVerified,
  daysSinceUsed,
  formatFreshnessWarning,
  inferLastUsedAt,
  isDecisionExpired,
} from './freshness.js';

export { LIFECYCLE_POLICY, type LifecyclePolicy } from './policy.js';

export { computeDecisionConfidence } from './confidence.js';

export { buildDecisionEvolutionChain, buildSupersededContext, mapAdrToLifecycleStatus } from './evolution.js';

export {
  computeDecisionInvalidation,
  resolveValidityState,
  suggestedValidityAction,
  formatValidityStateLabel,
} from './invalidation.js';

export { extractAdrAssumptions, detectAssumptionFailures } from './assumption.js';
export { scanDependencyValiditySignals } from './dependencyScanner.js';
export { DECAY_PENALTIES, decayPenaltyForSignals } from './decayPolicy.js';

export {
  buildReviewQueue,
  computeKnowledgeLifecycle,
  findDecisionLifecycle,
  formatDecisionLifecycleAnswer,
  formatReviewQueue,
} from './engine.js';

export { enrichDecisionAskAnswer, extractDecisionRefsFromAskResult } from './askBridge.js';

export {
  appendLifecycleTrustWarnings,
  formatLifecycleTrustWarnings,
  listLifecycleDecisionsForPicker,
  findLifecycleRecordByPickerId,
} from './askHints.js';

export {
  appendLifecycleTrustOverlay,
  formatSupersededDecisionPreamble,
} from './decisionCenterBridge.js';

export { detectCodeDecisionTensions, type CodeDecisionTension } from './codeContradiction.js';

export {
  persistKnowledgeLifecycle,
  readKnowledgeLifecycle,
  readReviewQueueArtifact,
  readDecisionLifecycleMeta,
  writeDecisionLifecycleMeta,
} from './store.js';
