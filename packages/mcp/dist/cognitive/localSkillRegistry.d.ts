import type { LocalSkillEntry } from './types.js';
/** Built-in local skill registry (V1). External index only — no execution. */
export declare const LOCAL_SKILL_REGISTRY: LocalSkillEntry[];
export declare function searchLocalRegistry(keywords: string[], limit?: number): LocalSkillEntry[];
