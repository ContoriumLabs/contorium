/**
 * Contorium — shared IDs and on-disk layout (VS Code extension).
 * Command/config IDs remain `contora.*`; user-visible name is {@link PRODUCT_DISPLAY_NAME}.
 */

/** Marketplace / UI product name (internal IDs unchanged). */
export const PRODUCT_DISPLAY_NAME = 'Contorium';

/** Settings / commands namespace: `contora.*` */
export const CONTORA_CONFIG_SECTION = 'contora';

/** Default max tokens for “Copy AI-ready context” (0 in settings = unlimited). */
export const DEFAULT_EXPORT_TOKEN_BUDGET = 800;

/** Local compression first pass: aim under this when budget allows. */
export const EXPORT_IDEAL_LOCAL_TOKENS = 500;

/** Above this (after local passes), optional BYOK compression may run (complex / large handoff). */
export const EXPORT_LLM_THRESHOLD_TOKENS = 800;

export const MAX_EXPORT_TOKEN_BUDGET = 200_000;

/** Primary workspace data directory */
export const CONTORA_DATA_DIR = '.contora';

/** Previous product directory — still read for migration */
export const CONTORA_LEGACY_DATA_DIR = '.context-recall';

/** Primary ignore file at workspace root */
export const CONTORA_IGNORE_FILE = '.contoraignore';

/** Legacy ignore file — still loaded if present */
export const CONTORA_LEGACY_IGNORE_FILE = '.contextrecallignore';

/** v0.7 Context Intelligence Layer output directory under `.contora/` */
export const CONTORA_INTELLIGENCE_DIR = 'intelligence';

/** v0.7 Intent Graph Layer output directory under `.contora/` */
export const CONTORA_INTENT_GRAPH_DIR = 'intent-graph';

/** Derived semantic summary written by intelligence layer */
export const CONTORA_STATE_SUMMARY_FILE = 'state-summary.json';

/** Intent graph persistence file */
export const CONTORA_INTENT_GRAPH_FILE = 'graph.json';

/** v0.7+ State Builder output directory under `.contora/` */
export const CONTORA_STATE_BUILDER_DIR = 'state-builder';

/** Structured project state JSON */
export const CONTORA_PROJECT_STATE_FILE = 'project-state.json';

/** Markdown PROJECT SNAPSHOT for cross-AI handoff */
export const CONTORA_PROJECT_SNAPSHOT_FILE = 'project-snapshot.md';

/** v2 State Engine — conflict audit artifacts */
export const CONTORA_STATE_ENGINE_DIR = 'state-engine';

export const CONTORA_CONFLICTS_FILE = 'conflicts.json';
