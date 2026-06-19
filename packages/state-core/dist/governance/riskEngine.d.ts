import { type ChangeAnalysis, type ChangeType } from './changeAnalyzer.js';
import type { ProtectedPathLevel } from './types.js';
export type GovernanceRisk = 'low' | 'medium' | 'high' | 'critical';
export type GovernanceImpact = 'none' | 'truth' | 'architecture' | 'security' | 'database';
export type GovernanceRecommendation = 'safe_to_modify' | 'review_before_commit' | 'manual_review_required' | 'explicit_approval_required';
export interface RiskEngineInput {
    protectedPath: boolean;
    protectedLevel?: ProtectedPathLevel;
    truthImpact: boolean;
    forbiddenHit: boolean;
    change: ChangeAnalysis;
}
export interface RiskEngineResult {
    risk: GovernanceRisk;
    impact: GovernanceImpact;
    confidence: number;
    recommendation: GovernanceRecommendation;
    reason_chain: string[];
    /** Internal score for sorting/trends — not shown in UI. */
    display_score: number;
}
export declare function computeGovernanceImpact(changeType: ChangeType, truthImpact: boolean, protectedPath: boolean): GovernanceImpact;
/** Recommendation = Risk × Change Type (not risk alone). */
export declare function recommendationFor(risk: GovernanceRisk, changeType: ChangeType): GovernanceRecommendation;
export declare function computeGovernanceRisk(input: RiskEngineInput): RiskEngineResult;
//# sourceMappingURL=riskEngine.d.ts.map