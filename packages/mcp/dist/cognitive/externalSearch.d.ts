import type { RankedCandidate, SkillSource } from './types.js';
export interface ExternalSearchHit {
    name: string;
    description: string;
    link: string;
    source: SkillSource;
    tags: string[];
    popularity: number;
    recency: number;
}
export declare function searchGitHub(keywords: string[], limit?: number): Promise<ExternalSearchHit[]>;
export declare function searchNpm(keywords: string[], limit?: number): Promise<ExternalSearchHit[]>;
export declare function rankCandidates(items: Array<{
    name: string;
    description?: string;
    source: SkillSource;
    link: string;
    tags: string[];
    keyword_match: number;
    popularity: number;
    recency: number;
    reason: string;
}>, limit?: number): RankedCandidate[];
