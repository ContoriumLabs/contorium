import type {
  ChangeArtifact,
  HandoffArtifact,
  HandoffInjectionState,
  ProjectGraph,
  ProjectTimeline,
  UnderstandingGraph,
} from '@contora/state-core';
import type { KnowledgeSnapshot } from '@contora/state-core';

export type DashboardFsmState = 'idle' | 'passive' | 'expanded';

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
  filter?: string;
  fsmState: DashboardFsmState;
}
