export declare const PIK_SCHEMA: "contorium.pik.v1";
export interface PikGoal {
    goal: string;
    weight: number;
}
export interface ProjectIntentKernel {
    schema: typeof PIK_SCHEMA;
    updated_at: string;
    /** manual | derived | merged */
    source: 'manual' | 'derived' | 'merged';
    project_identity: {
        name: string;
        type: string;
    };
    primary_intent: {
        statement: string;
        confidence: number;
    };
    goal_hierarchy: PikGoal[];
    non_goals: string[];
    constraints: string[];
    semantic_bias: {
        memory: number;
        reasoning: number;
        execution: number;
    };
}
export type DriftSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type DriftType = 'intent' | 'structural' | 'behavioral' | 'none';
export interface DriftReport {
    drift_score: number;
    severity: DriftSeverity;
    drift_type: DriftType;
    explanation: string;
}
export declare const DEFAULT_PIK: ProjectIntentKernel;
//# sourceMappingURL=types.d.ts.map