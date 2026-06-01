export type { AdapterKind, BootstrapStateJson, DualModeInput, StateEngineMode, StateSourceMetadata, WorkspaceScanFacts, WriteStateOptions, } from './types.js';
export { scanGitPorcelain } from './scanner/gitScan.js';
export { scanWorkspace } from './scanner/workspaceScanner.js';
export { buildDualModeInput, mergeStateWithScan, resolveStateEngineMode, } from './dualMode.js';
export { bootstrapStateFromScan, readStateJson, stateJsonExists, writeStateJson, } from './bootstrap/bootstrapState.js';
export { attachStateSource, parseStateSource } from './sourceMetadata.js';
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
//# sourceMappingURL=index.d.ts.map