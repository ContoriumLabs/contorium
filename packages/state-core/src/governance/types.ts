/** Contorium V3 — Governance Layer data models. */

export type ValidationStatus = 'allow' | 'reject' | 'require_approval';
export type RiskSeverity = 'low' | 'medium' | 'high';
export type ProtectedPathLevel = 'normal' | 'high' | 'critical';

export interface ProtectedPathRule {
  path: string;
  level: ProtectedPathLevel;
}

export interface ForbiddenPatternRule {
  type: 'filesystem' | 'database' | 'security' | 'generic';
  pattern: string;
}

export interface Constitution {
  version: 1;
  principles: string[];
  /** Legacy string entries or V3.2 leveled rules. */
  protected_paths: Array<string | ProtectedPathRule>;
  /** Legacy keyword list — kept for display / prompt injection. */
  forbidden_actions: string[];
  /** V3.2 — scanned against diff/snippet, not description. */
  forbidden_patterns?: ForbiddenPatternRule[];
  ai_rules: string[];
}

export interface HardcodedEntry {
  file: string;
  line: number;
  reason: string;
  severity: RiskSeverity;
}

export interface TruthLayer {
  version: 1;
  mock_data: string[];
  hardcoded_values: HardcodedEntry[];
  production_flags: string[];
  /** V3.2 — only these symbol names trigger truth impact in review. */
  sensitive_constants?: string[];
  business_rules?: string[];
}

export interface IdentityHistory {
  date: string;
  identity: string;
  reason: string;
}

export interface Identity {
  version: 1;
  name: string;
  purpose: string;
  current_focus: string[];
  non_goals: string[];
  version_history?: IdentityHistory[];
}

export interface ValidationResult {
  status: ValidationStatus;
  reason: string;
  risk_level: RiskSeverity;
  matched_rules?: string[];
}

export interface GovernanceAction {
  type: 'file_write' | 'file_delete' | 'path_change' | 'tool_call' | 'unknown';
  target_path?: string;
  description?: string;
}

export interface GovernanceBundle {
  constitution: Constitution;
  truth: TruthLayer;
  identity: Identity;
}

/** V3 cognitive projection — derived from V3.1 artifacts. */
export interface ProjectCognitiveState {
  version: 1;
  generatedAt: number;
  phase: string;
  progress: number;
  current_focus: string;
  active_tasks: string[];
}

export interface CognitiveIntent {
  version: 1;
  generatedAt: number;
  goal: string;
  constraints: string[];
  success_metrics: string[];
}

export interface CognitiveRisk {
  version: 1;
  generatedAt: number;
  risks: Array<{
    type: string;
    level: RiskSeverity;
    description: string;
  }>;
}

export interface CognitiveGraph {
  version: 1;
  generatedAt: number;
  nodes: string[];
  edges: [string, string][];
}

export interface ChangeRecord {
  id: string;
  timestamp: number;
  change: string;
  type: 'file' | 'logic' | 'config' | 'unknown';
  risk_level: RiskSeverity;
  approval: 'allow' | 'pending' | 'rejected' | 'approved';
  target_path?: string;
  source?: string;
  validation?: ValidationResult;
}

export interface ChangeLog {
  version: 1;
  generatedAt: number;
  records: ChangeRecord[];
}

/** V3.2 Lightweight Guard — detect / warn / confirm / block (NOT approval workflow). */
export type GuardAction = 'allow' | 'warn' | 'confirm' | 'block';

export interface GuardDetection {
  type:
    | 'protected_path'
    | 'forbidden_action'
    | 'forbidden_pattern'
    | 'hardcoded_value'
    | 'truth_registry'
    | 'hardcode_snippet'
    | 'change_analysis';
  detail: string;
  severity: RiskSeverity;
}

export interface ExecutionGuardResult {
  allow: boolean;
  action: GuardAction;
  reason: string;
  suggestion?: string;
  risk_level: RiskSeverity;
  detections: GuardDetection[];
  /** V3.2 risk engine output when available. */
  governance_risk?: import('./riskEngine.js').GovernanceRisk;
  governance_impact?: import('./riskEngine.js').GovernanceImpact;
  change_analysis?: import('./changeAnalyzer.js').ChangeAnalysis;
  reason_chain?: string[];
  recommendation?: string;
  confidence?: number;
  display_score?: number;
}

export interface PreActionCheckInput extends GovernanceAction {
  /** Optional code snippet for inline hardcode detection. */
  code_snippet?: string;
  /** Unified diff or patch text for change analysis. */
  diff_text?: string;
  lines_added?: number;
  lines_removed?: number;
  /** User explicitly confirmed a high-risk action in chat. */
  user_confirmed?: boolean;
}

/** User-owned overlay — NOT a second source of truth. Merged into derived cognitive/*. */
export interface UserRequestOverlay {
  version: 1;
  generatedAt: number;
  goal: string;
  constraints: string[];
  phase_hint?: string;
  module_hints?: string[];
}

export interface GuardSession {
  version: 1;
  lastCheckAt: number;
  lastAction: GuardAction;
  lastAllow: boolean;
  source?: string;
  target_path?: string;
}

export interface AdapterPreWriteResult {
  allowed: boolean;
  guard: ExecutionGuardResult;
  enforced: boolean;
}

/** Frozen module boundary — no new V3 Core modules without explicit version bump. */
export const V3_CORE_FREEZE_VERSION = '0.9.5' as const;
