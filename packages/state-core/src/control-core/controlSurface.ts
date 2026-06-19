import type { AdapterKind } from '../types.js';
import { syncWorkspaceState } from '../adapterSync.js';
import { adapterPreWriteHook, recordGuardSession } from '../governance/adapterHook.js';
import { guardActionLabel, preActionCheck } from '../governance/executionGuard.js';
import { ensureGovernanceLayer } from '../governance/init.js';
import {
  analyzeProject,
  getProjectState,
  refreshProjectCognitive,
  updateCognitiveFromInput,
} from '../governance/internalApi.js';
import { getGovernanceSummary } from '../governance/governanceEngine.js';
import { validateAndTrackChange } from '../governance/changeTracker.js';
import type {
  ControlAnalyzeResult,
  ControlCheckResult,
  ControlExecuteInput,
  ControlExecuteResult,
  ControlGovernanceResult,
  ControlIntentResult,
  ControlSurfaceContext,
} from './types.js';
import type { PreActionCheckInput } from '../governance/types.js';

/**
 * Contorium Control Surface — unified closed-loop entry for IDE / MCP / CLI.
 * Adapters call this layer; state-core remains the single truth engine.
 */
export class ContoriumControlSurface {
  readonly workspaceRoot: string;
  readonly source: AdapterKind;

  constructor(workspaceRoot: string, source: AdapterKind) {
    this.workspaceRoot = workspaceRoot;
    this.source = source;
  }

  private ctx(): ControlSurfaceContext {
    return { workspaceRoot: this.workspaceRoot, source: this.source };
  }

  /** Ensure governance seed + lightweight sync (idempotent). */
  async ensureReady(): Promise<{ governance_initialized: boolean; synced: boolean }> {
    const gov = await ensureGovernanceLayer(this.workspaceRoot);
    const sync = await syncWorkspaceState(this.workspaceRoot, this.source, { skipGitScan: true }).catch(
      () => ({ updated: false }),
    );
    return {
      governance_initialized: gov.initialized,
      synced: sync.updated === true,
    };
  }

  async getGovernance(): Promise<ControlGovernanceResult> {
    await ensureGovernanceLayer(this.workspaceRoot);
    const governance = await getGovernanceSummary(this.workspaceRoot);
    return { ...this.ctx(), loop: 'governance', governance };
  }

  async checkAction(input: PreActionCheckInput): Promise<ControlCheckResult> {
    await ensureGovernanceLayer(this.workspaceRoot);
    const guard = await preActionCheck(this.workspaceRoot, input);
    await recordGuardSession(this.workspaceRoot, guard, {
      source: `${this.source}:control`,
      target_path: input.target_path,
    });
    return {
      ...this.ctx(),
      loop: 'check',
      guard,
      label: guardActionLabel(guard.action),
    };
  }

  async updateIntent(userInput: string): Promise<ControlIntentResult> {
    await ensureGovernanceLayer(this.workspaceRoot);
    const update = await updateCognitiveFromInput(this.workspaceRoot, userInput);
    await refreshProjectCognitive(this.workspaceRoot).catch(() => undefined);
    return { ...this.ctx(), loop: 'intent', update };
  }

  async analyze(): Promise<ControlAnalyzeResult> {
    const snapshot = await analyzeProject(this.workspaceRoot);
    return { ...this.ctx(), loop: 'analyze', snapshot };
  }

  async getState(): Promise<Awaited<ReturnType<typeof getProjectState>>> {
    return getProjectState(this.workspaceRoot);
  }

  /**
   * Full closed loop: governance check → optional audit → cognitive feedback sync.
   * Intent → State → Governance → Execution feedback
   */
  async executeAction(input: ControlExecuteInput): Promise<ControlExecuteResult> {
    await ensureGovernanceLayer(this.workspaceRoot);

    const hook = await adapterPreWriteHook(
      this.workspaceRoot,
      input,
      { strict: input.strict === true, source: `${this.source}:execute` },
    );
    const guard = hook.guard;

    let tracked = false;
    let change_id: string | undefined;
    if (input.audit !== false) {
      const track = await validateAndTrackChange(this.workspaceRoot, input, `${this.source}:control-execute`);
      tracked = track.recorded;
      change_id = track.change_id;
    }

    await refreshProjectCognitive(this.workspaceRoot).catch(() => undefined);

    return {
      ...this.ctx(),
      loop: 'execute',
      allowed: hook.allowed,
      guard,
      label: guardActionLabel(guard.action),
      tracked,
      change_id,
      feedback: {
        cognitive_synced: true,
        governance_ready: true,
      },
    };
  }
}

export function createControlSurface(workspaceRoot: string, source: AdapterKind): ContoriumControlSurface {
  return new ContoriumControlSurface(workspaceRoot, source);
}
