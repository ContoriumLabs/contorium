import type {
  ChangeArtifact,
  EvolutionGraphArtifact,
  HandoffArtifact,
  HandoffInjectionState,
  ImpactGraphArtifact,
  KnowledgeLifecycleIndex,
  ProjectEvolutionTimeline,
  ProjectGraph,
  ProjectIntelligenceHealth,
  ProjectTimeline,
  ProvenanceChainArtifact,
  UnderstandingGraph,
} from '@contora/state-core';
import type { KnowledgeSnapshot } from '@contora/state-core';
import type { DashboardCognitiveInsights } from './cognitiveInsights.js';
import type { DashboardGovernanceSnapshot } from './governanceDashboard.js';

export type DashboardFsmState = 'idle' | 'passive' | 'expanded' | 'mode_panel';

export type DashboardSignalAction = 'expand' | 'minimize' | 'filter' | 'clear-filter';

export interface DashboardSignal {
  action: DashboardSignalAction;
  filter?: string;
  at: number;
}

export interface RuntimeEvent {
  type: string;
  file?: string;
  timestamp: number;
  detail?: string;
}

export interface DashboardState {
  workspaceRoot: string;
  loadedAt: number;
  status: {
    mode: string;
    lastWriter?: string;
    lastUpdated?: string;
    eventCount: number;
    gitWorking: number;
    gitStaged: number;
    currentTask: string;
  };
  change?: ChangeArtifact;
  handoff?: HandoffArtifact;
  understandingGraph?: UnderstandingGraph;
  graph?: ProjectGraph;
  snapshot?: KnowledgeSnapshot;
  timeline?: ProjectTimeline;
  recentEvents: RuntimeEvent[];
  handoffInjection?: HandoffInjectionState;
  governance?: DashboardGovernanceSnapshot;
  /** v1.1.3 — Project Intelligence Repository panels */
  intelligenceHealth?: ProjectIntelligenceHealth;
  evolutionTimeline?: ProjectEvolutionTimeline;
  evolutionGraph?: EvolutionGraphArtifact;
  provenanceChain?: ProvenanceChainArtifact;
  impactGraph?: ImpactGraphArtifact;
  /** v3.2 — Knowledge Lifecycle (.contora/lifecycle/) */
  knowledgeLifecycle?: KnowledgeLifecycleIndex;
  /** Cognitive health artifact for layered health display */
  cognitiveHealthScore?: number;
}

export interface AttachOptions {
  workspaceRoot: string;
  intervalMs: number;
  timeoutMs: number;
  useColor: boolean;
  /** IDE/MCP auto-attach: enter Passive immediately when session marker is present. */
  autoAttach?: boolean;
  /** Codex/MCP background worker: no TTY; persist status to .contora/dashboard.status.json */
  headless?: boolean;
  /** Legacy one-shot full frame (debug). */
  once?: boolean;
  startExpanded?: boolean;
}

export interface RenderContext {
  useColor: boolean;
  width: number;
  height?: number;
  /** True when artifacts just changed — show LIVE badge in Expanded header. */
  live?: boolean;
  /** Monotonic UI tick for pulse/spinner animation (~500ms). */
  tickCount?: number;
  filter?: string;
  fsmState: DashboardFsmState;
  /** Cognitive view lens — A=Live B=Governance C=Debug D=History E=LLM. */
  cognitiveModeSelection?: 'A' | 'B' | 'C' | 'D' | 'E';
  /** Applied lens (A–D local; A/B also sync MCP attach mode). */
  cognitiveModeActive?: 'A' | 'B' | 'C' | 'D';
  /** Mode B insights from .contora/mcp/cognitive-insights.json */
  cognitiveInsights?: DashboardCognitiveInsights;
  /** CIL history feed lines for view D. */
  cilHistoryLines?: string[];
  /** LLM config (view E). */
  llmSnapshot?: import('./aiConfigBridge.js').DashboardLlmSnapshot;
  llmStep?: import('./aiConfigBridge.js').LlmConfigStep;
  llmProviderSelection?: import('@contora/state-core').AiProviderId;
  llmKeyInputBuffer?: string;
  llmLastTest?: import('./aiConfigBridge.js').DashboardLlmTestResult;
}
