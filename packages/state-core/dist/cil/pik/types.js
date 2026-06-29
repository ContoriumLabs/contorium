"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PIK = exports.PIK_SCHEMA = void 0;
exports.PIK_SCHEMA = 'contorium.pik.v1';
exports.DEFAULT_PIK = {
    schema: exports.PIK_SCHEMA,
    updated_at: new Date(0).toISOString(),
    source: 'derived',
    project_identity: { name: 'Project', type: 'Software' },
    primary_intent: { statement: 'Deliver the current workspace focus with traceable decisions', confidence: 0.5 },
    goal_hierarchy: [],
    non_goals: ['not an autonomous agent', 'not a task executor'],
    constraints: ['local-first', 'git-compatible'],
    semantic_bias: { memory: 0.4, reasoning: 0.4, execution: 0.2 },
};
