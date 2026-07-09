export type { AdapterKind, BootstrapStateJson, DualModeInput, StateEngineMode, StateSourceMetadata, WorkspaceScanFacts, WriteStateOptions, } from './types.js';
export { scanGitPorcelain } from './scanner/gitScan.js';
export { isGitSubprocessAllowed, setGitSubprocessAllowed, traceGitInvocation, } from './scanner/gitRuntime.js';
export { scanWorkspace } from './scanner/workspaceScanner.js';
export { buildDualModeInput, mergeStateWithScan, resolveStateEngineMode, } from './dualMode.js';
export { bootstrapStateFromScan, readStateJson, stateJsonExists, writeStateJson, } from './bootstrap/bootstrapState.js';
export { attachStateSource, parseStateSource } from './sourceMetadata.js';
export { bumpWorkspaceActivity, readWorkspaceActivity, type WorkspaceActivityBump, type WorkspaceActivityKind, } from './dashboardActivity.js';
export { PROJECT_BUILT_STATE_VERSION, emptyProjectBuiltState, type ProjectBuiltState, } from './state-builder/types.js';
export { normalizeProjectBuiltState, filterWeakInferenceLines, } from './state-builder/normalization.js';
export { formatProjectSnapshotMarkdown, projectSnapshotBulletLines, } from './state-builder/snapshot.js';
export { buildProjectStateFromScan } from './state-builder/buildFromScan.js';
export { builderDir, parseProjectBuiltState, readProjectBuiltState, readProjectSnapshotMarkdown, writeProjectBuiltState, } from './state-builder/store.js';
export { rebuildArtifactsFromScan } from './state-builder/rebuildFromScan.js';
export { syncWorkspaceState, readWorkspaceStatus, type AdapterSyncResult, } from './adapterSync.js';
/** @deprecated use formatProjectSnapshotMarkdown + buildProjectStateFromScan */
export { formatProjectSnapshotMarkdown as formatBootstrapSnapshotMarkdown } from './state-builder/snapshot.js';
/** @deprecated use rebuildArtifactsFromScan */
export { rebuildArtifactsFromScan as writeBootstrapArtifacts } from './state-builder/rebuildFromScan.js';
/** @deprecated use buildProjectStateFromScan */
export { buildProjectStateFromScan as buildBootstrapProjectState } from './state-builder/buildFromScan.js';
export { CliAdapter, IdeAdapter, McpAdapter, type ContoriumAdapter, } from './adapters.js';
export type { ChangeArtifact, GraphEdge, GraphNode, HandoffArtifact, HandoffNextAction, KeyChange, ImpactArtifact, IntentArtifact, ProjectGraph, ProjectTimeline, RiskLevel, TimelineEntry, } from './understanding/types.js';
export { UNDERSTANDING_VERSION } from './understanding/types.js';
export { buildAndWriteUnderstandingArtifacts, buildUnderstandingArtifacts, type UnderstandingBuildInput, type UnderstandingBuildResult, } from './understanding/buildUnderstanding.js';
export { readChangeArtifact, readHandoffArtifact, readImpactArtifact, readIntentArtifact, readProjectGraph, readProjectTimeline, readUnderstandingGraph, normalizeHandoff, writeUnderstandingArtifacts, deleteUnderstandingArtifacts, } from './understanding/store.js';
export { formatHandoffMarkdown, formatNextActionBullet, buildUnderstandingExportJson, } from './understanding/formatHandoff.js';
export { CHP_VERSION, buildChpHandoffState, buildChpHandoffStateSync, formatChpCompact, formatChpMarkdown, getProjectHandoff, type ChpAgentContext, type ChpHandoffFormat, type ChpHandoffState, type ChpRecentChange, type BuildChpHandoffInput, } from './understanding/chpHandoff.js';
export { buildUnderstandingGraph, type UnderstandingGraph, } from './understanding/understandingGraphBuilder.js';
export { formatUnderstandingMiniGraph } from './understanding/miniGraph.js';
export { readProjectKnowledgeGraph, readKnowledgeSnapshot, writeProjectKnowledgeGraph, deleteProjectKnowledgeGraph, } from './understanding/knowledgeGraph/store.js';
export { buildProjectKnowledgeGraph, type KnowledgeGraphBuildInput, } from './understanding/knowledgeGraph/knowledgeGraphBuilder.js';
export { normalizeKnowledgeGraph, buildGraphMetadata } from './understanding/knowledgeGraph/normalize.js';
export { buildHotspots } from './understanding/knowledgeGraph/hotspotBuilder.js';
export { buildKnowledgeSnapshot, filterMappingsByConfidence, } from './understanding/knowledgeGraph/snapshotBuilder.js';
export { GRAPH_CANONICAL_MIN_CONFIDENCE, CLOSURE_VERSION, SNAPSHOT_TOP_INTENTS, SNAPSHOT_TOP_HOTSPOTS, SNAPSHOT_TOP_FUNCTIONS, } from './understanding/knowledgeGraph/closureConstants.js';
export { computeUnifiedConfidence, clampConfidence, isCanonicalConfidence, splitMappingsByCanonicalThreshold, confidenceBandLabel, } from './understanding/knowledgeGraph/confidence.js';
export { resolveKnowledgeRebuildTrigger, shouldRebuildKnowledgeGraph, type KnowledgeRebuildTrigger, } from './understanding/knowledgeGraph/rebuildTrigger.js';
export type { ProjectKnowledgeGraph, GraphMetadata, KnowledgeNode, KnowledgeEdge, KnowledgeGraphTreeNode, IntentFunctionMapping, ReasonTraceItem, HotspotNode, HotspotLifecycle, KnowledgeSnapshot, } from './understanding/knowledgeGraph/types.js';
export { parseFileWithAdapter, IncrementalParseCache, type ParseBackend, type ParseFileOptions, } from './understanding/treeSitterParser.js';
export { extractFromSource, isCodeFile, isTrackableFile } from './understanding/extractor.js';
export { formatCanonicalAiMarkdown, formatAiHandoffExecutionBlock, formatNextActionPlain, normalizeGraphRef, type CanonicalAiExportInput, } from './understanding/formatCanonicalExport.js';
export { checkActiveRuntime, confirmHandoffInjection, prepareHandoffInjection, readConfirmedHandoffContext, readHandoffInjectionState, skipHandoffInjection, syncInjectionWithRuntime, buildInjectionPromptMessage, type HandoffInjectionState, type HandoffInjectionStatus, type PrepareHandoffOptions, } from './semiAutoHandoff.js';
export { getContoriumPackageVersion } from './version.js';
export type { ChangeLog, ChangeRecord, CognitiveGraph, CognitiveIntent, CognitiveRisk, Constitution, ExecutionGuardResult, GovernanceAction, GovernanceBundle, GuardAction, GuardDetection, GuardSession, HardcodedEntry, Identity, IdentityHistory, PreActionCheckInput, ProjectCognitiveState, RiskSeverity, TruthLayer, UserRequestOverlay, ValidationResult, ValidationStatus, AdapterPreWriteResult, } from './governance/types.js';
export { defaultConstitution, defaultIdentity, defaultTruthLayer, } from './governance/defaults.js';
export { appendExecutionLog, governanceExists, readChangeLog, readConstitution, readCognitiveGraph, readCognitiveIntent, readCognitiveState, readIdentity, readTruthLayer, } from './governance/store.js';
export { defaultForbiddenPatterns, getGovernanceSummary, loadGovernanceBundle, matchProtectedPath, normalizeProtectedPathRules, scanForbiddenPatterns, validateAction, validateActionWithBundle, validatePathChange, } from './governance/governanceEngine.js';
export { detectHardcodingInSnippet, } from './governance/hardcodeDetector.js';
export { guardActionLabel, preActionCheck, } from './governance/executionGuard.js';
export { ensureGovernanceLayer, syncIdentityFocus, type EnsureGovernanceResult, } from './governance/init.js';
export { syncCognitiveLayer } from './governance/cognitiveProjection.js';
export { updateCognitiveFromInput, type CognitiveUpdateResult, } from './governance/cognitiveLoop.js';
export { analyzeProject, getProjectState, refreshProjectCognitive, validateChange, } from './governance/internalApi.js';
export { listRecentChanges, validateAndTrackChange, type ValidateAndTrackResult, } from './governance/changeTracker.js';
export { adapterPreWriteHook, getGuardReminder, GUARD_SESSION_TTL_MS, isGuardSessionFresh, recordGuardSession, } from './governance/adapterHook.js';
export { V3_CORE_FREEZE_VERSION } from './governance/types.js';
export { readGuardSession, readUserRequestOverlay, } from './governance/store.js';
export type { ControlAnalyzeResult, ControlCheckResult, ControlExecuteInput, ControlExecuteResult, ControlGovernanceResult, ControlIntentResult, ControlSurfaceContext, } from './control-core/types.js';
export { ContoriumControlSurface, createControlSurface } from './control-core/index.js';
export { buildGovernanceReviewArtifact, buildGovernanceRulesLines, computeGovernanceScore, formatGovernanceExportSection, formatGovernanceReviewYaml, formatReviewForInject, readGovernanceReview, writeGovernanceReview, estimateTokens as estimateGovernanceTokens, type BuildReviewOptions, type GovernanceReviewArtifact, type ReviewScope, type ReviewSource, } from './governance/governanceReview.js';
export { GOVERNANCE_ARTIFACT_FILES, GOVERNANCE_SCHEMA, buildGovernanceScopeFromReview, buildGovernanceSupplement, buildGovernanceTraceSteps, governanceModeLabel, loadGovernanceArtifactBundle, loadGovernanceDashboardSnapshot, mapGovernanceDecisionAction, persistGovernanceCycleArtifacts, persistGovernanceArtifacts, readGovernanceCycle, readGovernanceDecision, readGovernanceScopeArtifact, readGovernanceTrace, readGovernanceTraceSummary, scopeArtifactToMap, scopeMapToArtifact, validateArtifactSchema, type GovernanceArtifactBundle, type GovernanceArtifactHeader, type GovernanceArtifactSource, type GovernanceCycleArtifact, type GovernanceCycleMode, type GovernanceDashboardSnapshot, type GovernanceDecisionAction, type GovernanceDecisionArtifact, type GovernanceScopeArtifact, type GovernanceScopeFiles, type GovernanceScopeMap, type GovernanceTraceFullArtifact, type GovernanceTraceSummaryArtifact, } from './governance/governanceArtifacts.js';
export { buildGovernanceAwareExportText, buildGovernanceExportAppendixFull, type GovernanceAwareExportInput, } from './governance/governanceExportUnified.js';
export { getGitStagedDiff, listGitStagedRelativePaths, pickHigherRiskReview, reviewGitStagedChanges, } from './governance/gitStagedReview.js';
export { getGitCommitFileDiff, listGitCommitRelativePaths, mergeReviewArtifacts, reviewGitCommitChanges, reviewOpenFilesChanges, reviewScopedFiles, type ReviewScopePreference, type ScopedFileReviewInput, } from './governance/scopeReview.js';
export { analyzeChange, computeChangeConfidence, type ChangeAnalysis, type ChangeAnalysisInput, type ChangeSeverity, type ChangeType } from './governance/changeAnalyzer.js';
export { computeGovernanceImpact, computeGovernanceRisk, recommendationFor, type GovernanceImpact, type GovernanceRecommendation, type GovernanceRisk, type RiskEngineInput, type RiskEngineResult, } from './governance/riskEngine.js';
export { buildGovernanceInjectPreview, compileGovernanceInjectPrompt, getRelevantGovernanceForFile, type GovernanceInjectInput, type GovernanceInjectMode, type RelevantGovernanceForFile, } from './prompt-engine/index.js';
export type { ProjectIdentity, IntentNodeVNext, IntentGraphVNext, DecisionProvenanceNode, DecisionProvenanceGraph, WhyFeatureEntry, WhyLayerArtifact, CognitionStabilityMeta, CognitionConfidenceMeta, ConfidenceCategory, ConfidenceSignalSources, ConfidenceIndexEntry, ConfidenceIndexArtifact, ProvenanceChainLink, ProvenanceChainEntry, ProvenanceChainArtifact, EvolutionGraphNode, EvolutionGraphChain, EvolutionGraphArtifact, ProjectIntelligenceRepositoryState, ProjectIntelligenceSnapshot, ProjectIntelligenceHealth, ProjectIntelligenceHealthMetrics, ProjectIntelligenceValidation, SchemaValidationIssue, EvolutionEventType, ProjectEvolutionEvent, ProjectEvolutionTimeline, ImpactedNode, ImpactGraphEntry, ImpactGraphArtifact, StabilitySignalSources, StabilityIndexEntry, StabilityIndexArtifact, CognitiveEngineState, CognitiveSnapshot, } from './intelligence/types.js';
export { PROJECT_INTELLIGENCE_SCHEMA, DECISION_PROVENANCE_SCHEMA, WHY_LAYER_SCHEMA, INTENT_VNEXT_SCHEMA, PROJECT_EVOLUTION_SCHEMA, IMPACT_GRAPH_SCHEMA, CONFIDENCE_INDEX_SCHEMA, STABILITY_INDEX_SCHEMA, PROVENANCE_CHAIN_SCHEMA, EVOLUTION_GRAPH_SCHEMA, PROJECT_INTELLIGENCE_REPOSITORY_SCHEMA, PROJECT_INTELLIGENCE_HEALTH_SCHEMA, PROJECT_INTELLIGENCE_VALIDATION_SCHEMA, COGNITIVE_ENGINE_SCHEMA, } from './intelligence/types.js';
export { readProjectIdentity, syncProjectIdentity, } from './intelligence/projectIdentity.js';
export { readDecisionProvenanceGraph, deriveDecisionProvenanceNode, 
/** @deprecated use deriveDecisionProvenanceNode */
buildDecisionProvenanceNode, appendDecisionProvenanceNode, } from './intelligence/decisionProvenance.js';
export { readWhyLayer, syncWhyLayer, } from './intelligence/whyLayer.js';
export { readIntentGraphVNext, readIntentNodesVNext, deriveIntentGraphVNext, projectIntentGraphVNext, 
/** @deprecated use deriveIntentGraphVNext */
mirrorIntentGraphVNext, } from './intelligence/intentVNext.js';
export { syncIntelligenceLayer } from './intelligence/syncIntelligenceLayer.js';
export { syncProjectIntelligenceRepository, 
/** @deprecated */
runCognitiveEngine, } from './intelligence/projectIntelligenceSync.js';
export { syncProjectIntelligenceDimensions, 
/** @deprecated */
syncCognitiveDimensions, } from './intelligence/dimensions/syncProjectIntelligenceDimensions.js';
export { readProjectEvolutionTimeline, queryProjectEvolutionTimeline, appendProjectEvolutionEvents, type ProjectTimelineQuery, } from './intelligence/dimensions/projectTimeline.js';
export { readImpactGraph, queryImpactGraph, deriveImpactPropagation, upsertImpactGraphEntry, } from './intelligence/dimensions/impactGraph.js';
export { readConfidenceIndex, queryConfidenceIndex, deriveConfidenceFromSignals, writeConfidenceIndex, } from './intelligence/dimensions/confidenceIndex.js';
export { 
/** @deprecated use readConfidenceIndex */
readStabilityIndex, 
/** @deprecated use queryConfidenceIndex */
queryStabilityIndex, 
/** @deprecated use deriveConfidenceFromSignals */
deriveStabilityFromSignals, 
/** @deprecated use writeConfidenceIndex */
writeStabilityIndex, } from './intelligence/dimensions/stabilityIndex.js';
export { readProvenanceChain, queryProvenanceChain, deriveProvenanceChains, } from './intelligence/systems/provenanceChain.js';
export { readEvolutionGraph, queryEvolutionGraph, deriveEvolutionGraph, } from './intelligence/systems/evolutionGraph.js';
export { migrateProjectIntelligenceLayout } from './intelligence/migration/artifactMigration.js';
export { validateProjectIntelligenceArtifacts } from './intelligence/schema/schemaValidation.js';
export { deriveProjectIntelligenceHealth, readProjectIntelligenceHealth, } from './intelligence/health/projectIntelligenceHealth.js';
export { computeHealthScore, classifyHealthScore, HEALTH_SCORE_WEIGHTS, } from './intelligence/metrics/health.js';
export { deriveKnowledgeCoverage } from './intelligence/metrics/coverage.js';
export { readDecisionLog, appendDecisionLogEntry, type DecisionLogArtifact, type DecisionLogEntry, } from './intelligence/systems/decisionLog.js';
export { TRANSFER_CONTEXT_TOKEN_TARGET, FULL_INTELLIGENCE_TOKEN_TARGET, loadTransferExportInput, buildTransferContextSnapshot, formatTransferContextMarkdown, formatTransferContextJson, finalizeTransferContextText, buildFullIntelligenceMarkdown, toTransferContextPayload, transferExportModeLabel, trimStringToTokenBudget, type TransferContextSnapshot, type TransferExportInput, type TransferExportMode, } from './intelligence/export/cognitiveTransfer.js';
export { captureProjectFocus, captureProjectNote, captureProjectDecision, type CaptureFocusResult, type CaptureNoteResult, type CaptureDecisionInput, type CaptureDecisionResult, } from './pil/capture/index.js';
export { retrieveProjectState, retrieveIntentGraph, retrieveDecisionBundle, retrieveTimeline, retrieveGraph, retrieveConfidence, retrieveImpact, retrieveWhy, retrieveHealth, retrieveEvolution, retrieveProvenance, retrieveHandoff, } from './pil/retrieve/index.js';
export { askProject, buildProjectJourney, buildTransferStory, exploreHistory, exploreImpact, freshnessFromAge, freshnessLabelText, getBlastRadius, getDecisionCenter, getModuleHistory, getNextActions, getProjectStory, getRecentEvents, readAllAdrRecords, readAllCognitiveEvents, syncCognitiveInteractionLayer, runCognitiveKernel, routeQuery, readDecisionGraph, deriveNextActions, exploreModuleHistoryFeed, findSnapshotByDate, listProjectSnapshots, computeCognitiveHealth, readCognitiveHealthReport, exploreEntityKnowledge, queryTimeTravel, buildProjectEssence, buildHandoffReplay, detectDecisionContradictions, buildProjectDna, buildSuggestedQuestions, ensureProjectIntentKernel, fuseSemanticContext, isDirectionQuery, isDriftQuery, isStoryIdentityQuery, detectProjectDrift, type NextActionItem, type ModuleHistoryRecord, type ProjectSnapshotRecord, type AdrStatus, type CilIntent, type KernelInput, type KernelOutput, type CilStructuredResponse, type AdrRecord, type AskProjectResult, type AskSemanticBundle, type BlastRadiusResult, type CognitiveEvent, type HistoryExplorerResult, type HistoryRange, type ProjectJourneyStage, type TransferStoryPayload, type CognitiveHealthReport, type KnowledgeEntityRecord, type TimeTravelResult, type DecisionContradiction, type ProjectEssence, type ProjectIntentKernel, type DriftReport, type HandoffReplayResult, } from './cil/index.js';
export { persistKnowledgeLifecycle, readKnowledgeLifecycle, readReviewQueueArtifact, computeKnowledgeLifecycle, enrichDecisionAskAnswer, extractDecisionRefsFromAskResult, formatReviewQueue, formatDecisionLifecycleAnswer, findDecisionLifecycle, formatValidityStateLabel, writeDecisionLifecycleMeta, readDecisionLifecycleMeta, appendLifecycleTrustWarnings, appendLifecycleTrustOverlay, listLifecycleDecisionsForPicker, lifecycleRoot, KNOWLEDGE_LIFECYCLE_SCHEMA, KNOWLEDGE_HEALTH_SCHEMA, REVIEW_QUEUE_SCHEMA, type KnowledgeLifecycleIndex, type KnowledgeHealthReport, type KnowledgeHealthDimensions, type DecisionLifecycleRecord, type DecisionLifecycleMeta, type ReviewQueueItem, type ReviewQueueArtifact, type KnowledgeConfidenceDimensions, type LifecycleDecisionStatus, type ValidityState, type ValiditySignal, type ValiditySignalType, } from './lifecycle/index.js';
export type { AiProviderId, AiModuleId, AiGenerateResult, AIProvider, AIResponse, GenerateOptions, IntentRouterConfig, IntentRouterMode, LlmConfig, LlmCacheConfig, } from './ai/index.js';
export { DEFAULT_LLM_CONFIG, LLM_CONFIG_REL, LLM_LOCAL_KEY_REL, LLM_KEYS_REL, CONTORIUM_LLM_API_KEY_ENV, aiGenerate, enhanceAskAnswer, generateDnaWithAi, generateEssenceWithAi, generateStoryWithAi, generateWhyExplanation, getAiProvider, getAiProviderFromConfig, getAiStatus, hasLocalLlmKey, hasProviderLlmKey, isAiModuleEnabled, listConfiguredLlmProviders, llmConfigPath, llmKeysPath, localLlmKeyPath, providerLabel, readLlmConfig, readLocalLlmKey, readProviderLlmKey, resolveApiKey, resolveApiKeyForWorkspace, routeIntent, testAiConnection, writeLlmConfig, writeLocalLlmKey, writeProviderLlmKey, } from './ai/index.js';
export { CONTORIUM_VERSION, REPOSITORY_RUNTIME_VERSION, ARTIFACT_SCHEMA_VERSION, 
/** @deprecated use REPOSITORY_RUNTIME_VERSION */
REPOSITORY_SCHEMA_VERSION, } from './intelligence/paths.js';
//# sourceMappingURL=index.d.ts.map