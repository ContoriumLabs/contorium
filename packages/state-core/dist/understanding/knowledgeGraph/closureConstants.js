"use strict";
/** V3.1 Final Engineering Closure — frozen thresholds (do not drift). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GRAPH_INTENT_SOURCE_ALLOWLIST = exports.MAPPING_DISCOVERY_MIN_SCORE = exports.REBUILD_FILE_THRESHOLD = exports.REBUILD_IDLE_MS = exports.HOTSPOT_SCORE_COOLING = exports.HOTSPOT_SCORE_ACTIVE = exports.SNAPSHOT_TOP_NEXT_ACTIONS = exports.SNAPSHOT_TOP_FUNCTIONS = exports.SNAPSHOT_TOP_HOTSPOTS = exports.SNAPSHOT_TOP_INTENTS = exports.CONFIDENCE_WEIGHT_GIT = exports.CONFIDENCE_WEIGHT_TEMPORAL = exports.CONFIDENCE_WEIGHT_SEMANTIC = exports.GRAPH_CANONICAL_MIN_CONFIDENCE = exports.CLOSURE_VERSION = void 0;
exports.CLOSURE_VERSION = '1';
/** Canonical graph: mappings/edges below this stay in inferenceMappings only. */
exports.GRAPH_CANONICAL_MIN_CONFIDENCE = 0.7;
/** Unified confidence formula weights (semantic + temporal + git). */
exports.CONFIDENCE_WEIGHT_SEMANTIC = 0.5;
exports.CONFIDENCE_WEIGHT_TEMPORAL = 0.3;
exports.CONFIDENCE_WEIGHT_GIT = 0.2;
/** Snapshot Top-N (compression projection from knowledge.json). */
exports.SNAPSHOT_TOP_INTENTS = 5;
exports.SNAPSHOT_TOP_HOTSPOTS = 10;
exports.SNAPSHOT_TOP_FUNCTIONS = 10;
exports.SNAPSHOT_TOP_NEXT_ACTIONS = 6;
/** Hotspot lifecycle score bands. */
exports.HOTSPOT_SCORE_ACTIVE = 0.5;
exports.HOTSPOT_SCORE_COOLING = 0.3;
/** Knowledge graph rebuild triggers. */
exports.REBUILD_IDLE_MS = 60_000;
exports.REBUILD_FILE_THRESHOLD = 5;
/** Minimum raw mapping score before inference consideration. */
exports.MAPPING_DISCOVERY_MIN_SCORE = 0.12;
/** Allowed L1/L2 sources for graph intents — L3 paths must never feed the builder. */
exports.GRAPH_INTENT_SOURCE_ALLOWLIST = [
    'state.currentTask',
    'built.project_goal',
    'built.active_modules',
    'built.next_actions',
    'change.changed_files',
    'intentFusion.focus',
];
