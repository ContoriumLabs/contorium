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
  InvalidationChainLink,
  DecisionValidityHealth,
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
export { SHARED_STALE_VERIFY_DAYS } from './sharedThresholds.js';

export { computeDecisionConfidence } from './confidence.js';

export { buildDecisionEvolutionChain, buildSupersededContext, mapAdrToLifecycleStatus } from './evolution.js';

export {
  computeDecisionInvalidation,
  resolveValidityState,
  suggestedValidityAction,
  formatValidityStateLabel,
} from './invalidation.js';

export { extractAdrAssumptions, detectAssumptionFailures } from './assumption.js';
export {
  buildAssumptionGraph,
  persistAssumptionGraph,
  readAssumptionGraph,
  type AssumptionGraphArtifact,
  type AssumptionNode,
} from './assumptionGraph.js';
export {
  buildDecisionDependencyGraph,
  persistDecisionDependencyGraph,
  readDecisionDependencyGraph,
  type DecisionDependencyGraphArtifact,
} from './decisionDependencyGraph.js';
export {
  computeDecisionImpacts,
  formatDecisionWhyChain,
  type DecisionImpactResult,
} from './impactEngine.js';
export { applyLifecycleVerification, type LifecycleVerifyInput } from './verifyLifecycle.js';
export {
  buildGovernanceImpactAlerts,
  buildGovernanceAlertPanel,
  readDismissedGovernanceAlerts,
  dismissGovernanceAlert,
  GOVERNANCE_DISMISSED_ALERTS_SCHEMA,
  type GovernanceImpactAlert,
  type GovernanceAlertPanel,
  type GovernanceAlertImpact,
} from './governanceAlerts.js';
export { scanDependencyValiditySignals } from './dependencyScanner.js';
export {
  TECH_TERM_TO_PACKAGES,
  extractTechTerms,
  collectWorkspaceDependencyNames,
  detectDependencyManifestChanges,
} from './dependencyInventory.js';
export { DECAY_PENALTIES, decayPenaltyForSignals } from './decayPolicy.js';

export {
  buildReviewQueue,
  computeKnowledgeLifecycle,
  findDecisionLifecycle,
  formatDecisionLifecycleAnswer,
  formatDecisionWhyAnswer,
  formatReviewQueue,
} from './engine.js';

export { formatDecisionTimeline } from './decisionTimeline.js';

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
