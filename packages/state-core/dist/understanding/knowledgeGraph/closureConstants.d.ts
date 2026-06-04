/** V3.1 Final Engineering Closure — frozen thresholds (do not drift). */
export declare const CLOSURE_VERSION = "1";
/** Canonical graph: mappings/edges below this stay in inferenceMappings only. */
export declare const GRAPH_CANONICAL_MIN_CONFIDENCE = 0.7;
/** Unified confidence formula weights (semantic + temporal + git). */
export declare const CONFIDENCE_WEIGHT_SEMANTIC = 0.5;
export declare const CONFIDENCE_WEIGHT_TEMPORAL = 0.3;
export declare const CONFIDENCE_WEIGHT_GIT = 0.2;
/** Snapshot Top-N (compression projection from knowledge.json). */
export declare const SNAPSHOT_TOP_INTENTS = 5;
export declare const SNAPSHOT_TOP_HOTSPOTS = 10;
export declare const SNAPSHOT_TOP_FUNCTIONS = 10;
export declare const SNAPSHOT_TOP_NEXT_ACTIONS = 6;
/** Hotspot lifecycle score bands. */
export declare const HOTSPOT_SCORE_ACTIVE = 0.5;
export declare const HOTSPOT_SCORE_COOLING = 0.3;
/** Knowledge graph rebuild triggers. */
export declare const REBUILD_IDLE_MS = 60000;
export declare const REBUILD_FILE_THRESHOLD = 5;
/** Minimum raw mapping score before inference consideration. */
export declare const MAPPING_DISCOVERY_MIN_SCORE = 0.12;
/** Allowed L1/L2 sources for graph intents — L3 paths must never feed the builder. */
export declare const GRAPH_INTENT_SOURCE_ALLOWLIST: readonly ["state.currentTask", "built.project_goal", "built.active_modules", "built.next_actions", "change.changed_files", "intentFusion.focus"];
//# sourceMappingURL=closureConstants.d.ts.map