export const PIK_SCHEMA = 'contorium.pik.v1' as const;

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

export const DEFAULT_PIK: ProjectIntentKernel = {
  schema: PIK_SCHEMA,
  updated_at: new Date(0).toISOString(),
  source: 'derived',
  project_identity: { name: 'Project', type: 'Software' },
  primary_intent: { statement: 'Deliver the current workspace focus with traceable decisions', confidence: 0.5 },
  goal_hierarchy: [],
  non_goals: ['not an autonomous agent', 'not a task executor'],
  constraints: ['local-first', 'git-compatible'],
  semantic_bias: { memory: 0.4, reasoning: 0.4, execution: 0.2 },
};
