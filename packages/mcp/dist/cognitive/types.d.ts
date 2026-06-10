/**
 * Contorium MCP Cognitive Overlay types.
 *
 * Mode naming (v2):
 *   A = Core Runtime — pure observation (DEFAULT)
 *   B = Cognitive Overlay — A + skills + presets + insights (B ⊃ A)
 */
export type ContoriumMcpMode = 'A' | 'B';
export declare const COGNITIVE_MODE_SCHEMA_VERSION = 2;
export interface CognitiveModeState {
    mode: ContoriumMcpMode;
    /** ISO-8601 */
    updatedAt: string;
    /** Who last changed mode */
    source?: 'mcp' | 'user' | 'agent';
    /** v2 swapped A/B semantics; v1 files are migrated on read */
    schemaVersion?: number;
}
export interface IntentInference {
    intent: string;
    confidence: number;
    signals: string[];
    action_pattern?: 'edit' | 'debug' | 'refactor' | 'explore' | 'unknown';
}
export type SkillSource = 'local' | 'github' | 'npm';
export interface SkillSuggestion {
    name: string;
    reason: string;
    source: SkillSource;
    link: string;
    score: number;
    tags?: string[];
}
export type ModelPresetKind = 'SMART' | 'FAST' | 'REASON' | 'CODE' | 'LOCAL';
export interface ModelPresetSuggestion {
    mode: ModelPresetKind;
    reason: string;
    /** Preset hint only — not a model recommendation system */
    preset_hint: string;
}
export interface CognitiveInsights {
    version: 1;
    generatedAt: number;
    /** User mode A/B */
    mode: ContoriumMcpMode;
    cognitive_overlay_enabled: boolean;
    detected_intent: IntentInference;
    suggested_skills: SkillSuggestion[];
    suggested_tools: SkillSuggestion[];
    suggested_models: ModelPresetSuggestion[];
    keywords: string[];
    next_step_hint?: string;
    /** Read-only boundary reminder */
    boundaries: {
        auto_install: false;
        auto_execute: false;
        auto_call_ai: false;
        display_only: true;
    };
}
export interface LocalSkillEntry {
    name: string;
    description: string;
    tags: string[];
    link?: string;
}
export interface RankedCandidate {
    name: string;
    description?: string;
    source: SkillSource;
    link: string;
    tags: string[];
    keyword_match: number;
    popularity: number;
    recency: number;
    score: number;
    reason: string;
}
