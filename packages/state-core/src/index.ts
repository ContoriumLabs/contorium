export type {
  AdapterKind,
  BootstrapStateJson,
  DualModeInput,
  StateEngineMode,
  StateSourceMetadata,
  WorkspaceScanFacts,
  WriteStateOptions,
} from './types.js';

export { scanGitPorcelain } from './scanner/gitScan.js';
export {
  isGitSubprocessAllowed,
  setGitSubprocessAllowed,
  traceGitInvocation,
} from './scanner/gitRuntime.js';
export { scanWorkspace } from './scanner/workspaceScanner.js';

export {
  buildDualModeInput,
  mergeStateWithScan,
  resolveStateEngineMode,
} from './dualMode.js';

export {
  bootstrapStateFromScan,
  readStateJson,
  stateJsonExists,
  writeStateJson,
} from './bootstrap/bootstrapState.js';

export { attachStateSource, parseStateSource } from './sourceMetadata.js';
export {
  bumpWorkspaceActivity,
  readWorkspaceActivity,
  type WorkspaceActivityBump,
  type WorkspaceActivityKind,
} from './dashboardActivity.js';

export {
  PROJECT_BUILT_STATE_VERSION,
  emptyProjectBuiltState,
  type ProjectBuiltState,
} from './state-builder/types.js';
export {
  normalizeProjectBuiltState,
  filterWeakInferenceLines,
} from './state-builder/normalization.js';
export {
  formatProjectSnapshotMarkdown,
  projectSnapshotBulletLines,
} from './state-builder/snapshot.js';
export { buildProjectStateFromScan } from './state-builder/buildFromScan.js';
export {
  builderDir,
  parseProjectBuiltState,
  readProjectBuiltState,
  readProjectSnapshotMarkdown,
  writeProjectBuiltState,
} from './state-builder/store.js';
export { rebuildArtifactsFromScan } from './state-builder/rebuildFromScan.js';

export {
  syncWorkspaceState,
  readWorkspaceStatus,
  type AdapterSyncResult,
} from './adapterSync.js';

/** @deprecated use formatProjectSnapshotMarkdown + buildProjectStateFromScan */
export { formatProjectSnapshotMarkdown as formatBootstrapSnapshotMarkdown } from './state-builder/snapshot.js';
/** @deprecated use rebuildArtifactsFromScan */
export { rebuildArtifactsFromScan as writeBootstrapArtifacts } from './state-builder/rebuildFromScan.js';
/** @deprecated use buildProjectStateFromScan */
export { buildProjectStateFromScan as buildBootstrapProjectState } from './state-builder/buildFromScan.js';

export {
  CliAdapter,
  IdeAdapter,
  McpAdapter,
  type ContoriumAdapter,
} from './adapters.js';

export type {
  ChangeArtifact,
  GraphEdge,
  GraphNode,
  HandoffArtifact,
  HandoffNextAction,
  KeyChange,
  ImpactArtifact,
  IntentArtifact,
  ProjectGraph,
  ProjectTimeline,
  RiskLevel,
  TimelineEntry,
} from './understanding/types.js';
export { UNDERSTANDING_VERSION } from './understanding/types.js';
export {
  buildAndWriteUnderstandingArtifacts,
  buildUnderstandingArtifacts,
  type UnderstandingBuildInput,
  type UnderstandingBuildResult,
} from './understanding/buildUnderstanding.js';
export {
  readChangeArtifact,
  readHandoffArtifact,
  readImpactArtifact,
  readIntentArtifact,
  readProjectGraph,
  readProjectTimeline,
  readUnderstandingGraph,
  normalizeHandoff,
  writeUnderstandingArtifacts,
  deleteUnderstandingArtifacts,
} from './understanding/store.js';
export {
  formatHandoffMarkdown,
  formatNextActionBullet,
  buildUnderstandingExportJson,
} from './understanding/formatHandoff.js';
export {
  CHP_VERSION,
  buildChpHandoffState,
  buildChpHandoffStateSync,
  formatChpCompact,
  formatChpMarkdown,
  getProjectHandoff,
  type ChpAgentContext,
  type ChpHandoffFormat,
  type ChpHandoffState,
  type ChpRecentChange,
  type BuildChpHandoffInput,
} from './understanding/chpHandoff.js';
export {
  buildUnderstandingGraph,
  type UnderstandingGraph,
} from './understanding/understandingGraphBuilder.js';
export { formatUnderstandingMiniGraph } from './understanding/miniGraph.js';
export {
  readProjectKnowledgeGraph,
  readKnowledgeSnapshot,
  writeProjectKnowledgeGraph,
  deleteProjectKnowledgeGraph,
} from './understanding/knowledgeGraph/store.js';
export {
  buildProjectKnowledgeGraph,
  type KnowledgeGraphBuildInput,
} from './understanding/knowledgeGraph/knowledgeGraphBuilder.js';
export { normalizeKnowledgeGraph, buildGraphMetadata } from './understanding/knowledgeGraph/normalize.js';
export { buildHotspots } from './understanding/knowledgeGraph/hotspotBuilder.js';
export {
  buildKnowledgeSnapshot,
  filterMappingsByConfidence,
} from './understanding/knowledgeGraph/snapshotBuilder.js';
export {
  GRAPH_CANONICAL_MIN_CONFIDENCE,
  CLOSURE_VERSION,
  SNAPSHOT_TOP_INTENTS,
  SNAPSHOT_TOP_HOTSPOTS,
  SNAPSHOT_TOP_FUNCTIONS,
} from './understanding/knowledgeGraph/closureConstants.js';
export {
  computeUnifiedConfidence,
  clampConfidence,
  isCanonicalConfidence,
  splitMappingsByCanonicalThreshold,
  confidenceBandLabel,
} from './understanding/knowledgeGraph/confidence.js';
export {
  resolveKnowledgeRebuildTrigger,
  shouldRebuildKnowledgeGraph,
  type KnowledgeRebuildTrigger,
} from './understanding/knowledgeGraph/rebuildTrigger.js';
export type {
  ProjectKnowledgeGraph,
  GraphMetadata,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraphTreeNode,
  IntentFunctionMapping,
  ReasonTraceItem,
  HotspotNode,
  HotspotLifecycle,
  KnowledgeSnapshot,
} from './understanding/knowledgeGraph/types.js';
export {
  parseFileWithAdapter,
  IncrementalParseCache,
  type ParseBackend,
  type ParseFileOptions,
} from './understanding/treeSitterParser.js';
export { extractFromSource, isCodeFile, isTrackableFile } from './understanding/extractor.js';
export {
  formatCanonicalAiMarkdown,
  formatAiHandoffExecutionBlock,
  formatNextActionPlain,
  normalizeGraphRef,
  type CanonicalAiExportInput,
} from './understanding/formatCanonicalExport.js';
export {
  checkActiveRuntime,
  confirmHandoffInjection,
  prepareHandoffInjection,
  readConfirmedHandoffContext,
  readHandoffInjectionState,
  skipHandoffInjection,
  syncInjectionWithRuntime,
  buildInjectionPromptMessage,
  type HandoffInjectionState,
  type HandoffInjectionStatus,
  type PrepareHandoffOptions,
} from './semiAutoHandoff.js';
export { getContoriumPackageVersion } from './version.js';
