import * as vscode from 'vscode';
import { ContoraKeyManager } from '../ai/auth/keyManager';
import { loadIdeCilAiPanelState, syncCilLlmConfigFromIde } from '../ai/cilLlmBridge';
import { readAiRuntimeSettings } from '../ai/auth/providerConfig';
import { CONTORA_CONFIG_SECTION, PRODUCT_DISPLAY_NAME } from '../constants';
import { readResolvedExportTokenBudget } from '../ai/exportBudget';
import type { EventStore } from '../core/engine/eventStore';
import { intentToGoals, readAndEvaluatePersistedIntent } from '../core/memory/intentStore';
import { buildSidebarGraphPanel, type SidebarIntentGraphPanel } from '../cognition/sidebarGraphPanel';
import { buildSidebarConflictsPanel, type SidebarConflictsPanel } from '../cognition/sidebarConflictsPanel';
import {
  buildSidebarProjectStatePanel,
  type SidebarProjectStatePanel,
} from '../cognition/sidebarStateBuilderPanel';
import type { SidebarUnderstandingPanel } from '../cognition/sidebarHandoffPanel';
import { StateManager } from '../state/stateManager';
import type { ProjectState } from '../types/state';
import { defaultProjectState } from '../types/state';
import { runAndPersistGovernanceReview, readGovernanceReviewScope } from '../ai/governanceReviewBridge';
import {
  buildSidebarGovernanceStatus,
  formatGovernanceOverview,
  formatReviewArtifactOverlay,
  type ChangeReviewOverlay,
  type GovernanceOverviewOverlay,
} from './sidebarGovernancePanel';
import type { SidebarOverlay } from './sidebarCilPanel';
import { runCilDecisionsPanel, runCilHistoryPanel, runCilHealthPanel, runCilDnaPanel, runCilReplayPanel, runCilImpactPanel, runCilReviewPanel, runCilLifecyclePanel, runCilLifecycleOwnerPanel, runCilLifecycleVerifyPanel } from '../cil/ideCilPanel';
import { runIdeTransfer } from '../cil/ideTransfer';
import { runAskContoriumWithQuery } from '../cil/askContorium';
import {
  ideControlGovernance,
  ideControlUpdateIntent,
} from '../control/controlBridge';
import {
  buildSidebarWebviewState,
  type SidebarAiIntentPanel,
  type SidebarByokPanelState,
  type SidebarCilAiPanelState,
} from './sidebarViewModel';
import type { SidebarV22View } from './sidebarV22Panels';
import type { ExportMode, ExportProgressReporter, RunExportAIContextResult } from '../ai/runExportAIContext';
import { ideCaptureFocus, ideCaptureNote, ideCaptureDecision } from '../pil/ideCapture';

type WebviewToExt =
  | { type: 'ready' }
  | { type: 'exportAIContext'; mode?: 'cognitive-snapshot' | 'full-intelligence' }
  | { type: 'transferProject'; mode: 'context' | 'intelligence' | 'story' | 'essence' | 'handoff' }
  | { type: 'askHome'; query?: string }
  | { type: 'saveStateNow' }
  | { type: 'restoreSession' }
  | { type: 'configureApiKey' }
  | { type: 'openContoraSettings' }
  | { type: 'openLlmSettings' }
  | { type: 'cilAiTest' }
  | { type: 'cilAiSync' }
  | { type: 'generateSemanticSummary' }
  | { type: 'analyzeWorkspaceIntent' }
  | { type: 'compressContextPreview' }
  | { type: 'viewRules' }
  | { type: 'reviewChange' }
  | { type: 'setReviewScope'; value: string }
  | { type: 'editDirection' }
  | { type: 'getGovernance' }
  | { type: 'checkAction' }
  | { type: 'updateProjectIntent' }
  | { type: 'updateTask'; value: string }
  | { type: 'updateNotes'; value: string }
  | { type: 'captureNote'; value: string }
  | { type: 'captureDecision'; selected: string; reason?: string }
  | { type: 'openFile'; relativePath: string }
  | { type: 'startFreshAiSession' }
  | { type: 'cilHistory' }
  | { type: 'cilDecisions' }
  | { type: 'cilHealth' }
  | { type: 'cilReview' }
  | { type: 'cilLifecycle' }
  | { type: 'cilLifecycleOwner' }
  | { type: 'cilLifecycleVerify' }
  | { type: 'cilDna' }
  | { type: 'cilReplay' }
  | { type: 'cilImpact' }
  | { type: 'cilAsk' };

const TASK_MAX = 500;

const EMPTY_UNDERSTANDING: SidebarUnderstandingPanel = {
  handoff: {
    summary: '',
    goal: '',
    currentFocus: '',
    riskLevel: '',
    changedCount: 0,
    impactCount: 0,
    nextActions: [],
    updatedAt: 0,
    empty: true,
  },
  impact: { modules: [], empty: true },
  graph: { nodes: [], empty: true },
  timeline: { entries: [], empty: true },
  functionGraph: { trees: [], fileFlows: [], impactLines: [], empty: true },
  knowledgeGraph: {
    intentTrees: [],
    reasonTraces: [],
    inferenceTraces: [],
    impactDetails: [],
    hotspots: [],
    avgConfidence: 0,
    closureVersion: '—',
    schemaVersion: '—',
    parserBackend: '—',
    empty: true,
  },
  intelligence: { healthScore: null, healthCategory: '—', knowledgeCoverage: null, empty: true },
};

/** Placeholder until v2.2 panel loads asynchronously (avoids pulling state-core readers on module load). */
const EMPTY_V22_PLACEHOLDER: SidebarV22View = {
  cognition: {
    currentFocus: '',
    intent: '—',
    state: '—',
    understanding: '—',
    confidence: '—',
  },
  intelligence: {
    healthScore: null,
    healthCategory: '—',
    knowledgeCoverage: null,
    confidenceIndex: null,
    timelineSummary: '—',
    impactRadius: null,
    knowledgeHealthScore: null,
    reviewQueueCount: null,
    empty: true,
  },
  decision: {
    decisionSnapshot: '—',
    graphSummary: '—',
    decisionLinks: [],
    decisionHistory: [],
    empty: true,
  },
  graph: {
    intentGraph: '—',
    structureGraph: '—',
    impactOverlay: '—',
    evolutionTimeline: '—',
    hotspots: [],
    empty: true,
  },
  activity: { lines: [] },
  structure: {
    stateBuilder: '—',
    moduleMap: [],
    openProblems: [],
    linkedDecisions: [],
    nextCognition: '—',
    empty: true,
  },
  exportLayer: {
    tokenEstimate: 0,
    injectPreview: 'Cognitive Snapshot · ~300–800 tokens',
    mcpSnapshotHint: 'MCP: transfer_context · transfer_intelligence · transfer_handoff',
  },
};

const EMPTY_INTENT_GRAPH: SidebarIntentGraphPanel = {
  projectIntent: '',
  problemArea: '',
  domains: [],
  hotspot: '',
  summaryConfidence: 0,
  intents: [],
  updatedAt: 0,
  empty: true,
};

const EMPTY_PROJECT_STATE: SidebarProjectStatePanel = {
  projectGoal: '',
  currentStage: '',
  activeModules: [],
  recentDecisions: [],
  openProblems: [],
  completedMilestones: [],
  nextActions: [],
  confidence: 0,
  updatedAt: 0,
  empty: true,
};

const EMPTY_CONFLICTS: SidebarConflictsPanel = {
  count: 0,
  items: [],
  updatedAt: 0,
  empty: true,
};

const PANEL_LOAD_TIMEOUT_MS = 12_000;
const WEBVIEW_READY_FALLBACK_MS = [300, 1_000, 2_500] as const;

export class ContoraSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'contora.sidebar';
  /** Bust on layout changes so Reload Window picks up sidebar HTML. */
  private static htmlTemplateCache: string | undefined;
  private static htmlTemplateCachedVersion = 0;
  private static htmlTemplateVersion = 17;

  private view?: vscode.WebviewView;
  private folder: vscode.WorkspaceFolder | undefined;
  private events?: EventStore;
  private readonly keys: ContoraKeyManager;
  private pushStateSeq = 0;
  private pushStateInFlight = false;
  private pushStateQueued = false;
  /** Skip heavy panel IO — activity-only sidebar update. */
  private lightRefreshOnly = false;
  /** Bumps when a new refresh supersedes in-flight panel loading. */
  private panelLoadGeneration = 0;
  /** Last fully merged state for light refresh merges. */
  private lastMergedCore: Record<string, unknown> | null = null;
  private lastByok: SidebarByokPanelState | null = null;
  private lastCilAi: SidebarCilAiPanelState | null = null;
  /** Webview posted `ready` — listener is registered. */
  private webviewScriptReady = false;
  /** Refresh requested before webview script was ready. */
  private pendingStatePush = false;
  /** Fast workspace shell painted at least once. */
  private webviewBaseHydrated = false;
  private webviewReadyFallbackTimer: ReturnType<typeof setTimeout> | undefined;
  private exportInFlight = false;
  private exportRunner?: (
    report: ExportProgressReporter,
    mode: ExportMode,
  ) => Promise<RunExportAIContextResult>;

  registerExportRunner(
    runner: (report: ExportProgressReporter, mode: ExportMode) => Promise<RunExportAIContextResult>,
  ): void {
    this.exportRunner = runner;
  }

  constructor(
    private readonly ctx: vscode.ExtensionContext,
    private readonly stateManager: StateManager,
    events?: EventStore,
    private readonly onAfterTaskUpdated?: (folder: vscode.WorkspaceFolder, newTask: string) => void,
  ) {
    this.keys = new ContoraKeyManager(ctx.secrets);
    this.events = events;
  }

  setEventStore(store: EventStore | undefined): void {
    this.events = store;
  }

  setWorkspaceFolder(folder: vscode.WorkspaceFolder | undefined): void {
    this.folder = folder;
    void this.refresh();
  }

  private postExportProgress(update: {
    phase: string;
    label: string;
    percent: number;
  }): void {
    this.view?.webview.postMessage({ type: 'exportProgress', ...update });
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.ctx.extensionUri],
    };

    // Register message handler BEFORE assigning html. If html runs first, `ready` can be
    // posted before the listener exists and the webview never receives initial state.
    webviewView.webview.onDidReceiveMessage(async (msg: WebviewToExt) => {
      if (msg.type === 'ready') {
        if (this.webviewReadyFallbackTimer !== undefined) {
          clearTimeout(this.webviewReadyFallbackTimer);
          this.webviewReadyFallbackTimer = undefined;
        }
        this.webviewScriptReady = true;
        this.pendingStatePush = false;
        void this.pushStateToWebview();
        return;
      }
      if (msg.type === 'exportAIContext') {
        if (this.exportInFlight) {
          return;
        }
        this.exportInFlight = true;
        const mode: ExportMode = msg.mode === 'full-intelligence' ? 'full-intelligence' : 'cognitive-snapshot';
        const report: ExportProgressReporter = (update) => this.postExportProgress(update);
        try {
          if (this.exportRunner) {
            await this.exportRunner(report, mode);
          } else {
            report({ phase: 'sync', label: 'Starting export…', percent: 2 });
            await vscode.commands.executeCommand(
              mode === 'full-intelligence' ? 'contora.exportFullIntelligence' : 'contora.exportAIContext',
            );
            report({ phase: 'done', label: 'Export complete', percent: 100 });
          }
        } catch (err) {
          report({
            phase: 'error',
            label: err instanceof Error ? err.message : 'Export failed',
            percent: 0,
          });
        } finally {
          this.exportInFlight = false;
        }
        return;
      }
      if (msg.type === 'saveStateNow') {
        await vscode.commands.executeCommand('contora.saveStateNow');
        return;
      }
      if (msg.type === 'restoreSession') {
        await vscode.commands.executeCommand('contora.restoreSession');
        return;
      }
      if (msg.type === 'configureApiKey') {
        await vscode.commands.executeCommand('contora.configureApiKey');
        void this.pushStateToWebview();
        return;
      }
      if (msg.type === 'openContoraSettings') {
        void vscode.commands.executeCommand('workbench.action.openSettings', CONTORA_CONFIG_SECTION);
        return;
      }
      if (msg.type === 'openLlmSettings') {
        void vscode.commands.executeCommand('contora.openLlmSettings');
        return;
      }
      if (msg.type === 'cilAiTest') {
        void vscode.commands.executeCommand('contora.testLlmConnection');
        return;
      }
      if (msg.type === 'cilAiSync') {
        const folder = this.folder ?? this.stateManager.getPrimaryFolder();
        if (!folder) {
          return;
        }
        await syncCilLlmConfigFromIde(folder.uri.fsPath);
        void vscode.window.showInformationMessage('CIL AI config synced to .contora/config/llm.json');
        void this.pushStateToWebview();
        return;
      }
      if (msg.type === 'generateSemanticSummary') {
        await vscode.commands.executeCommand('contora.generateSemanticSummary');
        return;
      }
      if (msg.type === 'analyzeWorkspaceIntent') {
        await vscode.commands.executeCommand('contora.analyzeWorkspaceIntent');
        return;
      }
      if (msg.type === 'compressContextPreview') {
        await vscode.commands.executeCommand('contora.compressContextPreview');
        return;
      }
      if (msg.type === 'viewRules' || msg.type === 'getGovernance') {
        await this.showGovernanceOverview();
        return;
      }
      if (msg.type === 'reviewChange' || msg.type === 'checkAction') {
        await this.showChangeReview();
        return;
      }
      if (msg.type === 'setReviewScope') {
        const scope = msg.value ?? 'auto';
        await vscode.workspace
          .getConfiguration(CONTORA_CONFIG_SECTION)
          .update('governanceReviewScope', scope, vscode.ConfigurationTarget.Workspace);
        await this.refreshGovernanceReview();
        void this.pushStateToWebview();
        return;
      }
      if (msg.type === 'editDirection' || msg.type === 'updateProjectIntent') {
        await this.promptEditDirection();
        return;
      }
      if (msg.type === 'startFreshAiSession') {
        await vscode.commands.executeCommand('contora.startFreshAiSession');
        return;
      }
      if (msg.type === 'cilHistory') {
        await this.showCilHistory();
        return;
      }
      if (msg.type === 'cilDecisions') {
        await this.showCilDecisions();
        return;
      }
      if (msg.type === 'cilAsk') {
        await vscode.commands.executeCommand('contora.askContorium');
        return;
      }
      if (msg.type === 'askHome') {
        const q = msg.query?.trim();
        if (q) {
          await this.runHomeAsk(q);
        } else {
          await vscode.commands.executeCommand('contora.askContorium');
        }
        return;
      }
      if (msg.type === 'transferProject') {
        await runIdeTransfer(msg.mode, (mode) => this.runExportForSidebar(mode));
        return;
      }
      if (msg.type === 'cilHealth') {
        const overlay = await runCilHealthPanel();
        if (overlay) {
          this.postOverlay(overlay);
        }
        return;
      }
      if (msg.type === 'cilReview') {
        const overlay = await runCilReviewPanel();
        if (overlay) {
          this.postOverlay(overlay);
        }
        return;
      }
      if (msg.type === 'cilLifecycle') {
        const overlay = await runCilLifecyclePanel();
        if (overlay) {
          this.postOverlay(overlay);
        }
        return;
      }
      if (msg.type === 'cilLifecycleOwner') {
        await runCilLifecycleOwnerPanel();
        return;
      }
      if (msg.type === 'cilLifecycleVerify') {
        await runCilLifecycleVerifyPanel();
        return;
      }
      if (msg.type === 'cilDna') {
        const overlay = await runCilDnaPanel();
        if (overlay) {
          this.postOverlay(overlay);
        }
        return;
      }
      if (msg.type === 'cilReplay') {
        const overlay = await runCilReplayPanel();
        if (overlay) {
          this.postOverlay(overlay);
        }
        return;
      }
      if (msg.type === 'cilImpact') {
        const overlay = await runCilImpactPanel();
        if (overlay) {
          this.postOverlay(overlay);
        }
        return;
      }
      const folder = this.folder ?? this.stateManager.getPrimaryFolder();
      if (!folder) {
        vscode.window.showWarningMessage(`${PRODUCT_DISPLAY_NAME}: Open a folder workspace first.`);
        return;
      }
      if (msg.type === 'updateTask') {
        const task = (msg.value ?? '').slice(0, TASK_MAX);
        if (task.trim()) {
          await ideCaptureFocus(folder.uri.fsPath, task);
        } else {
          await this.stateManager.update(folder, { currentTask: '' });
        }
        await this.stateManager.load(folder);
        this.events?.add({ type: 'task_update', task, timestamp: Date.now() });
        this.onAfterTaskUpdated?.(folder, task);
        void this.pushStateToWebview();
        return;
      }
      if (msg.type === 'captureNote') {
        const text = (msg.value ?? '').trim();
        if (text) {
          await ideCaptureNote(folder.uri.fsPath, text);
          await this.stateManager.load(folder);
          void vscode.window.showInformationMessage(`${PRODUCT_DISPLAY_NAME}: Project note captured.`);
        }
        void this.pushStateToWebview();
        return;
      }
      if (msg.type === 'captureDecision') {
        const selected = (msg.selected ?? '').trim();
        if (selected) {
          await ideCaptureDecision(folder.uri.fsPath, { selected, reason: msg.reason?.trim() });
          void vscode.window.showInformationMessage(`${PRODUCT_DISPLAY_NAME}: Decision recorded.`);
        }
        void this.pushStateToWebview();
        return;
      }
      if (msg.type === 'updateNotes') {
        await this.stateManager.update(folder, { notes: msg.value });
        this.events?.add({ type: 'note_update', note: msg.value, timestamp: Date.now() });
        void this.pushStateToWebview();
        return;
      }
      if (msg.type === 'openFile') {
        const uri = vscode.Uri.joinPath(folder.uri, msg.relativePath);
        try {
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc);
        } catch {
          await vscode.commands.executeCommand('vscode.open', uri);
        }
      }
    });

    webviewView.onDidDispose(() => {
      if (this.webviewReadyFallbackTimer !== undefined) {
        clearTimeout(this.webviewReadyFallbackTimer);
        this.webviewReadyFallbackTimer = undefined;
      }
      this.view = undefined;
      this.webviewScriptReady = false;
      this.webviewBaseHydrated = false;
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible && this.webviewScriptReady) {
        void this.pushStateToWebview();
      }
    });

    const armReadyFallback = (attempt: number): void => {
      if (attempt >= WEBVIEW_READY_FALLBACK_MS.length) {
        if (!this.webviewScriptReady && this.view) {
          console.warn(`[${PRODUCT_DISPLAY_NAME}] sidebar webview ready fallback (forced)`);
          this.webviewScriptReady = true;
          this.pendingStatePush = false;
          void this.pushStateToWebview();
        }
        return;
      }
      this.webviewReadyFallbackTimer = setTimeout(() => {
        this.webviewReadyFallbackTimer = undefined;
        if (this.webviewScriptReady || !this.view) {
          return;
        }
        armReadyFallback(attempt + 1);
      }, WEBVIEW_READY_FALLBACK_MS[attempt]);
    };

    try {
      this.webviewScriptReady = false;
      this.webviewBaseHydrated = false;
      webviewView.webview.html = this.getHtml(webviewView.webview);
      if (this.webviewReadyFallbackTimer !== undefined) {
        clearTimeout(this.webviewReadyFallbackTimer);
      }
      armReadyFallback(0);
    } catch (err) {
      console.error(`[${PRODUCT_DISPLAY_NAME}] sidebar HTML failed:`, err);
      webviewView.webview.html = this.getFallbackHtml(
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  /** Minimal shell when getHtml() throws — avoids a permanently blank webview. */
  private getFallbackHtml(errorMessage: string): string {
    const safe = errorMessage.replace(/[<>&"]/g, (c) => {
      if (c === '<') return '&lt;';
      if (c === '>') return '&gt;';
      if (c === '&') return '&amp;';
      return '&quot;';
    });
    return `<!DOCTYPE html><html><body style="font-family:var(--vscode-font-family);padding:12px;color:var(--vscode-foreground)">
      <p><strong>${PRODUCT_DISPLAY_NAME}</strong> sidebar failed to render.</p>
      <p style="opacity:.85;font-size:12px">${safe}</p>
      <p style="opacity:.7;font-size:11px">Try: Developer: Reload Window, or reinstall the VSIX.</p>
    </body></html>`;
  }

  async refresh(): Promise<void> {
    if (!this.view || !this.webviewScriptReady) {
      this.pendingStatePush = true;
      return;
    }
    await this.pushStateToWebview();
  }

  /** Activity/trace-only refresh — avoids re-reading governance + PIL panels. */
  async refreshLight(): Promise<void> {
    if (!this.view || !this.webviewScriptReady) {
      this.pendingStatePush = true;
      return;
    }
    this.lightRefreshOnly = true;
    await this.pushStateToWebview();
  }

  private postOverlay(overlay: SidebarOverlay): void {
    this.view?.webview.postMessage({ type: 'overlay', overlay });
  }

  async showCilHistory(): Promise<void> {
    const overlay = await runCilHistoryPanel();
    if (overlay) {
      this.postOverlay(overlay);
    }
  }

  async showCilDecisions(): Promise<void> {
    const overlay = await runCilDecisionsPanel();
    if (overlay) {
      this.postOverlay(overlay);
    }
  }

  private async runHomeAsk(query: string): Promise<void> {
    await runAskContoriumWithQuery(query);
  }

  private async runExportForSidebar(mode: ExportMode): Promise<void> {
    if (this.exportInFlight) {
      return;
    }
    this.exportInFlight = true;
    const report: ExportProgressReporter = (update) => this.postExportProgress(update);
    try {
      if (this.exportRunner) {
        await this.exportRunner(report, mode);
      } else {
        report({ phase: 'sync', label: 'Starting export…', percent: 2 });
        await vscode.commands.executeCommand(
          mode === 'full-intelligence' ? 'contora.exportFullIntelligence' : 'contora.exportAIContext',
        );
        report({ phase: 'done', label: 'Export complete', percent: 100 });
      }
    } catch (err) {
      report({
        phase: 'error',
        label: err instanceof Error ? err.message : 'Export failed',
        percent: 0,
      });
    } finally {
      this.exportInFlight = false;
    }
  }

  async showGovernanceOverview(): Promise<void> {
    const folder = this.folder ?? this.stateManager.getPrimaryFolder();
    if (!folder) {
      await vscode.window.showWarningMessage(`${PRODUCT_DISPLAY_NAME}: Open a folder workspace first.`);
      return;
    }
    try {
      const result = await ideControlGovernance(folder);
      this.postOverlay(formatGovernanceOverview(result));
    } catch (err) {
      await vscode.window.showErrorMessage(
        `${PRODUCT_DISPLAY_NAME}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async refreshGovernanceReview(editor?: vscode.TextEditor): Promise<void> {
    const folder = this.folder ?? this.stateManager.getPrimaryFolder();
    if (!folder) {
      return;
    }
    try {
      await runAndPersistGovernanceReview(folder, editor);
    } catch (err) {
      console.warn(`[${PRODUCT_DISPLAY_NAME}] governance review:`, err);
    }
  }

  async showChangeReview(): Promise<void> {
    const folder = this.folder ?? this.stateManager.getPrimaryFolder();
    if (!folder) {
      await vscode.window.showWarningMessage(`${PRODUCT_DISPLAY_NAME}: Open a folder workspace first.`);
      return;
    }
    try {
      const editor = vscode.window.activeTextEditor;
      const artifact = await runAndPersistGovernanceReview(folder, editor);
      if (!artifact) {
        await vscode.window.showInformationMessage(
          `${PRODUCT_DISPLAY_NAME}: No reviewable changes — open a file, stage git changes, or adjust review scope.`,
        );
        return;
      }
      this.postOverlay(formatReviewArtifactOverlay(artifact));
      void this.pushStateToWebview();
    } catch (err) {
      await vscode.window.showErrorMessage(
        `${PRODUCT_DISPLAY_NAME}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async promptEditDirection(): Promise<void> {
    const folder = this.folder ?? this.stateManager.getPrimaryFolder();
    if (!folder) {
      await vscode.window.showWarningMessage(`${PRODUCT_DISPLAY_NAME}: Open a folder workspace first.`);
      return;
    }
    const input = await vscode.window.showInputBox({
      title: 'Edit project direction',
      prompt: 'Why are you building this project? (long-term goal, not the current task)',
      placeHolder: 'e.g. Become the governance layer for AI-native development',
    });
    if (!input?.trim()) {
      return;
    }
    try {
      await ideControlUpdateIntent(folder, input.trim());
      void this.pushStateToWebview();
    } catch (err) {
      await vscode.window.showErrorMessage(
        `${PRODUCT_DISPLAY_NAME}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private defaultCilAiPanelState(): SidebarCilAiPanelState {
    return {
      enabled: false,
      provider: '—',
      model: '—',
      intentRouter: 'hybrid',
      keyReady: false,
      modulesOn: [],
      configPath: '.contora/config/llm.json',
      needsKey: false,
    };
  }

  private async loadCilAiPanelState(options?: { skipSync?: boolean }): Promise<SidebarCilAiPanelState> {
    const folder = this.folder ?? this.stateManager.getPrimaryFolder();
    const root = folder?.uri.fsPath;
    if (root && !options?.skipSync) {
      try {
        await syncCilLlmConfigFromIde(root);
      } catch {
        /* best-effort sync */
      }
    }
    return loadIdeCilAiPanelState(root);
  }

  private yieldToUi(ms = 0): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private emptyCognitionPlaceholders() {
    return {
      aiIntent: { goals: [] } as SidebarAiIntentPanel,
      intentGraph: { ...EMPTY_INTENT_GRAPH },
      projectState: { ...EMPTY_PROJECT_STATE },
      stateConflicts: { ...EMPTY_CONFLICTS },
      understandingPanel: { ...EMPTY_UNDERSTANDING },
      governanceStatus: undefined as Record<string, unknown> | undefined,
      v22View: { ...EMPTY_V22_PLACEHOLDER },
    };
  }

  /** Sync paint from cache — UI shell before disk / cognition panels load. */
  private pushInstantShell(
    seq: number,
    folder: vscode.WorkspaceFolder | undefined,
    ver: string,
  ): void {
    const byokDefault = this.defaultByokPanelState();
    const cilAiDefault = this.defaultCilAiPanelState();

    if (!folder) {
      this.postWebviewState(seq, null, byokDefault, cilAiDefault, true);
      return;
    }

    const cached = this.stateManager.getCached(folder) ?? defaultProjectState();
    const shellState = {
      ...buildSidebarWebviewState(cached, this.events, ver),
      ...this.emptyCognitionPlaceholders(),
      dataLoading: true,
      heavyLoading: false,
      panelsLoading: true,
    };
    this.postWebviewState(seq, shellState, byokDefault, cilAiDefault, true);
  }

  private defaultByokPanelState(): SidebarByokPanelState {
    const cfg = vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION);
    const ai = readAiRuntimeSettings();
    let activeModelId = '—';
    if (ai.aiProvider === 'openai') {
      activeModelId = ai.openaiModel;
    } else if (ai.aiProvider === 'anthropic') {
      activeModelId = ai.anthropicModel;
    } else if (ai.aiProvider === 'google') {
      activeModelId = ai.googleModel;
    } else if (ai.aiProvider === 'deepseek') {
      activeModelId = ai.deepseekModel;
    }
    return {
      aiProvider: ai.aiProvider,
      keyOpenAI: false,
      keyAnthropic: false,
      keyGoogle: false,
      keyDeepseek: false,
      activeModelId,
      exportFormat: cfg.get<string>('exportFormat') ?? 'markdown',
      exportTokenBudget: readResolvedExportTokenBudget(cfg),
      appendAiOnExport: cfg.get<boolean>('appendAiSummaryOnExport') === true,
      defaultAIMode: cfg.get<string>('defaultAIMode') ?? 'feature',
      needsActiveProviderKey:
        ai.aiProvider === 'openai' ||
        ai.aiProvider === 'anthropic' ||
        ai.aiProvider === 'google' ||
        ai.aiProvider === 'deepseek',
    };
  }

  private emptyCognitionState() {
    return {
      aiIntent: { goals: [] } as SidebarAiIntentPanel,
      intentGraph: { ...EMPTY_INTENT_GRAPH },
      projectState: { ...EMPTY_PROJECT_STATE },
      stateConflicts: { ...EMPTY_CONFLICTS },
      understandingPanel: { ...EMPTY_UNDERSTANDING },
    };
  }

  private postWebviewState(
    seq: number,
    state: Record<string, unknown> | null,
    byok: SidebarByokPanelState | null,
    cilAi: SidebarCilAiPanelState | null,
    instant = false,
  ): boolean {
    if (seq !== this.pushStateSeq || !this.view) {
      return false;
    }
    this.view.webview.postMessage({ type: 'state', state, byok, cilAi, instant: instant || undefined });
    return true;
  }

  private async loadByokPanelState(): Promise<SidebarByokPanelState> {
    const cfg = vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION);
    const [kOpen, kAnth, kGoo, kDeep] = await Promise.all([
      this.keys.getKey('openai'),
      this.keys.getKey('anthropic'),
      this.keys.getKey('google'),
      this.keys.getKey('deepseek'),
    ]);
    const keyOpenAI = Boolean(kOpen?.trim());
    const keyAnthropic = Boolean(kAnth?.trim());
    const keyGoogle = Boolean(kGoo?.trim());
    const keyDeepseek = Boolean(kDeep?.trim());
    const ai = readAiRuntimeSettings();
    let activeModelId = '—';
    if (ai.aiProvider === 'openai') {
      activeModelId = ai.openaiModel;
    } else if (ai.aiProvider === 'anthropic') {
      activeModelId = ai.anthropicModel;
    } else if (ai.aiProvider === 'google') {
      activeModelId = ai.googleModel;
    } else if (ai.aiProvider === 'deepseek') {
      activeModelId = ai.deepseekModel;
    }
    const needsActiveProviderKey =
      ai.aiProvider === 'openai'
        ? !keyOpenAI
        : ai.aiProvider === 'anthropic'
          ? !keyAnthropic
          : ai.aiProvider === 'google'
            ? !keyGoogle
            : ai.aiProvider === 'deepseek'
              ? !keyDeepseek
              : false;
    return {
      aiProvider: ai.aiProvider,
      keyOpenAI,
      keyAnthropic,
      keyGoogle,
      keyDeepseek,
      activeModelId,
      exportFormat: cfg.get<string>('exportFormat') ?? 'markdown',
      exportTokenBudget: readResolvedExportTokenBudget(cfg),
      appendAiOnExport: cfg.get<boolean>('appendAiSummaryOnExport') === true,
      defaultAIMode: cfg.get<string>('defaultAIMode') ?? 'feature',
      needsActiveProviderKey,
    };
  }

  private async readAiIntentForFolder(
    folder: vscode.WorkspaceFolder,
    state: ProjectState,
  ): Promise<SidebarAiIntentPanel> {
    const empty: SidebarAiIntentPanel = { goals: [] };
    const evaluated = await readAndEvaluatePersistedIntent(folder, state, this.events);
    if (!evaluated) {
      return empty;
    }
    const { file, usable } = evaluated;
    const lc = file.lifecycle;
    if (!usable) {
      return {
        goals: [],
        stale: true,
        confidence: lc.confidence,
        updatedAt: lc.lastUpdatedAt,
      };
    }
    const goals = intentToGoals(file.intent);
    const intentMode = file.intent.mode.trim() ? file.intent.mode.trim() : undefined;
    return {
      goals,
      intentMode,
      confidence: lc.confidence,
      stale: lc.status !== 'active',
      updatedAt: lc.lastUpdatedAt,
    };
  }

  private activeRelativeFile(): string | undefined {
    const doc = vscode.window.activeTextEditor?.document;
    if (!doc || doc.uri.scheme !== 'file') {
      return undefined;
    }
    const folder = this.folder ?? this.stateManager.getPrimaryFolder();
    if (!folder) {
      return undefined;
    }
    return vscode.workspace.asRelativePath(doc.uri, false).replace(/\\/g, '/');
  }

  private governanceStatusFallback(): Record<string, unknown> {
    return {
      active: false,
      constitutionLoaded: false,
      truthLoaded: false,
      identityLoaded: false,
      protectedPathCount: 0,
      forbiddenRuleCount: 0,
      protectedPaths: [],
      forbiddenActions: [],
      projectDirection: '',
      review: null,
      reviewFile: '—',
      reviewRisk: '—',
      reviewChangeType: '—',
      reviewSeverity: '—',
      reviewImpact: '—',
      reviewConfidence: '—',
      reviewProtected: '—',
      reviewTruthImpact: '—',
      reviewRecommendation: '—',
      reviewReasonChain: [],
      reviewSource: '—',
      reviewTimestamp: '—',
      reviewScopePreference: 'Auto (merge all)',
      reviewScopeValue: 'auto',
      reviewWhyChain: [],
      injectionRules: [],
      injectionTokenEstimate: 0,
      injectPreview: 'Governance not loaded',
    };
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((resolve) => {
          timer = setTimeout(() => resolve(fallback), ms);
        }),
      ]);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }

  private async loadPanelsInBackground(
    seq: number,
    panelGen: number,
    folder: vscode.WorkspaceFolder,
    state: import('../types/state').ProjectState,
    fastCore: Record<string, unknown>,
    byokDefault: SidebarByokPanelState,
    cilAiDefault: SidebarCilAiPanelState,
  ): Promise<void> {
    const settledCore = await this.withTimeout(
      Promise.allSettled([
        this.loadByokPanelState(),
        this.loadCilAiPanelState({ skipSync: true }),
        buildSidebarProjectStatePanel(folder),
        buildSidebarGraphPanel(folder),
        buildSidebarConflictsPanel(folder),
        this.readAiIntentForFolder(folder, state),
        buildSidebarGovernanceStatus(
          folder.uri.fsPath,
          this.activeRelativeFile(),
          readGovernanceReviewScope(),
        ),
      ]),
      PANEL_LOAD_TIMEOUT_MS,
      [] as PromiseSettledResult<unknown>[],
    );

    if (
      panelGen !== this.panelLoadGeneration ||
      seq !== this.pushStateSeq ||
      !this.view
    ) {
      return;
    }

    const pick = <T>(i: number, fallback: T): T =>
      settledCore[i]?.status === 'fulfilled'
        ? (settledCore[i] as PromiseFulfilledResult<T>).value
        : fallback;

    const byok = pick(0, byokDefault);
    const cilAi = pick(1, cilAiDefault);
    const projectState = pick(2, { ...EMPTY_PROJECT_STATE });
    const intentGraph = pick(3, { ...EMPTY_INTENT_GRAPH });
    const stateConflicts = pick(4, { ...EMPTY_CONFLICTS });
    const aiIntent = pick(5, { goals: [] } as SidebarAiIntentPanel);
    const governanceStatus = pick(6, this.governanceStatusFallback());

    for (const result of settledCore) {
      if (result.status === 'rejected') {
        console.warn(`[${PRODUCT_DISPLAY_NAME}] sidebar panel load:`, result.reason);
      }
    }

    const mergedCore: Record<string, unknown> = {
      ...fastCore,
      projectState,
      intentGraph,
      stateConflicts,
      aiIntent,
      governanceStatus,
      dataLoading: false,
      heavyLoading: false,
      panelsLoading: this.view.visible,
    };

    this.lastMergedCore = mergedCore;
    this.lastByok = byok;
    this.lastCilAi = cilAi;
    this.postWebviewState(seq, mergedCore, byok, cilAi, false);

    void syncCilLlmConfigFromIde(folder.uri.fsPath).catch(() => undefined);

    if (!this.view.visible) {
      this.postWebviewState(
        seq,
        { ...mergedCore, panelsLoading: false },
        byok,
        cilAi,
        false,
      );
      return;
    }

    await this.yieldToUi(8);
    if (panelGen !== this.panelLoadGeneration || seq !== this.pushStateSeq || !this.view) {
      return;
    }

    try {
      const [{ buildSidebarUnderstandingPanel }, v22Mod] = await Promise.all([
        import('../cognition/sidebarHandoffPanel'),
        import('./sidebarV22Panels'),
      ]);
      const understandingPanel = await this.withTimeout(
        buildSidebarUnderstandingPanel(folder).catch(() => ({ ...EMPTY_UNDERSTANDING })),
        PANEL_LOAD_TIMEOUT_MS,
        { ...EMPTY_UNDERSTANDING },
      );
      if (panelGen !== this.panelLoadGeneration || seq !== this.pushStateSeq || !this.view) {
        return;
      }

      const v22View = await this.withTimeout(
        v22Mod
          .buildSidebarV22View(
            folder,
            state,
            governanceStatus,
            understandingPanel,
            projectState,
            intentGraph,
            this.events,
          )
          .catch(() => v22Mod.EMPTY_V22),
        PANEL_LOAD_TIMEOUT_MS,
        v22Mod.EMPTY_V22,
      );

      if (panelGen !== this.panelLoadGeneration || seq !== this.pushStateSeq || !this.view) {
        return;
      }

      const fullCore = {
        ...mergedCore,
        understandingPanel,
        v22View,
        panelsLoading: false,
        heavyLoading: false,
      };
      this.lastMergedCore = fullCore;
      this.postWebviewState(seq, fullCore, byok, cilAi, false);
    } catch (err) {
      console.warn(`[${PRODUCT_DISPLAY_NAME}] sidebar heavy panel load:`, err);
      this.postWebviewState(
        seq,
        { ...mergedCore, panelsLoading: false, heavyLoading: false },
        byok,
        cilAi,
        false,
      );
    }
  }

  private async pushStateToWebview(): Promise<void> {
    if (!this.view || !this.webviewScriptReady) {
      this.pendingStatePush = true;
      return;
    }
    if (this.pushStateInFlight) {
      this.pushStateQueued = true;
      return;
    }
    this.pushStateInFlight = true;
    const seq = ++this.pushStateSeq;
    const panelGen = ++this.panelLoadGeneration;
    try {
      const folder = this.folder ?? this.stateManager.getPrimaryFolder();
      const ver = String((this.ctx.extension.packageJSON as { version?: string }).version ?? '');

      if (this.lightRefreshOnly && folder) {
        this.lightRefreshOnly = false;
        const cached =
          this.stateManager.getCached(folder) ??
          (await this.stateManager.loadResilient(folder, 2_000));
        const base = buildSidebarWebviewState(cached, this.events, ver);
        const merged = this.lastMergedCore
          ? {
              ...this.lastMergedCore,
              ...base,
              dataLoading: false,
              heavyLoading: false,
              panelsLoading: false,
            }
          : {
              ...base,
              ...this.emptyCognitionPlaceholders(),
              dataLoading: false,
              heavyLoading: false,
              panelsLoading: true,
            };
        this.postWebviewState(
          seq,
          merged,
          this.lastByok ?? this.defaultByokPanelState(),
          this.lastCilAi ?? this.defaultCilAiPanelState(),
          false,
        );
        return;
      }

      // Phase 0 — sync UI shell (layout + cache), then yield so webview can paint.
      this.pushInstantShell(seq, folder, ver);
      this.webviewBaseHydrated = true;
      await this.yieldToUi(1);
      if (seq !== this.pushStateSeq || !this.view) {
        return;
      }

      if (!folder) {
        return;
      }

      const byokDefault = this.defaultByokPanelState();
      const cilAiDefault = this.defaultCilAiPanelState();
      const placeholders = this.emptyCognitionPlaceholders();
      const interactiveFlags = {
        dataLoading: false,
        heavyLoading: false,
        panelsLoading: true,
      };

      // Phase 1a — paint from memory cache first (activate pre-warm), then reconcile disk.
      const cachedState = this.stateManager.getCached(folder);
      if (cachedState) {
        const cachedBase = buildSidebarWebviewState(cachedState, this.events, ver);
        this.postWebviewState(
          seq,
          { ...cachedBase, ...placeholders, ...interactiveFlags },
          byokDefault,
          cilAiDefault,
          false,
        );
        await this.yieldToUi(1);
        if (seq !== this.pushStateSeq || !this.view) {
          return;
        }
      }

      const state = await this.stateManager.loadResilient(folder, 4_000);
      if (seq !== this.pushStateSeq || !this.view) {
        return;
      }

      const base = buildSidebarWebviewState(state, this.events, ver);
      const fastCore: Record<string, unknown> = {
        ...base,
        ...placeholders,
        ...interactiveFlags,
      };
      this.postWebviewState(seq, fastCore, byokDefault, cilAiDefault, false);

      if (!this.view.visible) {
        this.postWebviewState(
          seq,
          { ...fastCore, panelsLoading: false },
          byokDefault,
          cilAiDefault,
          false,
        );
        return;
      }

      void this.loadPanelsInBackground(
        seq,
        panelGen,
        folder,
        state,
        fastCore,
        byokDefault,
        cilAiDefault,
      );
    } catch (err) {
      console.error(`[${PRODUCT_DISPLAY_NAME}] sidebar state push failed:`, err);
      try {
        this.view.webview.postMessage({
          type: 'state',
          state: null,
          byok: null,
          cilAi: null,
          error: err instanceof Error ? err.message : String(err),
        });
      } catch {
        /* webview disposed */
      }
    } finally {
      this.pushStateInFlight = false;
      if (this.pushStateQueued) {
        this.pushStateQueued = false;
        void this.pushStateToWebview();
      } else if (this.pendingStatePush) {
        this.pendingStatePush = false;
        void this.pushStateToWebview();
      }
    }
  }

  private buildCspAttr(webview: vscode.Webview, nonce: string): string {
    const cspSource = webview.cspSource;
    const csp = [
      `default-src 'none'`,
      `style-src ${cspSource} 'unsafe-inline'`,
      `font-src ${cspSource}`,
      `img-src ${cspSource} https: data:`,
      `script-src 'nonce-${nonce}' ${cspSource}`,
    ].join('; ');
    return csp.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = String(Math.random()).slice(2);
    const cspAttr = this.buildCspAttr(webview, nonce);
    if (
      ContoraSidebarProvider.htmlTemplateCache &&
      ContoraSidebarProvider.htmlTemplateCachedVersion === ContoraSidebarProvider.htmlTemplateVersion
    ) {
      return ContoraSidebarProvider.htmlTemplateCache
        .replace(/__NONCE__/g, nonce)
        .replace(/__CSP_ATTR__/g, cspAttr);
    }
    /* Inline SVGs (currentColor) — no extra assets; icons are decorative except primary actions. */
    const svg = (paths: string, w = 14, h = 14) =>
      `<svg class="cr-ico-svg" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">${paths}</svg>`;
    const ico = {
      copy: svg(
        '<path d="M4 1h8v2H4V1zm-1 3h9v11H3V4zm2 2v7h5V6H5zm7-4h2v9h-2V2z"/>',
      ),
      spark: svg(
        '<path d="M8 1l1.2 3.5h3.8L10.5 7l1.5 3.5L8 8.2 4 10.5 5.5 7 2.5 4.5h3.8L8 1z"/>',
        12,
        12,
      ),
      save: svg(
        '<path d="M3 1h8l2 2v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm1 2v9h6V3H4zm2 0h2v2H6V3zm-1 7h4v2H5v-2z"/>',
      ),
      history: svg(
        '<path d="M8 3.5a4.5 4.5 0 1 0 4.32 3.25h-1.1A3.5 3.5 0 1 1 8 4.5V6l2.5-2.5L8 1v2.5z"/><path d="M7.5 5h1v3l2 1.2-.5.8-2.5-1.5V5z"/>',
      ),
      camera: svg(
        '<path d="M2 4h2l1-1h6l1 1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm7 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 1a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>',
      ),
      target: svg(
        '<path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1a6 6 0 1 1 0 12A6 6 0 0 1 8 2zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 1a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>',
      ),
      list: svg(
        '<path d="M2 3h2v2H2V3zm0 4h2v2H2V7zm0 4h2v2H2v-2zm4-8h8v2H6V3zm0 4h8v2H6V7zm0 4h8v2H6v-2z"/>',
      ),
      branch: svg(
        '<path d="M5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 1a1.5 1.5 0 0 0-1.4 2H8a2 2 0 0 0-2 1.8V11a2 2 0 1 1-2 0V9.9A3 3 0 0 1 8 7h1.6A1.5 1.5 0 1 0 11 4zM5 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>',
      ),
      clock: svg(
        '<path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1a6 6 0 1 1 0 12A6 6 0 0 1 8 2zm-.5 2h1v4.2l2.5 1.5-.5.8L7 8.2V4z"/>',
      ),
      file: svg(
        '<path d="M4 1h5l3 3v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm4 1v3h3L8 2zM5 5h6v1H5V5zm0 3h6v1H5V8zm0 3h4v1H5v-1z"/>',
      ),
      check: svg(
        '<path d="M13.5 4L6 11.5 2.5 8l1-1L6 9.5 12.5 3l1 1z"/>',
      ),
      note: svg(
        '<path d="M3 1h7l3 3v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm6 1v3h3L9 2zM5 7h6v1H5V7zm0 3h6v1H5v-1zm0 3h4v1H5v-1z"/>',
      ),
      gear: svg(
        '<path d="M8 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm4.2 4.5l1.4.8-.3 1.6-1.6.3-.8 1.4-1.5-.6-1.5.6-.8-1.4-1.6-.3-.3-1.6 1.4-.8V8l-1.4-.8.3-1.6 1.6-.3.8-1.4 1.5.6 1.5-.6.8 1.4 1.6.3.3 1.6-1.4.8V8z"/>',
      ),
      refresh: svg(
        '<path d="M8 2.5V1l2.5 2.5L8 6V4a3.5 3.5 0 1 0 3.3 4.7h1.1A4.5 4.5 0 1 1 8 2.5z"/>',
      ),
      more: svg('<path d="M4 7h1v1H4V7zm3.5 0h1v1h-1V7zm3.5 0h1v1h-1V7z"/>'),
      bell: svg(
        '<path d="M8 1a3 3 0 0 0-3 3v2.5L4 10h8l-1-3.5V4a3 3 0 0 0-3-3zm-1 11h2a1 1 0 0 1-2 0z"/>',
      ),
      code: svg(
        '<path d="M5.5 3.2L2 8l3.5 4.8h1.4L3.2 8 6.9 3.2H5.5zm5 0L14 8l-3.5 4.8H9.1L12.8 8 9.1 3.2h1.4zM9.2 3.3h1.1l-3.4 9.4H5.8l3.4-9.4z"/>',
      ),
      plus: svg('<path d="M8 3v5h5v1H8v5H7V9H2V8h5V3h1z"/>', 12, 12),
      jumpDown: svg('<path d="M8 11.5L3.5 7h9L8 11.5zm0 2L3.5 9h9l-4.5 4.5z"/>', 14, 14),
    };
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="__CSP_ATTR__" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${PRODUCT_DISPLAY_NAME}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground, #cccccc);
      background-color: var(--vscode-sideBar-background, #252526);
      padding: 8px 10px 14px;
      margin: 0;
      line-height: 1.4;
    }
    .cr-ico-svg { display: block; flex-shrink: 0; opacity: 0.92; }
    .cr-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(127,127,127,.22));
    }
    .cr-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      letter-spacing: 0.08em;
      font-size: 11px;
      color: var(--vscode-sideBarTitle-foreground, var(--vscode-foreground));
    }
    .cr-logo {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 1px solid var(--vscode-focusBorder, var(--vscode-foreground));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      background: linear-gradient(145deg, var(--vscode-button-background), var(--vscode-button-hoverBackground));
      color: var(--vscode-button-foreground);
      border-color: transparent;
    }
    .cr-header-actions {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .cr-icon-pill {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: 4px;
      color: var(--vscode-foreground);
      opacity: 0.72;
    }
    .cr-icon-pill:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground); }
    .cr-ai-card {
      background: var(--vscode-editor-inactiveSelectionBackground, rgba(127,127,127,.1));
      border: 1px solid var(--vscode-widget-border, rgba(127,127,127,.2));
      border-radius: 10px;
      padding: 10px 10px 8px;
      margin-bottom: 12px;
    }
    .cr-ai-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 10px;
    }
    .cr-ai-card-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 700;
      color: var(--vscode-foreground);
    }
    .cr-ai-card-title .cr-ico-svg { width: 14px; height: 14px; opacity: 0.9; }
    .cr-ai-card-status {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      flex-shrink: 0;
    }
    .cr-ai-card-status .cr-dot { background: var(--vscode-testing-iconPassed, #3fb950); }
    .cr-ai-card-status.cr-ai-card-status--busy .cr-dot--pulse {
      animation: none;
      opacity: 1;
    }
    .cr-dot--pulse {
      animation: cr-dot-pulse 1.6s ease-in-out infinite;
    }
    @keyframes cr-dot-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.55; transform: scale(0.88); }
    }
    /* Recent activity row: gentle clock pulse while the live feed has items */
    .cr-sum-ico--clock.cr-sum-ico--pulse-soft {
      animation: cr-clock-soft 2.6s ease-in-out infinite;
    }
    @keyframes cr-clock-soft {
      0%, 100% { opacity: 0.75; }
      50% { opacity: 1; filter: brightness(1.2); }
    }
    .cr-ai-focus-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;
    }
    .cr-ai-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
    }
    .cr-ai-goals-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      margin: 10px 0 4px;
    }
    ul.cr-ai-goals-list {
      margin: 0;
      padding: 0 0 0 16px;
      font-size: 12px;
      line-height: 1.45;
      color: var(--vscode-foreground);
    }
    ul.cr-ai-goals-list li { margin: 2px 0; }
    ul.cr-ai-goals-list li.cr-goal-enter {
      animation: cr-goal-in 0.42s ease-out both;
    }
    @keyframes cr-goal-in {
      from { opacity: 0; transform: translateX(-6px); }
      to { opacity: 1; transform: translateX(0); }
    }
    ul.cr-activity-feed {
      list-style: none;
      margin: 4px 0 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.4;
      color: var(--vscode-descriptionForeground);
    }
    ul.cr-activity-feed li.cr-activity-feed-row {
      margin: 0;
      padding: 3px 0 3px 2px;
      border-radius: 3px;
    }
    ul.cr-activity-feed li.cr-activity-feed-enter {
      animation: cr-activity-feed-in 0.42s ease-out both;
    }
    @keyframes cr-activity-feed-in {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    ul.cr-activity-feed li.cr-activity-feed-row--flash {
      animation: cr-activity-feed-flash 1s ease-out;
    }
    @keyframes cr-activity-feed-flash {
      0% {
        color: var(--vscode-foreground);
        background-color: var(--vscode-editor-inactiveSelectionBackground, rgba(127, 127, 127, 0.22));
      }
      100% {
        color: var(--vscode-descriptionForeground);
        background-color: transparent;
      }
    }
    .cr-ai-goals-empty {
      margin: 4px 0 0;
      font-size: 11px;
      line-height: 1.4;
      color: var(--vscode-descriptionForeground);
    }
    .cr-ai-goals-empty.cr-text-shimmer {
      position: relative;
      overflow: hidden;
    }
    button.cr-ai-goals-toggle {
      display: block;
      margin: 6px 0 0;
      padding: 0;
      border: none;
      background: transparent;
      font-family: inherit;
      font-size: 11px;
      line-height: 1.35;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      text-align: left;
    }
    button.cr-ai-goals-toggle:hover {
      text-decoration: underline;
    }
    button.cr-ai-goals-toggle:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 2px;
    }
    .cr-graph-meta {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      font-weight: 500;
      letter-spacing: 0.02em;
    }
    .cr-graph-line {
      margin: 0 0 6px;
      font-size: 12px;
      line-height: 1.45;
      color: var(--vscode-foreground);
    }
    .cr-graph-muted {
      margin: 0 0 8px;
      font-size: 11px;
      line-height: 1.4;
      color: var(--vscode-descriptionForeground);
    }
    ul.cr-graph-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    ul.cr-graph-list li {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 8px;
      align-items: start;
      padding: 7px 0;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(127,127,127,.14));
      font-size: 12px;
      line-height: 1.35;
    }
    ul.cr-graph-list li:last-child { border-bottom: none; }
    .cr-graph-status {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 4px;
      white-space: nowrap;
      margin-top: 1px;
    }
    .cr-graph-status--active {
      color: var(--vscode-testing-iconPassed, #89d185);
      background: rgba(137, 209, 133, 0.12);
    }
    .cr-graph-status--weakening {
      color: var(--vscode-editorWarning-foreground, #cca700);
      background: rgba(204, 167, 0, 0.12);
    }
    .cr-graph-status--partial {
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-badge-background, rgba(127,127,127,.18));
    }
    .cr-graph-text {
      color: var(--vscode-foreground);
      word-break: break-word;
    }
    .cr-graph-conf {
      font-size: 10px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      font-variant-numeric: tabular-nums;
    }
    .cr-graph-domains {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin: 0 0 8px;
    }
    .cr-graph-domain {
      font-size: 10px;
      padding: 2px 7px;
      border-radius: 999px;
      border: 1px solid var(--vscode-widget-border, rgba(127,127,127,.22));
      color: var(--vscode-descriptionForeground);
    }
    .cr-graph-empty {
      margin: 0;
      font-size: 11px;
      line-height: 1.4;
      color: var(--vscode-descriptionForeground);
    }
    .cr-psb-block { margin: 0 0 10px; }
    .cr-psb-k {
      display: block;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }
    ul.cr-psb-list {
      margin: 0;
      padding: 0 0 0 16px;
      font-size: 12px;
      line-height: 1.45;
      color: var(--vscode-foreground);
    }
    ul.cr-psb-list--warn { color: var(--vscode-editorWarning-foreground, var(--vscode-foreground)); }
    .cr-ai-goals-empty.cr-text-shimmer::after {
      content: '';
      position: absolute;
      inset: 0;
      width: 55%;
      background: linear-gradient(
        105deg,
        transparent 0%,
        var(--vscode-scrollbarSlider-hoverBackground, rgba(127, 127, 127, 0.35)) 50%,
        transparent 100%
      );
      opacity: 0.55;
      animation: cr-shimmer-sweep 2.1s ease-in-out infinite;
      pointer-events: none;
    }
    @keyframes cr-shimmer-sweep {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(220%); }
    }
    .cr-ai-card-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .cr-ai-side-strip {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr auto;
      gap: 6px;
      align-items: end;
      padding-top: 8px;
      margin-top: 4px;
      border-top: 1px solid var(--vscode-widget-border, rgba(127,127,127,.15));
    }
    .cr-ai-jump-byok {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      margin-bottom: 1px;
      padding: 0;
      flex-shrink: 0;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
    }
    .cr-ai-jump-byok:hover {
      color: var(--vscode-textLink-foreground);
      background: var(--vscode-toolbar-hoverBackground);
    }
    .cr-ai-jump-byok:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 1px;
    }
    .cr-ai-jump-byok .cr-ico-svg { width: 14px; height: 14px; opacity: 0.88; }
    .cr-ai-side-cell {
      min-width: 0;
      font-size: 10px;
      line-height: 1.35;
    }
    .cr-ai-side-k {
      display: block;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 2px;
    }
    .cr-ai-side-v {
      display: block;
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-foreground);
      word-break: break-word;
    }
    .cr-ai-side-v .cr-ai-byok-muted { font-weight: 500; color: var(--vscode-descriptionForeground); }
    .cr-ai-side-mode { color: var(--vscode-symbolIcon-arrayForeground, #c586c0); font-weight: 600; }
    .cr-badge-pro {
      display: inline-block;
      margin-left: 4px;
      padding: 0 5px;
      font-size: 9px;
      font-weight: 700;
      vertical-align: middle;
      border-radius: 3px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .cr-ai-card-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid var(--vscode-widget-border, rgba(127,127,127,.15));
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    .cr-ai-foot-ctx { color: var(--vscode-textLink-foreground); cursor: default; }
    .cr-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; margin-bottom: 0; }
    .cr-export-progress { margin-top: 2px; }
    .cr-export-progress[hidden] { display: none !important; }
    .cr-export-progress-track {
      height: 3px;
      border-radius: 999px;
      background: var(--vscode-widget-border, rgba(127, 127, 127, 0.22));
      overflow: hidden;
    }
    .cr-export-progress-bar {
      height: 100%;
      width: 0%;
      border-radius: inherit;
      background: var(--vscode-progressBar-background, var(--vscode-button-background));
      transition: width 0.28s ease;
    }
    .cr-export-progress-label {
      margin: 5px 2px 0;
      font-size: 11px;
      line-height: 1.35;
      color: var(--vscode-descriptionForeground);
    }
    .cr-export-progress-label--done {
      color: var(--vscode-testing-iconPassed, #3fb950);
    }
    .cr-export-progress-label--error {
      color: var(--vscode-errorForeground, #f85149);
    }
    button.cr-primary.cr-primary--busy {
      opacity: 0.92;
      pointer-events: none;
    }
    button.cr-primary .cr-export-spin {
      display: none;
      align-items: center;
    }
    button.cr-primary.cr-primary--busy .cr-export-spin {
      display: inline-flex;
      animation: cr-export-spin 0.85s linear infinite;
    }
    @keyframes cr-export-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .cr-actions-advanced {
      border-radius: 8px;
      border: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, 0.2));
      background: var(--vscode-editor-inactiveSelectionBackground, rgba(127, 127, 127, 0.08));
      overflow: hidden;
      transition: border-color 0.18s ease, background 0.18s ease;
    }
    .cr-actions-advanced[open] {
      border-color: rgba(127, 127, 127, 0.28);
      background: linear-gradient(
        180deg,
        rgba(127, 127, 127, 0.1) 0%,
        var(--vscode-editor-inactiveSelectionBackground, rgba(127, 127, 127, 0.06)) 100%
      );
    }
    .cr-actions-advanced > summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      cursor: pointer;
      padding: 8px 10px;
      list-style: none;
      user-select: none;
    }
    .cr-actions-advanced > summary::-webkit-details-marker { display: none; }
    .cr-actions-advanced-summary-left {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .cr-actions-advanced-chevron {
      font-size: 10px;
      opacity: 0.7;
      transition: transform 0.18s ease;
    }
    .cr-actions-advanced[open] .cr-actions-advanced-chevron { transform: rotate(90deg); }
    .cr-actions-advanced-title {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
    }
    .cr-actions-advanced-hint {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      opacity: 0.72;
      white-space: nowrap;
    }
    .cr-actions-advanced-panel {
      padding: 0 10px 10px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .cr-actions-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .cr-actions-group + .cr-actions-group {
      padding-top: 10px;
      border-top: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, 0.16));
    }
    .cr-actions-group-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      opacity: 0.8;
    }
    .cr-actions-group-desc {
      margin: 0;
      font-size: 10px;
      line-height: 1.4;
      color: var(--vscode-descriptionForeground);
      opacity: 0.78;
    }
    button.cr-action-transfer {
      width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      padding: 9px 10px;
      font-size: 12px;
      font-weight: 600;
      font-family: var(--vscode-font-family);
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
      border: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, 0.22));
      border-radius: 7px;
      cursor: pointer;
    }
    button.cr-action-transfer:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    button.cr-action-transfer:disabled {
      opacity: 0.55;
      cursor: default;
    }
    .cr-actions-workspace {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    button.cr-action-workspace {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      padding: 7px 6px;
      font-size: 11px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-input-background, rgba(0, 0, 0, 0.12));
      border: 1px dashed var(--vscode-widget-border, rgba(127, 127, 127, 0.3));
      border-radius: 6px;
      cursor: pointer;
    }
    button.cr-action-workspace:hover {
      border-style: solid;
      background: var(--vscode-toolbar-hoverBackground);
    }
    .cr-actions-group-desc code {
      font-size: 9px;
      padding: 1px 4px;
      border-radius: 3px;
      background: rgba(127, 127, 127, 0.14);
    }
    button.cr-primary {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 12px;
      font-size: var(--vscode-font-size);
      font-weight: 600;
      font-family: var(--vscode-font-family);
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 1px 0 rgba(0,0,0,.12);
    }
    button.cr-primary:hover { background: var(--vscode-button-hoverBackground); }
    button.cr-primary .cr-ico-svg { opacity: 1; }
    .cr-grid2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    button.cr-secondary, button.cr-tertiary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-family: var(--vscode-font-family);
    }
    button.cr-secondary {
      padding: 8px 8px;
      font-size: 12px;
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 6px;
      cursor: pointer;
    }
    button.cr-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    button.cr-tertiary {
      padding: 7px 8px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-input-background, transparent);
      border: 1px dashed var(--vscode-widget-border, rgba(127,127,127,.4));
      border-radius: 6px;
      cursor: pointer;
    }
    button.cr-tertiary:hover {
      color: var(--vscode-foreground);
      background: var(--vscode-toolbar-hoverBackground);
    }
    .cr-section {
      margin-top: 12px;
      padding-top: 0;
    }
    .cr-module-card {
      background: var(--vscode-editor-inactiveSelectionBackground, rgba(127,127,127,.1));
      border: 1px solid var(--vscode-widget-border, rgba(127,127,127,.2));
      border-radius: 10px;
      padding: 10px 10px 8px;
    }
    .cr-module-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin: 0 0 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(127,127,127,.14));
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-descriptionForeground));
      text-transform: uppercase;
    }
    .cr-module-card-head .cr-sec-left {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .cr-module-card-head .cr-sec-ico {
      display: flex;
      color: var(--vscode-descriptionForeground);
      opacity: 0.95;
    }
    .cr-module-card-body { min-width: 0; }
    .cr-module-card--workspace {
      border-left: 3px solid var(--vscode-gitDecoration-addedResourceForeground, #73c991);
    }
    .cr-module-card--intent {
      border-left: 3px solid var(--vscode-symbolIcon-arrayForeground, #c586c0);
      background: linear-gradient(
        165deg,
        rgba(197, 134, 192, 0.11) 0%,
        var(--vscode-editor-inactiveSelectionBackground, rgba(127, 127, 127, 0.1)) 48%
      );
    }
    .cr-module-card--state {
      border-left: 3px solid var(--vscode-gitDecoration-untrackedResourceForeground, #75beff);
      background: linear-gradient(
        165deg,
        rgba(117, 190, 255, 0.11) 0%,
        var(--vscode-editor-inactiveSelectionBackground, rgba(127, 127, 127, 0.1)) 48%
      );
    }
    .cr-module-card--files {
      border-left: 3px solid var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d);
      background: linear-gradient(
        165deg,
        rgba(226, 192, 141, 0.08) 0%,
        var(--vscode-editor-inactiveSelectionBackground, rgba(127, 127, 127, 0.08)) 40%
      );
    }
    .cr-module-card--state .cr-psb-panel {
      margin-top: 8px;
      padding: 8px 8px 6px;
      border-radius: 6px;
      background: var(--vscode-input-background, rgba(0, 0, 0, 0.08));
      border: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, 0.14));
    }
    .cr-module-card--conflicts {
      border-left: 3px solid var(--vscode-inputValidationWarningBorder, #cca700);
      background: rgba(204, 167, 0, 0.08);
    }
    .cr-conf-meta { color: var(--vscode-inputValidationWarningForeground, var(--vscode-descriptionForeground)); }
    .cr-conf-item { margin-bottom: 10px; }
    .cr-conf-item-k { font-size: 10px; font-weight: 600; text-transform: uppercase; opacity: 0.85; }
    .cr-module-card--state .cr-psb-panel--warn {
      border-color: rgba(204, 167, 0, 0.28);
      background: rgba(204, 167, 0, 0.07);
    }
    .cr-module-card--intent .cr-graph-list li {
      padding: 8px 6px;
      border-radius: 5px;
      border-bottom: none;
    }
    .cr-module-card--intent .cr-graph-list li + li {
      margin-top: 4px;
      border-top: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, 0.12));
    }
    .cr-module-card--intent .cr-graph-list li:first-child {
      background: rgba(127, 127, 127, 0.06);
    }
    .cr-module-card--files .cr-file-list {
      margin: 0;
      padding: 2px 0 0;
    }
    .cr-module-card--handoff {
      border-left: 3px solid var(--vscode-charts-orange, #d18616);
      background: linear-gradient(
        165deg,
        rgba(209, 134, 22, 0.1) 0%,
        var(--vscode-editor-inactiveSelectionBackground, rgba(127, 127, 127, 0.1)) 50%
      );
    }
    .cr-module-card--governance {
      border-left: 3px solid var(--vscode-charts-green, #89d185);
    }
    .cr-gov-intent {
      width: 100%;
      margin-top: 6px;
    }
    .cr-today-card {
      background: var(--vscode-editor-inactiveSelectionBackground, rgba(127,127,127,.08));
      border: 1px solid var(--vscode-widget-border, rgba(127,127,127,.18));
      border-radius: 8px;
      padding: 10px 12px;
    }
    .cr-today-card .cr-task-input {
      width: 100%;
      margin-top: 4px;
    }
    .cr-today-status {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 10px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    .cr-gov-status-line {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      margin: 0 0 4px;
    }
    .cr-gov-status-line .cr-gov-ok { color: var(--vscode-testing-iconPassed, #3fb950); }
    .cr-gov-meta-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 6px 10px;
      margin: 8px 0 10px;
      font-size: 11px;
      width: 100%;
    }
    .cr-gov-meta-grid > div {
      min-width: 0;
      overflow: hidden;
    }
    .cr-gov-meta-grid span {
      color: var(--vscode-descriptionForeground);
      display: block;
      margin-bottom: 1px;
    }
    .cr-gov-meta-grid strong {
      display: block;
      min-width: 0;
      max-width: 100%;
      font-weight: 600;
      color: var(--vscode-foreground);
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .cr-gov-inject-block {
      margin: 10px 0 8px;
      padding: 8px 10px;
      border-radius: 6px;
      background: rgba(137, 209, 133, 0.08);
      border: 1px solid rgba(137, 209, 133, 0.22);
    }
    .cr-gov-inject-k {
      display: block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 4px;
    }
    .cr-gov-inject-preview {
      margin: 0 0 8px;
      font-size: 11px;
      line-height: 1.4;
      color: var(--vscode-foreground);
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .cr-gov-rules-list {
      margin: 0 0 6px;
      padding-left: 16px;
      font-size: 11px;
      line-height: 1.35;
      color: var(--vscode-descriptionForeground);
    }
    .cr-gov-rules-list li { margin-bottom: 2px; }
    .cr-gov-scope-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 8px;
      font-size: 11px;
    }
    .cr-gov-scope-row label {
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
    }
    .cr-gov-scope-row select {
      flex: 1;
      min-width: 0;
      font-size: 11px;
      padding: 3px 6px;
      border-radius: 4px;
      border: 1px solid var(--vscode-input-border, rgba(127,127,127,.35));
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
    }
    .cr-gov-why-block {
      margin: 8px 0 10px;
      padding: 8px 10px;
      border-radius: 6px;
      background: rgba(127, 127, 127, 0.08);
      border: 1px solid rgba(127, 127, 127, 0.18);
    }
    .cr-gov-why-list {
      margin: 0;
      padding-left: 0;
      list-style: none;
      font-size: 11px;
      line-height: 1.45;
      color: var(--vscode-foreground);
    }
    .cr-gov-why-list li { margin-bottom: 3px; }
    .cr-gov-why-list li.cr-why-neg { color: var(--vscode-descriptionForeground); }
    .cr-ai-context-card {
      background: var(--vscode-editor-inactiveSelectionBackground, rgba(127,127,127,.08));
      border: 1px solid var(--vscode-widget-border, rgba(127,127,127,.18));
      border-radius: 8px;
      padding: 10px 12px;
    }
    .cr-ai-context-includes {
      margin: 6px 0 10px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.45;
    }
    .cr-sync-mini {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }
    .cr-sync-mini button { flex: 1; font-size: 11px; padding: 5px 8px; }
    .cr-overlay {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding: 8px;
    }
    .cr-overlay[hidden] { display: none !important; }
    .cr-overlay-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,.35);
    }
    .cr-overlay-panel {
      position: relative;
      width: 100%;
      max-height: 78vh;
      overflow: auto;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border, rgba(127,127,127,.35));
      border-radius: 10px;
      box-shadow: 0 8px 28px rgba(0,0,0,.25);
      padding: 12px 14px 14px;
    }
    .cr-overlay-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 10px;
    }
    .cr-overlay-head h2 {
      margin: 0;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .cr-overlay-close {
      border: none;
      background: transparent;
      color: var(--vscode-foreground);
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .cr-overlay-close:hover { background: var(--vscode-toolbar-hoverBackground); }
    .cr-overlay-row {
      margin: 0 0 8px;
      font-size: 12px;
      line-height: 1.4;
    }
    .cr-overlay-k {
      display: block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 2px;
    }
    .cr-overlay-list {
      margin: 4px 0 0;
      padding-left: 16px;
      font-size: 12px;
    }
    .cr-overlay-foot { margin-top: 12px; }
    .cr-overlay-foot button { width: 100%; }
    .cr-review-pass { color: var(--vscode-testing-iconPassed, #3fb950); }
    .cr-review-warn { color: var(--vscode-inputValidation-warningForeground, #cca700); }
    .cr-review-block { color: var(--vscode-errorForeground, #f85149); }
    #crSecAiGoals { display: none !important; }
    .cr-stack { margin-top: 10px; }
    .cr-stack:first-of-type { margin-top: 14px; }
    .cr-stack-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      opacity: 0.85;
      margin: 0 0 6px 2px;
      padding-bottom: 5px;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, 0.2));
    }
    .cr-stack-fold {
      margin-top: 8px;
      border-radius: 6px;
      border: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, 0.12));
      background: var(--vscode-input-background, rgba(0, 0, 0, 0.04));
    }
    .cr-stack-fold > summary {
      cursor: pointer;
      padding: 6px 8px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: var(--vscode-descriptionForeground);
      list-style: none;
      user-select: none;
    }
    .cr-stack-fold > summary::-webkit-details-marker { display: none; }
    .cr-stack-fold > summary::before {
      content: '▸ ';
      display: inline-block;
      transition: transform 0.15s ease;
    }
    .cr-stack-fold[open] > summary::before { transform: rotate(90deg); }
    .cr-stack-fold-body { padding: 0 8px 8px; }
    .cr-v22-fields { display: flex; flex-direction: column; gap: 8px; }
    .cr-v22-row { display: flex; flex-direction: column; gap: 2px; }
    .cr-v22-row .cr-psb-k { font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.72; }
    .cr-v22-focus {
      width: 100%;
      margin: 0 0 6px;
      font-size: 12px;
      line-height: 1.45;
      font-family: inherit;
      color: var(--vscode-foreground);
      background: transparent;
      border: none;
      border-bottom: 1px dashed rgba(127, 127, 127, 0.22);
      border-radius: 0;
      padding: 1px 2px 3px;
      min-height: 0;
      resize: none;
      outline: none;
      box-shadow: none;
      cursor: text;
      transition:
        background 0.16s ease,
        border-color 0.16s ease,
        border-radius 0.16s ease,
        padding 0.16s ease,
        box-shadow 0.16s ease;
    }
    .cr-v22-focus:not(:focus):hover {
      border-bottom-color: rgba(127, 127, 127, 0.38);
      background: rgba(127, 127, 127, 0.04);
    }
    .cr-v22-focus:not(:focus):placeholder-shown {
      color: var(--vscode-descriptionForeground);
    }
    .cr-v22-focus::placeholder {
      color: var(--vscode-input-placeholderForeground, var(--vscode-descriptionForeground));
      opacity: 0.82;
    }
    .cr-v22-focus:focus,
    .cr-v22-focus.cr-v22-focus--active {
      min-height: 44px;
      padding: 8px;
      resize: vertical;
      border: 1px solid var(--vscode-focusBorder, var(--vscode-widget-border, rgba(127, 127, 127, 0.45)));
      border-radius: 6px;
      background: var(--vscode-input-background, var(--cr-input-bg, #141414));
      color: inherit;
      box-shadow: 0 0 0 1px rgba(127, 127, 127, 0.08);
    }
    .cr-capture-row {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-top: 4px;
    }
    .cr-v22-capture-input {
      flex: 1;
      min-width: 0;
      font-size: 11px;
      padding: 5px 8px;
      border-radius: 4px;
      border: 1px solid var(--vscode-input-border, rgba(127,127,127,0.35));
      background: var(--vscode-input-background, var(--cr-input-bg, #141414));
      color: inherit;
    }
    .cr-tertiary-sm { font-size: 11px; padding: 6px 8px; }
    .cr-live-badge {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--vscode-testing-iconPassed, #3fb950);
      flex-shrink: 0;
      animation: cr-live-pulse 2.2s ease-in-out infinite;
    }
    @keyframes cr-live-pulse {
      0%, 100% { opacity: 0.4; transform: scale(0.85); }
      50% { opacity: 1; transform: scale(1.15); }
    }
    .cr-module-card--cognition {
      border-left: 3px solid var(--vscode-symbolIcon-arrayForeground, #c586c0);
      background: linear-gradient(
        165deg,
        rgba(197, 134, 192, 0.12) 0%,
        var(--vscode-editor-inactiveSelectionBackground, rgba(127, 127, 127, 0.1)) 52%
      );
    }
    .cr-module-card--intelligence {
      border-left: 3px solid var(--vscode-gitDecoration-addedResourceForeground, #73c991);
      background: linear-gradient(
        165deg,
        rgba(115, 201, 145, 0.11) 0%,
        var(--vscode-editor-inactiveSelectionBackground, rgba(127, 127, 127, 0.1)) 52%
      );
    }
    .cr-module-card--decision {
      border-left: 3px solid var(--vscode-charts-green, #89d185);
      background: linear-gradient(
        165deg,
        rgba(137, 209, 133, 0.1) 0%,
        var(--vscode-editor-inactiveSelectionBackground, rgba(127, 127, 127, 0.1)) 52%
      );
    }
    .cr-module-card--graph {
      border-left: 3px solid var(--vscode-symbolIcon-functionForeground, #b180d7);
      background: linear-gradient(
        165deg,
        rgba(177, 128, 215, 0.09) 0%,
        var(--vscode-editor-inactiveSelectionBackground, rgba(127, 127, 127, 0.08)) 55%
      );
    }
    .cr-module-card--activity {
      border-left: 3px solid var(--vscode-charts-orange, #d18616);
      background: linear-gradient(
        165deg,
        rgba(209, 134, 22, 0.09) 0%,
        var(--vscode-editor-inactiveSelectionBackground, rgba(127, 127, 127, 0.08)) 55%
      );
      padding: 8px 10px;
    }
    .cr-module-card--structure {
      border-left: 3px solid var(--vscode-gitDecoration-untrackedResourceForeground, #75beff);
      background: linear-gradient(
        165deg,
        rgba(117, 190, 255, 0.1) 0%,
        var(--vscode-editor-inactiveSelectionBackground, rgba(127, 127, 127, 0.08)) 55%
      );
    }
    .cr-module-card--export {
      border-left: 3px solid var(--vscode-symbolIcon-keywordForeground, #569cd6);
      background: linear-gradient(
        165deg,
        rgba(86, 156, 214, 0.09) 0%,
        var(--vscode-editor-inactiveSelectionBackground, rgba(127, 127, 127, 0.08)) 55%
      );
    }
    .cr-v22-row { min-width: 0; }
    .cr-graph-line,
    .cr-graph-muted,
    .cr-graph-meta,
    .cr-gov-inject-preview,
    ul.cr-psb-list li,
    ul.cr-activity-feed li,
    .cr-graph-domain {
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
    }
    .cr-val-flash {
      animation: cr-val-flash 0.85s ease-out;
    }
    @keyframes cr-val-flash {
      0% {
        background-color: var(--vscode-editor-inactiveSelectionBackground, rgba(127, 127, 127, 0.28));
        border-radius: 3px;
      }
      100% { background-color: transparent; }
    }
    details.cr-cortex {
      background: linear-gradient(
        165deg,
        rgba(177, 128, 215, 0.07) 0%,
        var(--vscode-sideBar-background, transparent) 60%
      );
    }
    .cr-stack-fold.cr-stack-fold--structure {
      background: linear-gradient(
        165deg,
        rgba(117, 190, 255, 0.06) 0%,
        var(--vscode-input-background, rgba(0, 0, 0, 0.04)) 55%
      );
    }
    details.cr-cortex {
      margin-top: 12px;
      border-radius: 10px;
      border: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, 0.22));
      background: var(--vscode-sideBar-background, transparent);
    }
    details.cr-cortex > summary.cr-cortex-summary {
      cursor: pointer;
      padding: 10px 10px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground));
      list-style: none;
      user-select: none;
      border-bottom: 1px solid transparent;
    }
    details.cr-cortex[open] > summary.cr-cortex-summary {
      border-bottom-color: var(--vscode-widget-border, rgba(127, 127, 127, 0.18));
      margin-bottom: 4px;
    }
    details.cr-cortex > summary.cr-cortex-summary::-webkit-details-marker { display: none; }
    details.cr-cortex > summary.cr-cortex-summary::before {
      content: '▸ ';
      margin-right: 4px;
      opacity: 0.7;
    }
    details.cr-cortex[open] > summary.cr-cortex-summary::before { content: '▾ '; }
    .cr-cortex-body { padding: 4px 6px 8px; }
    .cr-cortex-menu {
      display: flex;
      gap: 6px;
      padding: 6px 6px 4px;
      flex-wrap: wrap;
    }
    button.cr-cortex-btn {
      flex: 1 1 auto;
      min-width: 0;
      padding: 5px 8px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.02em;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      cursor: pointer;
    }
    button.cr-cortex-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    button.cr-cortex-btn:active {
      opacity: 0.85;
    }
    .cr-overlay-pre {
      margin: 0;
      padding: 8px 0 0;
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--vscode-foreground);
      max-height: min(420px, 55vh);
      overflow-y: auto;
    }
    .cr-cortex-body .cr-section { margin-top: 8px; }
    .cr-cortex-body .cr-section:first-child { margin-top: 4px; }
    .cr-cortex-body .cr-git { margin-top: 8px; }
    .cr-cortex-body #crByokSection { margin-top: 10px !important; }
    .cr-module-card--fngraph {
      border-left: 3px solid var(--vscode-symbolIcon-functionForeground, #b180d7);
      background: linear-gradient(
        165deg,
        rgba(177, 128, 215, 0.08) 0%,
        var(--vscode-editor-inactiveSelectionBackground, rgba(127, 127, 127, 0.08)) 55%
      );
    }
    .cr-module-card--depimpact {
      border-left: 3px solid var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d);
    }
    .cr-fn-flows { margin: 0 0 10px; }
    .cr-fn-flow-line {
      font-size: 11px;
      line-height: 1.45;
      color: var(--vscode-descriptionForeground);
      margin: 0 0 6px;
      font-family: var(--vscode-editor-font-family, Consolas, monospace);
    }
    .cr-fn-flow-chain { color: var(--vscode-foreground); }
    .cr-fn-flow-arrow { opacity: 0.55; margin: 0 4px; }
    ul.cr-fn-tree-root {
      list-style: none;
      margin: 0;
      padding: 0;
      font-family: var(--vscode-editor-font-family, Consolas, 'Courier New', monospace);
      font-size: 11px;
      line-height: 1.4;
    }
    ul.cr-fn-tree-children {
      list-style: none;
      margin: 0;
      padding: 0 0 0 2px;
    }
    .cr-fn-tree-item { margin: 0; padding: 0; }
    .cr-fn-tree-line {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0;
      padding: 1px 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    .cr-fn-tree-branch {
      color: var(--vscode-descriptionForeground);
      opacity: 0.75;
      flex-shrink: 0;
      user-select: none;
    }
    .cr-fn-tree-label {
      color: var(--vscode-symbolIcon-functionForeground, #dcdcaa);
    }
    .cr-fn-tree-label--root {
      font-weight: 600;
      color: var(--vscode-foreground);
    }
    .cr-fn-tree-label--class { color: var(--vscode-symbolIcon-classForeground, #4ec9b0); }
    .cr-fn-tree-file {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      margin-left: 4px;
      opacity: 0.85;
    }
    ul.cr-fn-impact-list {
      list-style: none;
      margin: 0;
      padding: 0;
      font-size: 11px;
    }
    ul.cr-fn-impact-list li {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: baseline;
      padding: 5px 0;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, 0.1));
    }
    ul.cr-fn-impact-list li:last-child { border-bottom: none; }
    .cr-fn-impact-target { font-weight: 600; color: var(--vscode-foreground); }
    .cr-fn-impact-effect { color: var(--vscode-descriptionForeground); flex: 1; min-width: 0; }
    .cr-fn-impact-badge {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 1px 5px;
      border-radius: 4px;
    }
    .cr-fn-impact-badge--high {
      color: var(--vscode-inputValidation-errorForeground, #f48771);
      background: rgba(244, 135, 113, 0.12);
    }
    .cr-fn-impact-badge--medium {
      color: var(--vscode-inputValidation-warningForeground, #cca700);
      background: rgba(204, 167, 0, 0.1);
    }
    .cr-fn-impact-badge--low {
      color: var(--vscode-descriptionForeground);
      background: rgba(127, 127, 127, 0.1);
    }
    .cr-module-card--kg {
      border-left: 3px solid var(--vscode-charts-purple, #b180d7);
    }
    details.cr-kg-intent {
      margin: 0 0 6px;
      border-radius: 5px;
      border: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, 0.12));
      background: rgba(127, 127, 127, 0.04);
    }
    details.cr-kg-intent > summary {
      cursor: pointer;
      padding: 6px 8px;
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-foreground);
      list-style: none;
    }
    details.cr-kg-intent > summary::-webkit-details-marker { display: none; }
    details.cr-kg-intent[open] > summary { border-bottom: 1px solid var(--vscode-widget-border, rgba(127,127,127,0.12)); }
    ul.cr-kg-tree {
      list-style: none;
      margin: 0;
      padding: 4px 8px 8px 12px;
      font-family: var(--vscode-editor-font-family, Consolas, monospace);
      font-size: 11px;
      line-height: 1.45;
    }
    .cr-kg-node { margin: 2px 0; }
    .cr-kg-type-intent { color: var(--vscode-charts-purple, #b180d7); font-weight: 600; }
    .cr-kg-type-module { color: var(--vscode-charts-blue, #3794ff); }
    .cr-kg-type-file { color: var(--vscode-symbolIcon-fileForeground, #cccccc); }
    .cr-kg-type-function { color: var(--vscode-symbolIcon-functionForeground, #dcdcaa); }
    .cr-kg-arrow { opacity: 0.5; margin: 0 4px; }
    ul.cr-reason-list { list-style: none; margin: 0; padding: 0; font-size: 11px; }
    ul.cr-reason-list li { padding: 6px 0; border-bottom: 1px solid var(--vscode-widget-border, rgba(127,127,127,0.1)); }
    ul.cr-reason-list li:last-child { border-bottom: none; }
    .cr-reason-target { font-weight: 600; color: var(--vscode-foreground); }
    .cr-reason-why { color: var(--vscode-descriptionForeground); margin-top: 2px; }
    .cr-module-card--workspace .cr-sum-line:first-child { padding-top: 2px; }
    .cr-section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-descriptionForeground));
      margin: 0 0 6px;
      text-transform: uppercase;
    }
    .cr-section-head .cr-sec-left {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .cr-section-head .cr-sec-ico {
      display: flex;
      color: var(--vscode-descriptionForeground);
      opacity: 0.95;
    }
    .cr-section-head .cr-sec-ico .cr-ico-svg { width: 13px; height: 13px; }
    .cr-link-quiet {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0;
      text-transform: none;
      color: var(--vscode-textLink-foreground);
      cursor: default;
      opacity: 0.85;
    }
    .cr-task-meta { font-weight: 500; letter-spacing: 0.02em; font-size: 11px; color: var(--vscode-descriptionForeground); }
    textarea, input {
      width: 100%;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 6px;
      padding: 8px 10px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    textarea#task.cr-task-input {
      background: transparent;
      color: var(--vscode-foreground);
      border: 1px dashed var(--vscode-widget-border, rgba(127,127,127,.4));
      border-radius: 6px;
      box-shadow: none;
      font-size: 12px;
      padding: 5px 8px;
      min-height: 34px;
      max-height: 100px;
      resize: vertical;
      line-height: 1.4;
      opacity: 0.95;
      transition: border-color 0.12s ease, background 0.12s ease, opacity 0.12s ease;
    }
    textarea#task.cr-task-input::placeholder {
      color: var(--vscode-input-placeholderForeground, var(--vscode-descriptionForeground));
      opacity: 0.75;
    }
    textarea#task.cr-task-input:hover {
      opacity: 1;
      background: var(--vscode-input-background, rgba(127,127,127,.06));
      border-color: var(--vscode-input-border, rgba(127,127,127,.45));
      border-style: solid;
    }
    textarea#task.cr-task-input:focus {
      opacity: 1;
      outline: none;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground, var(--vscode-foreground));
      border: 1px solid var(--vscode-focusBorder, var(--vscode-input-border));
      border-style: solid;
    }
    textarea#notes { min-height: 68px; resize: vertical; margin-top: 2px; }
    .cr-summary {
      border: none;
      border-radius: 0;
      padding: 0;
      background: transparent;
    }
    .cr-sum-line {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 12px;
      margin: 0;
      padding: 6px 4px;
      border-radius: 4px;
    }
    .cr-sum-line + .cr-sum-line { border-top: 1px solid var(--vscode-widget-border, rgba(127,127,127,.12)); }
    .cr-sum-ico {
      flex-shrink: 0;
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      margin-top: 1px;
    }
    .cr-sum-ico--files { color: var(--vscode-gitDecoration-addedResourceForeground, #73c991); background: rgba(115,201,145,.12); }
    .cr-sum-ico--git { color: var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d); background: rgba(226,192,141,.12); }
    .cr-sum-ico--clock { color: var(--vscode-gitDecoration-untrackedResourceForeground, #75beff); background: rgba(117,190,255,.12); }
    .cr-sum-main { min-width: 0; flex: 1; }
    .cr-sum-muted { color: var(--vscode-descriptionForeground); font-size: 11px; display: block; margin-bottom: 2px; }
    .cr-sum-body { color: var(--vscode-foreground); font-size: 12px; line-height: 1.35; }
    #sumGitBody.cr-sum-body--anim {
      display: inline-block;
      transform-origin: left center;
      animation: cr-num-pop 0.48s cubic-bezier(0.22, 1, 0.36, 1);
    }
    @keyframes cr-num-pop {
      0% { transform: scale(1); }
      40% { transform: scale(1.045); }
      100% { transform: scale(1); }
    }
    #sumActivity.cr-sum-line--flash .cr-sum-body {
      animation: cr-activity-flash 1s ease-out;
    }
    @keyframes cr-activity-flash {
      0% {
        background-color: var(--vscode-editor-inactiveSelectionBackground, rgba(127, 127, 127, 0.22));
        border-radius: 4px;
      }
      100% { background-color: transparent; }
    }
    #sumActiveBody.cr-sum-body--anim {
      display: inline-block;
      transform-origin: left center;
      animation: cr-num-pop 0.48s cubic-bezier(0.22, 1, 0.36, 1);
    }
    ul.cr-file-list { padding: 4px 0 0; margin: 0; list-style: none; }
    li.file-row {
      cursor: pointer;
      margin: 0;
      padding: 5px 6px;
      font-size: 12px;
      color: var(--vscode-textLink-foreground);
      word-break: break-all;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      border-radius: 4px;
    }
    li.file-row:hover { background: var(--vscode-list-hoverBackground); text-decoration: none; }
    li.file-row.cr-row-enter {
      animation: cr-row-in 0.38s ease-out both;
    }
    @keyframes cr-row-in {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    li.file-row.cr-file-row--flash {
      animation: cr-file-row-flash 1s ease-out;
    }
    @keyframes cr-file-row-flash {
      0% { background-color: var(--vscode-editor-inactiveSelectionBackground, rgba(127, 127, 127, 0.28)); }
      100% { background-color: transparent; }
    }
    li.file-row .cr-file-text { text-decoration: none; }
    li.file-row:hover .cr-file-text { text-decoration: underline; }
    li.file-row .cr-file-ico { flex-shrink: 0; margin-top: 1px; color: var(--vscode-symbolIcon-fileForeground, var(--vscode-descriptionForeground)); opacity: 0.9; }
    li.muted-row {
      font-size: 12px;
      color: var(--vscode-disabledForeground);
      padding: 6px 6px;
      cursor: default;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    li.toggle-more {
      list-style: none;
      margin-top: 4px;
      padding: 4px 6px;
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
    }
    li.toggle-more:hover { text-decoration: underline; }
    details.cr-git {
      margin-top: 12px;
      border: 1px solid var(--vscode-widget-border, rgba(127,127,127,.18));
      border-radius: 8px;
      padding: 2px 8px 8px;
      background: var(--vscode-sideBarSectionHeader-background, transparent);
    }
    details.cr-git > summary {
      cursor: pointer;
      list-style: none;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-descriptionForeground));
      text-transform: uppercase;
      padding: 8px 4px;
      margin: 0 -4px;
      border-radius: 4px;
    }
    details.cr-git > summary::-webkit-details-marker { display: none; }
    details.cr-git > summary::before {
      content: '';
      width: 0; height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-top: 5px solid currentColor;
      opacity: 0.75;
      transform: rotate(-90deg);
      transition: transform 0.12s ease;
    }
    details.cr-git[open] > summary::before { transform: rotate(0deg); }
    .cr-git-sub { margin: 4px 0 8px; }
    .cr-git-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      margin: 8px 0 4px;
    }
    .cr-git-label .cr-git-ico { display: flex; opacity: 0.9; }
    .cr-notes-label {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 14px;
      margin-bottom: 6px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
    }
    .cr-notes-label .cr-sec-ico { display: flex; }
    footer.cr-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px solid var(--vscode-widget-border, rgba(127,127,127,.25));
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    .cr-local {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .cr-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--vscode-testing-iconPassed, #3fb950);
      flex-shrink: 0;
    }
    .cr-footer-gear { display: flex; color: var(--vscode-descriptionForeground); opacity: 0.85; cursor: pointer; }
    .cr-footer-gear:hover { color: var(--vscode-textLink-foreground); opacity: 1; }
    .cr-byok {
      background: var(--vscode-editor-inactiveSelectionBackground, rgba(127,127,127,.08));
      border: 1px solid var(--vscode-widget-border, rgba(127,127,127,.18));
      border-radius: 8px;
      padding: 8px 10px 10px;
    }
    .cr-byok-line { margin: 0 0 6px; font-size: 12px; line-height: 1.35; color: var(--vscode-foreground); }
    .cr-byok-muted { font-size: 11px; color: var(--vscode-descriptionForeground); }
    .cr-byok-warn {
      margin: 8px 0 0;
      padding: 6px 8px;
      font-size: 11px;
      border-radius: 6px;
      color: var(--vscode-inputValidation-warningForeground);
      background: var(--vscode-inputValidation-warningBackground);
      border: 1px solid var(--vscode-inputValidation-warningBorder, transparent);
    }
    #crByokSection { scroll-margin-top: 10px; }

    /* Phased restore (§7): hide sections without layout change; reveal uses opacity only. */
    html.cr-restore-hydrating .cr-sum-line.cr-restore-hidden,
    html.cr-restore-hydrating #crSecRecent.cr-restore-hidden,
    html.cr-restore-hydrating #crGitDetails.cr-restore-hidden,
    html.cr-restore-hydrating #crSecAiGoals.cr-restore-hidden,
    html.cr-restore-hydrating #crSecIntentGraph.cr-restore-hidden,
    html.cr-restore-hydrating #crSecProjectState.cr-restore-hidden,
    html.cr-restore-hydrating #crCortexDetails.cr-restore-hidden {
      transition: none !important;
    }
    .cr-sum-line,
    #crSecRecent,
    #crGitDetails,
    #crSecAiGoals,
    #crSecIntentGraph,
    #crSecProjectState,
    #crCortexDetails {
      transition: opacity 0.42s ease-out;
    }
    .cr-sum-line.cr-restore-hidden,
    #crSecRecent.cr-restore-hidden,
    #crGitDetails.cr-restore-hidden,
    #crSecAiGoals.cr-restore-hidden,
    #crSecIntentGraph.cr-restore-hidden,
    #crSecProjectState.cr-restore-hidden,
    #crCortexDetails.cr-restore-hidden {
      opacity: 0;
      pointer-events: none;
    }
    .cr-home { margin-top: 10px; }
    .cr-content-zone {
      margin: 12px 8px 14px;
      padding: 10px;
      border-radius: 12px;
      background: var(--vscode-input-background, rgba(255, 255, 255, 0.04));
      border: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, 0.28));
    }
    .cr-surface-stack { margin-top: 0; }
    .cr-surface-stack + .cr-surface-stack { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, 0.18)); }
    .cr-stack-label .cr-live-indicator {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      margin-left: auto;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--vscode-testing-iconPassed, #3fb950);
    }
    .cr-stack-label { justify-content: space-between; width: 100%; }
    .cr-surface-stack .cr-section { margin-top: 6px; }
    .cr-surface-stack .cr-module-card {
      background: var(--vscode-editor-background, rgba(0, 0, 0, 0.2));
      border-color: var(--vscode-widget-border, rgba(127, 127, 127, 0.32));
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }
    .cr-surface-stack .cr-module-card--activity {
      background: transparent;
      border: none;
      box-shadow: none;
      padding: 0;
      border-left: none;
    }
    .cr-home-list { list-style: none; margin: 0; padding: 0; }
    .cr-home-list li {
      font-size: 12px;
      line-height: 1.4;
      padding: 6px 0;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, 0.12));
      color: var(--vscode-foreground);
    }
    .cr-home-list li:last-child { border-bottom: none; }
    .cr-home-feed {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .cr-home-feed-block {
      padding: 10px 11px 8px;
      border-radius: 8px;
      border: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, 0.22));
    }
    .cr-home-feed-block--recent {
      background: linear-gradient(
        165deg,
        rgba(209, 134, 22, 0.12) 0%,
        var(--vscode-editor-background, rgba(0, 0, 0, 0.12)) 55%
      );
      border-left: 3px solid var(--vscode-charts-orange, #d18616);
    }
    .cr-home-feed-block--next {
      background: linear-gradient(
        165deg,
        rgba(115, 201, 145, 0.11) 0%,
        var(--vscode-editor-background, rgba(0, 0, 0, 0.12)) 55%
      );
      border-left: 3px solid var(--vscode-gitDecoration-addedResourceForeground, #73c991);
    }
    .cr-home-feed-title {
      margin: 0 0 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, 0.18));
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground));
      opacity: 0.95;
    }
    .cr-home-feed-block .cr-home-list { margin-top: 2px; }
    .cr-home-feed-block .cr-graph-muted {
      margin: 4px 0 0;
      font-size: 11px;
    }
    .cr-action-bar {
      margin-top: 4px;
      padding: 0 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: stretch;
    }
    .cr-action-bar .cr-primary {
      width: 100%;
      box-sizing: border-box;
      justify-content: center;
    }
    .cr-action-bar--ask {
      margin-top: 12px;
      margin-bottom: 6px;
    }
    .cr-action-bar--ask .cr-stack-label {
      margin-bottom: 6px;
      justify-content: flex-start;
    }
    .cr-transfer-group {
      display: flex;
      flex-direction: column;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--vscode-button-border, transparent);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.12);
    }
    .cr-ask-group {
      display: flex;
      flex-direction: column;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--vscode-button-border, transparent);
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.12);
    }
    .cr-ask-group > .cr-module-card--ask {
      border-radius: 0;
      border: none;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, 0.22));
      box-shadow: none;
      margin: 0;
    }
    .cr-transfer-group > .cr-primary {
      border-radius: 0;
      border: none;
      box-shadow: none;
    }
    .cr-fold-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 0 8px 10px;
    }
    .cr-fold-btn {
      border: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, 0.35));
      border-radius: 8px;
      background: var(--vscode-button-secondaryBackground, rgba(127, 127, 127, 0.12));
      overflow: hidden;
    }
    .cr-fold-btn--attached {
      border-radius: 0 0 8px 8px;
      border-top: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, 0.22));
      background: var(--vscode-input-background, rgba(0, 0, 0, 0.12));
      border-left: none;
      border-right: none;
      border-bottom: none;
    }
    .cr-ask-group .cr-fold-btn--attached {
      border-radius: 0 0 8px 8px;
    }
    .cr-fold-btn--attached > summary {
      flex-wrap: wrap;
      row-gap: 2px;
    }
    .cr-fold-summary-hint {
      flex: 1 1 100%;
      margin-left: 19px;
      font-size: 10px;
      font-weight: 400;
      letter-spacing: 0.01em;
      opacity: 0.62;
      color: var(--vscode-descriptionForeground);
    }
    .cr-fold-panel--llm {
      padding: 8px 10px 10px;
    }
    .cr-fold-panel--llm .cr-section { margin: 0; }
    .cr-fold-panel--llm .cr-module-card {
      border: none;
      box-shadow: none;
      background: transparent;
    }
    .cr-fold-btn > summary {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.02em;
      list-style: none;
      user-select: none;
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
    }
    .cr-fold-btn > summary::-webkit-details-marker { display: none; }
    .cr-fold-btn > summary::before {
      content: '▸';
      font-size: 11px;
      opacity: 0.75;
      transition: transform 0.15s ease;
      flex-shrink: 0;
    }
    .cr-fold-btn[open] > summary::before { transform: rotate(90deg); }
    .cr-fold-btn > summary:hover {
      background: var(--vscode-toolbar-hoverBackground, rgba(127, 127, 127, 0.14));
    }
    .cr-fold-panel {
      padding: 10px 12px 12px;
      background: var(--vscode-editor-background, rgba(0, 0, 0, 0.15));
      border-top: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, 0.2));
    }
    .cr-fold-panel .cr-more-menu {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .cr-fold-panel .cr-more-menu li {
      margin: 0;
      padding: 0;
    }
    .cr-fold-panel .cr-more-item {
      display: block;
      width: 100%;
      box-sizing: border-box;
      text-align: left;
      border: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, 0.32));
      border-radius: 6px;
      background: var(--vscode-button-secondaryBackground, rgba(127, 127, 127, 0.12));
      color: var(--vscode-foreground);
      font-size: 12px;
      font-weight: 500;
      padding: 9px 12px;
      cursor: pointer;
      font-family: inherit;
    }
    .cr-fold-panel .cr-more-item:hover {
      background: var(--vscode-button-secondaryHoverBackground, rgba(127, 127, 127, 0.2));
      border-color: var(--vscode-focusBorder, rgba(127, 127, 127, 0.5));
    }
    .cr-fold-panel .cr-more-item:disabled { opacity: 0.45; cursor: default; }
    .cr-module-card--ask {
      border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px;
      border-radius: 10px;
      background: var(--vscode-editor-inactiveSelectionBackground, rgba(127, 127, 127, 0.1));
      border: 1px solid var(--vscode-widget-border, rgba(127, 127, 127, 0.28));
      border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
    }
    .cr-ask-input {
      width: 100%;
      box-sizing: border-box;
      font-size: 12px;
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid var(--vscode-input-border, rgba(127, 127, 127, 0.35));
      background: var(--vscode-input-background, var(--cr-input-bg, #141414));
      color: inherit;
      font-family: inherit;
    }
    .cr-ask-input:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 0;
    }
    .cr-ask-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 0;
    }
    .cr-module-card--ask .cr-primary { margin-top: 0; }
    .cr-ask-hint {
      margin: 0;
      font-size: 10px;
      line-height: 1.4;
      color: var(--vscode-descriptionForeground);
      opacity: 0.72;
      letter-spacing: 0.02em;
    }
    .cr-ask-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .cr-ask-chip {
      margin: 0;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-badge-background, rgba(127,127,127,0.18));
      color: var(--vscode-badge-foreground, inherit);
      font-size: 10px;
      cursor: pointer;
    }
    .cr-ask-chip:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .cr-more-section { margin-bottom: 14px; }
    .cr-more-section:last-child { margin-bottom: 0; }
    .cr-more-section-k {
      display: block;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      opacity: 0.85;
      margin: 0 0 8px 2px;
    }
    .cr-more-workspace {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      padding: 0 2px 4px;
    }
    .cr-more-workspace .cr-action-workspace { flex: 1; min-width: 0; font-size: 11px; }
    #crDeveloperDetails .cr-stack { margin-top: 8px; }
    #crDeveloperDetails .cr-stack:first-child { margin-top: 0; }
    #crDeveloperDetails .cr-fold-panel { max-height: 60vh; overflow-y: auto; }
    .cr-boot-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 8px 8px;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-editor-inactiveSelectionBackground, rgba(127,127,127,0.12));
      border: 1px solid var(--vscode-widget-border, rgba(127,127,127,0.25));
    }
    .cr-boot-bar[hidden] { display: none !important; }
    .cr-boot-bar-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--vscode-textLink-foreground, #3794ff);
      animation: cr-boot-pulse 1s ease-in-out infinite;
    }
    @keyframes cr-boot-pulse {
      0%, 100% { opacity: 0.35; transform: scale(0.85); }
      50% { opacity: 1; transform: scale(1); }
    }
  </style>
</head>
<body>
  <div id="crBootBar" class="cr-boot-bar" aria-live="polite">
    <span class="cr-boot-bar-dot" aria-hidden="true"></span>
    <span id="crBootBarText">Loading workspace data…</span>
  </div>
  <header class="cr-header">
    <div class="cr-brand"><span class="cr-logo">C</span> CONTORIUM</div>
    <div class="cr-header-actions" aria-hidden="true">
      <span class="cr-icon-pill" title="Decorative">${ico.refresh}</span>
      <span class="cr-icon-pill" title="Decorative">${ico.more}</span>
      <span class="cr-icon-pill" title="Decorative">${ico.bell}</span>
    </div>
  </header>

  <div class="cr-content-zone" aria-label="Project summary">
  <div class="cr-stack cr-surface-stack" aria-label="Focus">
    <div class="cr-stack-label">
      <span>Current focus</span>
      <span class="cr-live-indicator" title="Updates in real time"><span class="cr-live-badge" aria-hidden="true"></span><span>Live</span></span>
    </div>
    <section class="cr-section">
      <div class="cr-module-card cr-module-card--cognition">
        <div class="cr-module-card-body">
          <textarea id="v22FocusInput" class="cr-v22-focus" rows="1" maxlength="${TASK_MAX}" placeholder="Declare project focus"></textarea>
        </div>
      </div>
    </section>
  </div>

  <div class="cr-stack cr-surface-stack" aria-label="Activity summary">
    <div class="cr-stack-label">
      <span>Recent · Next</span>
      <span class="cr-live-indicator" title="Updates in real time"><span class="cr-live-badge" aria-hidden="true"></span><span>Live</span></span>
    </div>
    <section class="cr-section">
      <div class="cr-module-card cr-module-card--activity">
        <div class="cr-module-card-body cr-home-feed">
          <div class="cr-home-feed-block cr-home-feed-block--recent">
            <h4 class="cr-home-feed-title">What happened recently</h4>
            <ul id="homeRecentList" class="cr-home-list" aria-label="Recent activity"></ul>
            <p id="homeRecentEmpty" class="cr-graph-muted">No recent activity</p>
          </div>
          <div class="cr-home-feed-block cr-home-feed-block--next">
            <h4 class="cr-home-feed-title">What should I do next</h4>
            <ul id="homeNextList" class="cr-home-list" aria-label="Next actions"></ul>
            <p id="homeNextEmpty" class="cr-graph-muted">—</p>
          </div>
        </div>
      </div>
    </section>
  </div>
  </div>

  <div class="cr-action-bar" aria-label="Transfer">
    <div class="cr-transfer-group">
      <button type="button" class="cr-primary" id="btnTransferContext" title="Transfer context snapshot into chat (~300–800 tokens)">
        <span class="cr-export-spin" aria-hidden="true">${ico.refresh}</span>
        ${ico.copy}<span id="btnTransferContextLabel">Context</span>
      </button>
      <details class="cr-fold-btn cr-fold-btn--attached" id="crTransferMore">
        <summary>More transfer modes</summary>
        <div class="cr-fold-panel">
          <ul class="cr-more-menu">
            <li><button type="button" class="cr-more-item" data-transfer="intelligence">Intelligence</button></li>
            <li><button type="button" class="cr-more-item" data-transfer="story">Story</button></li>
            <li><button type="button" class="cr-more-item" data-transfer="essence">Essence</button></li>
            <li><button type="button" class="cr-more-item" data-transfer="handoff">Handoff</button></li>
          </ul>
        </div>
      </details>
    </div>
    <div id="crExportProgress" class="cr-export-progress" hidden>
      <div class="cr-export-progress-track" aria-hidden="true">
        <div id="crExportProgressBar" class="cr-export-progress-bar"></div>
      </div>
      <p id="crExportProgressLabel" class="cr-export-progress-label" aria-live="polite"></p>
    </div>
  </div>

  <div class="cr-action-bar cr-action-bar--ask" aria-label="Ask">
    <div class="cr-stack-label"><span>Ask Contorium</span></div>
    <div class="cr-ask-group">
      <div class="cr-module-card cr-module-card--ask">
        <form id="homeAskForm" class="cr-ask-form" aria-label="Ask your project">
          <input type="text" id="homeAskInput" class="cr-ask-input" maxlength="240" placeholder="Ask your project…" aria-label="Ask your project" autocomplete="off" />
          <p class="cr-ask-hint">What happened · Why · Next · Story · Health · Review · Knowledge health · MCP · Timeline</p>
          <div class="cr-ask-chips" aria-label="Suggested questions">
            <button type="button" class="cr-ask-chip" data-ask="What needs review?">Review</button>
            <button type="button" class="cr-ask-chip" data-ask="Is the project knowledge healthy?">Knowledge health</button>
            <button type="button" class="cr-ask-chip" data-ask="Is the project healthy?">Health</button>
          </div>
          <button type="submit" class="cr-primary" id="btnHomeAsk" title="Ask about project history, decisions, or next steps">Ask</button>
        </form>
      </div>
      <details class="cr-fold-btn cr-fold-btn--attached" id="crAskLlmConfig">
        <summary>
          <span>Configure LLM</span>
          <span class="cr-fold-summary-hint">Configure LLM for better results</span>
        </summary>
        <div class="cr-fold-panel cr-fold-panel--llm">
          <section class="cr-section" id="crSecCilAi">
            <div class="cr-module-card cr-module-card--intelligence">
              <div class="cr-module-card-body cr-v22-fields">
                <div class="cr-v22-row"><span class="cr-psb-k">Status</span><p id="v22CilAiStatus" class="cr-graph-line">—</p></div>
                <div class="cr-v22-row"><span class="cr-psb-k">Provider / model</span><p id="v22CilAiProvider" class="cr-graph-line">—</p></div>
                <div class="cr-v22-row"><span class="cr-psb-k">Modules</span><p id="v22CilAiModules" class="cr-graph-muted">—</p></div>
                <div class="cr-v22-row"><span class="cr-psb-k">Intent router</span><p id="v22CilAiRouter" class="cr-graph-muted">—</p></div>
                <p id="v22CilAiWarn" class="cr-byok-warn" hidden></p>
                <div class="cr-more-workspace" style="margin-top:8px">
                  <button type="button" class="cr-action-workspace" id="btnCilAiConfigure">Configure LLM</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </details>
    </div>
  </div>

  <div class="cr-fold-group" aria-label="Advanced">
    <details class="cr-fold-btn" id="crMoreDetails">
      <summary>Explore · Capture · Workspace</summary>
      <div class="cr-fold-panel">
        <div class="cr-more-section">
          <span class="cr-more-section-k">Explore</span>
          <ul class="cr-more-menu">
            <li><button type="button" class="cr-more-item" data-action="cilHistory">History</button></li>
            <li><button type="button" class="cr-more-item" data-action="cilDecisions">Decisions</button></li>
            <li><button type="button" class="cr-more-item" data-action="cilImpact">Impact</button></li>
            <li><button type="button" class="cr-more-item" data-action="cilDna">DNA</button></li>
            <li><button type="button" class="cr-more-item" data-action="cilReplay">Replay</button></li>
            <li><button type="button" class="cr-more-item" data-action="cilHealth">Health</button></li>
            <li><button type="button" class="cr-more-item" data-action="cilReview">Review Queue</button></li>
            <li><button type="button" class="cr-more-item" data-action="cilLifecycle">Knowledge Health</button></li>
            <li><button type="button" class="cr-more-item" data-action="cilLifecycleOwner">Set Owner</button></li>
            <li><button type="button" class="cr-more-item" data-action="cilLifecycleVerify">Verify Decision</button></li>
          </ul>
        </div>
        <div class="cr-more-section">
          <span class="cr-more-section-k">Capture</span>
          <div class="cr-v22-row cr-capture-row">
            <input type="text" id="v22CaptureNote" class="cr-v22-capture-input" maxlength="240" placeholder="Project note" aria-label="Project note" />
            <button type="button" class="cr-action-workspace" id="btnCaptureNote">Note</button>
          </div>
          <div class="cr-v22-row cr-capture-row">
            <input type="text" id="v22CaptureDecision" class="cr-v22-capture-input" maxlength="240" placeholder="Decision" aria-label="Decision" />
            <button type="button" class="cr-action-workspace" id="btnCaptureDecision">Decision</button>
          </div>
        </div>
        <div class="cr-more-section">
          <span class="cr-more-section-k">Workspace</span>
          <div class="cr-more-workspace">
            <button type="button" class="cr-action-workspace" id="btnSave">${ico.save}<span>Sync</span></button>
            <button type="button" class="cr-action-workspace" id="btnRestore">${ico.history}<span>Restore</span></button>
          </div>
        </div>
      </div>
    </details>

    <details class="cr-fold-btn" id="crDeveloperDetails" aria-label="Developer">
      <summary>Developer</summary>
      <div class="cr-fold-panel">
  <div class="cr-stack" aria-label="Cognition field">
    <div class="cr-stack-label"><span>Cognition field</span><span class="cr-live-badge" title="Live updates" aria-label="Live"></span></div>
    <section class="cr-section" id="crSecCognitionField" aria-label="Derived cognition">
      <div class="cr-module-card cr-module-card--cognition">
        <div class="cr-module-card-body cr-v22-fields">
          <div class="cr-v22-row"><span class="cr-psb-k">Intent</span><p id="v22Intent" class="cr-graph-line">—</p></div>
          <div class="cr-v22-row"><span class="cr-psb-k">State</span><p id="v22State" class="cr-graph-line">—</p></div>
          <div class="cr-v22-row"><span class="cr-psb-k">Understanding</span><p id="v22Understanding" class="cr-graph-muted">—</p></div>
          <div class="cr-v22-row"><span class="cr-psb-k">Confidence</span><p id="v22Confidence" class="cr-graph-meta">—</p></div>
        </div>
      </div>
    </section>
  </div>

  <div class="cr-stack" aria-label="Intelligence core">
    <div class="cr-stack-label"><span>Intelligence core</span><span class="cr-live-badge" title="Live updates" aria-label="Live"></span></div>
    <section class="cr-section" id="crSecIntelligenceCore">
      <div class="cr-module-card cr-module-card--intelligence">
      <div class="cr-module-card-head">
          <span class="cr-sec-left"><span class="cr-sec-ico">${ico.spark}</span><span>PIL metrics</span></span>
          <span class="cr-graph-meta" id="v22HealthMeta">—</span>
      </div>
        <div class="cr-module-card-body cr-v22-fields">
          <div class="cr-v22-row"><span class="cr-psb-k">Health score</span><p id="v22HealthScore" class="cr-graph-line">—</p></div>
          <div class="cr-v22-row"><span class="cr-psb-k">Knowledge health</span><p id="v22KnowledgeHealth" class="cr-graph-line">—</p></div>
          <div class="cr-v22-row"><span class="cr-psb-k">Review queue</span><p id="v22ReviewQueue" class="cr-graph-line">—</p></div>
          <div class="cr-v22-row"><span class="cr-psb-k">Knowledge coverage</span><p id="v22Coverage" class="cr-graph-line">—</p></div>
          <div class="cr-v22-row"><span class="cr-psb-k">Confidence index</span><p id="v22ConfIndex" class="cr-graph-line">—</p></div>
          <div class="cr-v22-row"><span class="cr-psb-k">Timeline summary</span><p id="v22Timeline" class="cr-graph-muted">—</p></div>
          <div class="cr-v22-row"><span class="cr-psb-k">Impact radius</span><p id="v22ImpactRadius" class="cr-graph-muted">—</p></div>
    </div>
    </div>
  </section>
  </div>

  <div class="cr-stack" aria-label="Decision intelligence">
    <div class="cr-stack-label"><span>Decision intelligence</span></div>
    <section class="cr-section" id="crSecDecisionIntel">
      <div class="cr-module-card cr-module-card--decision">
        <div class="cr-module-card-body cr-v22-fields">
          <div class="cr-v22-row"><span class="cr-psb-k">Decision snapshot</span><p id="v22DecSnapshot" class="cr-graph-line">—</p></div>
          <div class="cr-v22-row"><span class="cr-psb-k">Decision graph</span><p id="v22DecGraph" class="cr-graph-muted">—</p></div>
          <div class="cr-v22-row"><span class="cr-psb-k">Decision links</span><ul id="v22DecLinks" class="cr-psb-list"></ul></div>
          <div class="cr-v22-row"><span class="cr-psb-k">Decision history</span><ul id="v22DecHistory" class="cr-psb-list"></ul></div>
      </div>
    </div>
  </section>
      </div>

  <details class="cr-stack cr-stack-fold cr-cortex" id="crCortexDetails" aria-label="Cortex graphs">
    <summary class="cr-cortex-summary">Cortex graphs</summary>
    <div class="cr-cortex-body cr-module-card cr-module-card--graph cr-v22-fields">
      <div class="cr-v22-row"><span class="cr-psb-k">Intent graph</span><p id="v22GIntent" class="cr-graph-line">—</p></div>
      <div class="cr-v22-row"><span class="cr-psb-k">Structure graph</span><p id="v22GStructure" class="cr-graph-line">—</p></div>
      <div class="cr-v22-row"><span class="cr-psb-k">Impact overlay</span><p id="v22GImpact" class="cr-graph-line">—</p></div>
      <div class="cr-v22-row"><span class="cr-psb-k">Evolution timeline</span><p id="v22GEvolution" class="cr-graph-muted">—</p></div>
      <div class="cr-v22-row"><span class="cr-psb-k">Hotspots</span><div id="v22GHotspots" class="cr-graph-domains"></div></div>
      </div>
  </details>

  <div class="cr-stack" aria-label="Activity trace">
    <div class="cr-stack-label"><span>Activity trace</span><span class="cr-live-badge" title="Live updates" aria-label="Live"></span></div>
    <section class="cr-section">
      <div class="cr-module-card cr-module-card--activity">
        <ul id="v22ActivityList" class="cr-activity-feed" aria-label="Raw workspace events"></ul>
        <p id="v22ActivityEmpty" class="cr-graph-muted">No recent events</p>
    </div>
  </section>
      </div>

  <details class="cr-stack cr-stack-fold cr-stack-fold--structure" id="crSecStructureField" aria-label="Structure field">
    <summary class="cr-stack-label" style="cursor:pointer;border-bottom:none;margin-bottom:0;padding-bottom:0"><span>Structure field</span></summary>
    <div class="cr-stack-fold-body cr-module-card cr-module-card--structure cr-v22-fields">
      <div class="cr-v22-row"><span class="cr-psb-k">State builder</span><p id="v22StructBuilder" class="cr-graph-line">—</p></div>
      <div class="cr-v22-row"><span class="cr-psb-k">Module map</span><div id="v22StructModules" class="cr-graph-domains"></div></div>
      <div class="cr-v22-row"><span class="cr-psb-k">Open problems</span><ul id="v22StructProblems" class="cr-psb-list cr-psb-list--warn"></ul></div>
      <div class="cr-v22-row"><span class="cr-psb-k">Linked decisions</span><ul id="v22StructDecisions" class="cr-psb-list"></ul></div>
      <div class="cr-v22-row"><span class="cr-psb-k">Next cognition</span><p id="v22StructNext" class="cr-graph-line">—</p></div>
      </div>
  </details>

  <div class="cr-stack" aria-label="Context export">
    <div class="cr-stack-label"><span>Context export</span><span class="cr-live-badge" title="Live updates" aria-label="Live"></span></div>
    <section class="cr-section" id="crSecContextExport">
      <div class="cr-module-card cr-module-card--export">
        <div class="cr-module-card-body cr-v22-fields">
          <div class="cr-v22-row"><span class="cr-psb-k">MCP snapshot</span><p id="v22McpHint" class="cr-graph-muted">—</p></div>
          <div class="cr-v22-row"><span class="cr-psb-k">Token estimate</span><p id="v22TokenEst" class="cr-graph-meta">—</p></div>
          <div class="cr-v22-row"><span class="cr-psb-k">Payload preview</span><p id="v22InjectPreview" class="cr-gov-inject-preview">—</p></div>
      </div>
      </div>
      <p class="cr-graph-muted" style="margin-top:6px;font-size:11px" id="aiStatUpdated">—</p>
  </section>
  </div>
      </div>
    </details>
  </div>

  <textarea id="task" hidden aria-hidden="true"></textarea>
  <span id="taskCount" hidden aria-hidden="true">0</span>

  <div id="crOverlay" class="cr-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="crOverlayTitle">
    <div class="cr-overlay-backdrop" id="crOverlayBackdrop"></div>
    <div class="cr-overlay-panel">
      <div class="cr-overlay-head">
        <h2 id="crOverlayTitle">—</h2>
        <button type="button" class="cr-overlay-close" id="crOverlayClose" aria-label="Close">×</button>
    </div>
      <div id="crOverlayBody"></div>
      <div class="cr-overlay-foot">
        <button type="button" class="cr-primary" id="crOverlayContinue">Continue</button>
      </div>
      </div>
    </div>

  <div id="sumActivity" hidden aria-hidden="true"></div>
  <span id="aiStatModel" hidden aria-hidden="true"></span>
  <span id="aiStatRuntime" hidden aria-hidden="true"></span>
  <span id="aiStatMode" hidden aria-hidden="true"></span>
  <span id="aiStatTierBadge" hidden aria-hidden="true"></span>
  <button type="button" id="btnJumpByok" hidden aria-hidden="true"></button>

  <div id="crSecAiGoals" hidden aria-hidden="true">
    <ul id="aiIntentGoals"></ul>
    <button type="button" id="btnViewRules" hidden></button>
    <button type="button" id="btnReviewChange" hidden></button>
    <select id="govReviewScope" hidden></select>
    <ul id="recent"></ul>
    <ul id="gitStaged"></ul>
    <ul id="gitWorking"></ul>
    <ul id="activityStreamList"></ul>
    <p id="sumActivityBody"></p>
    <span id="aiStatCtx"></span>
    <span id="aiContextTokens"></span>
    <p id="byokRuntime"></p><p id="byokProvider"></p><p id="byokKeys"></p><p id="byokModel"></p><p id="byokExport"></p><p id="byokWarn" hidden></p>
    <button type="button" id="btnByokKey" hidden></button>
    <button type="button" id="btnByokSettings" hidden></button>
    <button type="button" id="btnAiSemantic" hidden></button>
    <button type="button" id="btnAiIntent" hidden></button>
    <button type="button" id="btnAiCompress" hidden></button>
    </div>
  <p id="handoffIntent" hidden aria-hidden="true"></p>

  <label class="cr-notes-label" for="notes"><span class="cr-sec-ico">${ico.note}</span> Context notes</label>
  <textarea id="notes" rows="3" placeholder="Notes for export — kept locally in workspace state."></textarea>

  <footer class="cr-footer">
    <span id="crVersion">${PRODUCT_DISPLAY_NAME}</span>
    <span class="cr-local">
      <span class="cr-dot" title="Session data stays on this machine"></span> Local data only
      <span class="cr-footer-gear" id="btnFooterSettings" role="button" tabindex="0" title="Open ${PRODUCT_DISPLAY_NAME} settings">${ico.gear}</span>
    </span>
  </footer>

  <template id="tpl-file-ico">${ico.file}</template>

  <script nonce="__NONCE__">
    (function () {
    try {
    const vscode = acquireVsCodeApi();
    const TASK_MAX = ${TASK_MAX};
    const taskEl = document.getElementById('task');
    const v22FocusEl = document.getElementById('v22FocusInput');
    const notesEl = document.getElementById('notes');
    const taskCountEl = document.getElementById('taskCount');
    const recentEl = document.getElementById('recent');
    const gitStagedEl = document.getElementById('gitStaged');
    const gitWorkingEl = document.getElementById('gitWorking');
    const sumActiveBody = document.getElementById('sumActiveBody');
    const sumGitBody = document.getElementById('sumGitBody');
    const sumActivityBody = document.getElementById('sumActivityBody');
    const sumActivityLine = document.getElementById('sumActivity');
    const activityStreamListEl = document.getElementById('activityStreamList');
    const crVersion = document.getElementById('crVersion');
    const byokRuntime = document.getElementById('byokRuntime');
    const byokProvider = document.getElementById('byokProvider');
    const byokKeys = document.getElementById('byokKeys');
    const byokModel = document.getElementById('byokModel');
    const byokExport = document.getElementById('byokExport');
    const byokWarn = document.getElementById('byokWarn');
    const aiIntentGoalsEl = document.getElementById('aiIntentGoals');
    const aiIntentEmptyEl = document.getElementById('aiIntentEmpty');
    const aiIntentGoalsToggle = document.getElementById('aiIntentGoalsToggle');
    const LIST_PREVIEW = 5;
    let aiGoalsExpanded = false;
    const aiStatModel = document.getElementById('aiStatModel');
    const aiStatRuntime = document.getElementById('aiStatRuntime');
    const aiStatMode = document.getElementById('aiStatMode');
    const aiStatUpdated = document.getElementById('aiStatUpdated');
    const aiStatCtx = document.getElementById('aiStatCtx');
    const aiStatTierBadge = document.getElementById('aiStatTierBadge');
    const aiTrackStatus = document.getElementById('aiTrackStatus');
    const todayProjectGoalEl = document.getElementById('todayProjectGoal');
    const todayDirectionUpdatedEl = document.getElementById('todayDirectionUpdated');
    const todayStageEl = document.getElementById('todayStage');
    const todayNextEl = document.getElementById('todayNext');
    const todayNextBlock = document.getElementById('todayNextBlock');
    const govActiveLabel = document.getElementById('govActiveLabel');
    const govConstLine = document.getElementById('govConstLine');
    const govTruthLine = document.getElementById('govTruthLine');
    const govIdentityLine = document.getElementById('govIdentityLine');
    const govProtectedCount = document.getElementById('govProtectedCount');
    const govForbiddenCount = document.getElementById('govForbiddenCount');
    const govReviewFile = document.getElementById('govReviewFile');
    const govReviewRisk = document.getElementById('govReviewRisk');
    const govReviewChange = document.getElementById('govReviewChange');
    const govReviewSeverity = document.getElementById('govReviewSeverity');
    const govReviewImpact = document.getElementById('govReviewImpact');
    const govReviewConfidence = document.getElementById('govReviewConfidence');
    const govReviewProtected = document.getElementById('govReviewProtected');
    const govReviewTruth = document.getElementById('govReviewTruth');
    const govReviewRecommendation = document.getElementById('govReviewRecommendation');
    const govReviewSource = document.getElementById('govReviewSource');
    const govReviewTimestamp = document.getElementById('govReviewTimestamp');
    const govReviewScope = document.getElementById('govReviewScope');
    const govReviewWhy = document.getElementById('govReviewWhy');
    const govInjectPreview = document.getElementById('govInjectPreview');
    const govInjectionRules = document.getElementById('govInjectionRules');
    const govTokenEstimate = document.getElementById('govTokenEstimate');
    const aiContextTokensEl = document.getElementById('aiContextTokens');
    const crOverlay = document.getElementById('crOverlay');
    const crOverlayTitle = document.getElementById('crOverlayTitle');
    const crOverlayBody = document.getElementById('crOverlayBody');
    const crOverlayClose = document.getElementById('crOverlayClose');
    const crOverlayBackdrop = document.getElementById('crOverlayBackdrop');
    const crOverlayContinue = document.getElementById('crOverlayContinue');
    const graphMetaEl = document.getElementById('graphMeta');
    const graphUnderstandingEl = document.getElementById('graphUnderstanding');
    const graphProblemEl = document.getElementById('graphProblem');
    const graphDomainsEl = document.getElementById('graphDomains');
    const graphIntentListEl = document.getElementById('graphIntentList');
    const graphEmptyEl = document.getElementById('graphEmpty');
    const psbMetaEl = document.getElementById('psbMeta');
    const psbGoalEl = document.getElementById('psbGoal');
    const psbStageEl = document.getElementById('psbStage');
    const psbModulesEl = document.getElementById('psbModules');
    const psbDecisionsBlock = document.getElementById('psbDecisionsBlock');
    const psbDecisionsEl = document.getElementById('psbDecisions');
    const psbProblemsBlock = document.getElementById('psbProblemsBlock');
    const psbProblemsEl = document.getElementById('psbProblems');
    const psbNextBlock = document.getElementById('psbNextBlock');
    const psbNextEl = document.getElementById('psbNext');
    const psbEmptyEl = document.getElementById('psbEmpty');
    const handoffMetaEl = document.getElementById('handoffMeta');
    const handoffSummaryEl = document.getElementById('handoffSummary');
    const handoffIntentEl = document.getElementById('handoffIntent');
    const handoffEmptyEl = document.getElementById('handoffEmpty');
    const uImpactBlock = document.getElementById('uImpactBlock');
    const uImpactModules = document.getElementById('uImpactModules');
    const uTimelineDetails = document.getElementById('uTimelineDetails');
    const uTimelineList = document.getElementById('uTimelineList');
    const pilHealthMetaEl = document.getElementById('pilHealthMeta');
    const pilHealthLineEl = document.getElementById('pilHealthLine');
    const pilCoverageLineEl = document.getElementById('pilCoverageLine');
    const fnGraphMetaEl = document.getElementById('fnGraphMeta');
    const fnGraphTreesEl = document.getElementById('fnGraphTrees');
    const fnFileFlowsEl = document.getElementById('fnFileFlows');
    const fnGraphEmptyEl = document.getElementById('fnGraphEmpty');
    const fnImpactListEl = document.getElementById('fnImpactList');
    const fnDepImpactSec = document.getElementById('crSecDepImpact');
    const kgMetaEl = document.getElementById('kgMeta');
    const kgIntentTreesEl = document.getElementById('kgIntentTrees');
    const kgEmptyEl = document.getElementById('kgEmpty');
    const kgImpactDetailEl = document.getElementById('kgImpactDetail');
    const kgHotspotsSec = document.getElementById('crSecHotspots');
    const kgHotspotsMetaEl = document.getElementById('kgHotspotsMeta');
    const kgHotspotsListEl = document.getElementById('kgHotspotsList');
    const kgHotspotsEmptyEl = document.getElementById('kgHotspotsEmpty');
    const reasonTraceSec = document.getElementById('crSecReasonTrace');
    const reasonTraceListEl = document.getElementById('reasonTraceList');
    const reasonTraceEmptyEl = document.getElementById('reasonTraceEmpty');
    const confSecEl = document.getElementById('crSecConflicts');
    const confMetaEl = document.getElementById('confMeta');
    const confListEl = document.getElementById('confList');
    let lastTrackFingerprint = '';
    let lastActivityStreamHead = '';
    let trackStatusTimer = null;
    const _tplIco = document.getElementById('tpl-file-ico');
    const fileIcoHtml = _tplIco ? _tplIco.innerHTML : '';

    function escapeHtml(t) {
      return String(t)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    let debounce;
    function debouncePost(type, value) {
      clearTimeout(debounce);
      debounce = setTimeout(() => vscode.postMessage({ type, value }), 400);
    }

    function paintTaskMeta() {
      const src = v22FocusEl || taskEl;
      if (!src || !taskCountEl) return;
      const n = src.value.length;
      taskCountEl.textContent = n + ' / ' + TASK_MAX;
    }

    function bindFocusInput(el) {
      if (!el) return;
      function syncFocusRows() {
        if (document.activeElement === el) {
          el.rows = 3;
          el.classList.add('cr-v22-focus--active');
        } else {
          el.classList.remove('cr-v22-focus--active');
          const lineCount = el.value.split('\\n').length;
          el.rows = Math.max(1, Math.min(2, lineCount || 1));
        }
      }
      el.addEventListener('focus', syncFocusRows);
      el.addEventListener('blur', syncFocusRows);
      el.addEventListener('input', () => {
      paintTaskMeta();
        debouncePost('updateTask', el.value);
        if (taskEl && taskEl !== el) taskEl.value = el.value;
        if (document.activeElement !== el) syncFocusRows();
    });
      syncFocusRows();
    }
    bindFocusInput(v22FocusEl);
    bindFocusInput(taskEl);
    notesEl.addEventListener('input', () => debouncePost('updateNotes', notesEl.value));

    let exportBusy = false;
    let exportResetTimer = null;
    const btnTransferContext = document.getElementById('btnTransferContext');
    const btnTransferContextLabel = document.getElementById('btnTransferContextLabel');
    const btnSave = document.getElementById('btnSave');
    const btnRestore = document.getElementById('btnRestore');
    const crExportProgress = document.getElementById('crExportProgress');
    const crExportProgressBar = document.getElementById('crExportProgressBar');
    const crExportProgressLabel = document.getElementById('crExportProgressLabel');
    const exportLabelSnapshot = 'Context';

    function setExportBusy(busy) {
      exportBusy = busy;
      if (btnTransferContext) btnTransferContext.classList.toggle('cr-primary--busy', busy);
      if (btnSave) btnSave.disabled = busy;
      if (btnRestore) btnRestore.disabled = busy;
      document.querySelectorAll('[data-transfer]').forEach(function (el) {
        el.disabled = busy;
      });
    }

    function startExport(mode) {
      if (exportBusy) return;
      updateExportProgress({ phase: 'sync', label: 'Starting export…', percent: 2 });
      vscode.postMessage({ type: 'exportAIContext', mode: mode });
    }

    function updateExportProgress(msg) {
      if (!msg) return;
      const phase = msg.phase || 'sync';
      const label = msg.label || 'Working…';
      const percent = typeof msg.percent === 'number' ? msg.percent : 0;

      if (phase === 'done' || phase === 'error') {
        setExportBusy(false);
        if (crExportProgress) crExportProgress.hidden = false;
        if (crExportProgressBar) {
          crExportProgressBar.style.width = phase === 'done' ? '100%' : '0%';
        }
        if (crExportProgressLabel) {
          crExportProgressLabel.textContent = label;
          crExportProgressLabel.className =
            'cr-export-progress-label' +
            (phase === 'done' ? ' cr-export-progress-label--done' : ' cr-export-progress-label--error');
        }
        if (btnTransferContextLabel) btnTransferContextLabel.textContent = exportLabelSnapshot;
        if (exportResetTimer) clearTimeout(exportResetTimer);
        exportResetTimer = setTimeout(function () {
          if (crExportProgress) crExportProgress.hidden = true;
          if (crExportProgressLabel) crExportProgressLabel.className = 'cr-export-progress-label';
          exportResetTimer = null;
        }, phase === 'done' ? 2400 : 4200);
        return;
      }

      if (crExportProgress) crExportProgress.hidden = false;
      if (crExportProgressBar) {
        crExportProgressBar.style.width = Math.max(4, Math.min(100, percent)) + '%';
      }
      if (crExportProgressLabel) {
        crExportProgressLabel.textContent = label;
        crExportProgressLabel.className = 'cr-export-progress-label';
      }
      if (btnTransferContextLabel) btnTransferContextLabel.textContent = label;
      setExportBusy(true);
    }

    if (btnTransferContext) {
      btnTransferContext.addEventListener('click', () => startExport('cognitive-snapshot'));
    }
    if (btnSave) {
      btnSave.addEventListener('click', () => vscode.postMessage({ type: 'saveStateNow' }));
    }
    if (btnRestore) {
      btnRestore.addEventListener('click', () => vscode.postMessage({ type: 'restoreSession' }));
    }
    const btnCaptureNote = document.getElementById('btnCaptureNote');
    const btnCaptureDecision = document.getElementById('btnCaptureDecision');
    const v22CaptureNote = document.getElementById('v22CaptureNote');
    const v22CaptureDecision = document.getElementById('v22CaptureDecision');
    if (btnCaptureNote && v22CaptureNote) {
      btnCaptureNote.addEventListener('click', () => {
        const value = v22CaptureNote.value.trim();
        if (!value) return;
        vscode.postMessage({ type: 'captureNote', value });
        v22CaptureNote.value = '';
      });
    }
    if (btnCaptureDecision && v22CaptureDecision) {
      btnCaptureDecision.addEventListener('click', () => {
        const selected = v22CaptureDecision.value.trim();
        if (!selected) return;
        vscode.postMessage({ type: 'captureDecision', selected });
        v22CaptureDecision.value = '';
      });
    }
    const btnHomeAsk = document.getElementById('btnHomeAsk');
    const homeAskForm = document.getElementById('homeAskForm');
    const homeAskInput = document.getElementById('homeAskInput');
    function submitHomeAsk() {
      const q = homeAskInput && homeAskInput.value ? homeAskInput.value.trim() : '';
      if (q) {
        vscode.postMessage({ type: 'askHome', query: q });
        if (homeAskInput) {
          homeAskInput.value = '';
        }
      } else {
        vscode.postMessage({ type: 'askHome' });
      }
    }
    if (homeAskForm) {
      homeAskForm.addEventListener('submit', function (e) {
        e.preventDefault();
        submitHomeAsk();
      });
    } else if (btnHomeAsk) {
      btnHomeAsk.addEventListener('click', submitHomeAsk);
    }
    if (homeAskInput) {
      homeAskInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.isComposing && !e.shiftKey) {
          e.preventDefault();
          submitHomeAsk();
        }
      });
    }
    document.querySelectorAll('[data-ask]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const q = btn.getAttribute('data-ask');
        if (!q) return;
        if (homeAskInput) homeAskInput.value = q;
        vscode.postMessage({ type: 'askHome', query: q });
      });
    });
    document.querySelectorAll('[data-transfer]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const mode = btn.getAttribute('data-transfer');
        if (!mode || exportBusy) return;
        if (mode === 'intelligence') {
          updateExportProgress({ phase: 'sync', label: 'Starting export…', percent: 2 });
          vscode.postMessage({ type: 'exportAIContext', mode: 'full-intelligence' });
          return;
        }
        vscode.postMessage({ type: 'transferProject', mode: mode });
      });
    });
    document.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const action = btn.getAttribute('data-action');
        if (action) vscode.postMessage({ type: action });
      });
    });
    if (govReviewScope) {
      govReviewScope.addEventListener('change', () => {
        vscode.postMessage({ type: 'setReviewScope', value: govReviewScope.value || 'auto' });
      });
    }
    const btnJumpByok = document.getElementById('btnJumpByok');
    if (btnJumpByok) {
      btnJumpByok.addEventListener('click', () => {
        const el = document.getElementById('crByokSection');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }

    if (aiIntentGoalsToggle) {
      aiIntentGoalsToggle.addEventListener('click', function () {
        aiGoalsExpanded = !aiGoalsExpanded;
        if (lastState) {
          paintAiIntentPanel(lastState.aiIntent || null, lastState.activityObservedGoals || []);
        } else {
          paintAiIntentPanel(null, []);
        }
      });
    }

    const expandState = { recent: false, staged: false, working: false, activityStream: false };
    let lastState = null;
    let lastRecentTop = '';
    let lastSumGit = '';
    let lastSumActive = '';
    let lastSumActivity = '';

    function jsonEq(a, b) {
      return JSON.stringify(a) === JSON.stringify(b);
    }

    function syncTaskNotesFromState(s) {
      if (!s) return;
      const incomingTask = s.currentTask || '';
      const incomingNotes = s.notes || '';
      const focusEl = v22FocusEl || taskEl;
      const taskFocused = document.activeElement === focusEl || document.activeElement === taskEl;
      const notesFocused = document.activeElement === notesEl;
      const taskPending = typeof debounce !== 'undefined' && debounce;
      if (!taskFocused && !taskPending && focusEl && focusEl.value !== incomingTask) {
        focusEl.value = incomingTask;
        if (taskEl && taskEl !== focusEl) taskEl.value = incomingTask;
        paintTaskMeta();
      }
      if (!notesFocused && notesEl && notesEl.value !== incomingNotes) {
        notesEl.value = incomingNotes;
      }
    }

    function ellipsizePathMiddle(str, maxLen) {
      const s = (str == null ? '' : String(str)).trim();
      if (!s) return '—';
      const limit = maxLen || 52;
      if (s.length <= limit) return s;
      const pathSep = s.indexOf('/') >= 0 ? '/' : s.indexOf('\\\\') >= 0 ? '\\\\' : null;
      if (pathSep) {
        const parts = s.split(pathSep);
        if (parts.length >= 3) {
          const head = parts[0] + pathSep;
          const tail = pathSep + parts.slice(-2).join(pathSep);
          let combined = head + '…' + tail;
          if (combined.length > limit) {
            combined = head + '…' + parts[parts.length - 1];
          }
          if (combined.length <= limit) return combined;
        }
      }
      const keep = Math.max(1, Math.floor((limit - 1) / 2));
      return s.slice(0, keep) + '…' + s.slice(s.length - (limit - 1 - keep));
    }

    function formatDisplayText(text, opts) {
      const raw = text == null || text === '' ? '—' : String(text);
      if (raw === '—') return raw;
      if (opts && opts.ellipsize) {
        return ellipsizePathMiddle(raw, (opts && opts.maxLen) || 52);
      }
      return raw;
    }

    function flashEl(el) {
      if (!el) return;
      el.classList.remove('cr-val-flash');
      void el.offsetWidth;
      el.classList.add('cr-val-flash');
    }

    function setTextIfChanged(id, text, opts) {
      const el = document.getElementById(id);
      if (!el) return;
      const raw = text == null || text === '' ? '—' : String(text);
      const next = formatDisplayText(raw, opts || { ellipsize: true });
      const prevRaw = el.getAttribute('data-raw') || '';
      if (prevRaw === raw) return;
      const hadValue = prevRaw && prevRaw !== '—';
      el.setAttribute('data-raw', raw);
      el.textContent = next;
      el.title = raw.length > next.length ? raw : '';
      if (hadValue && opts && opts.flash !== false) flashEl(el);
    }

    function fillV22List(el, items, opts) {
      if (!el) return;
      const list = items || [];
      const key = JSON.stringify(list);
      if (el.getAttribute('data-v22-key') === key) return;
      el.setAttribute('data-v22-key', key);
      const fmt = function (t) {
        return formatDisplayText(t, { ellipsize: true, maxLen: (opts && opts.maxLen) || 52 });
      };
      if (!list.length) {
        if (el.children.length === 1 && el.children[0].classList.contains('cr-graph-muted')) {
          return;
        }
        el.innerHTML = '';
        const li = document.createElement('li');
        li.className = 'cr-graph-muted';
        li.textContent = '—';
        el.appendChild(li);
        return;
      }
      while (el.children.length > list.length) {
        el.removeChild(el.lastChild);
      }
      while (el.children.length < list.length) {
        el.appendChild(document.createElement('li'));
      }
      for (let i = 0; i < list.length; i++) {
        const li = el.children[i];
        const raw = list[i];
        const next = fmt(raw);
        const prevRaw = li.getAttribute('data-raw') || '';
        if (prevRaw === raw) continue;
        const hadValue = prevRaw && prevRaw !== '—';
        li.setAttribute('data-raw', raw);
        li.textContent = next;
        li.title = raw.length > next.length ? raw : '';
        if (hadValue) flashEl(li);
      }
    }

    function fillV22Domains(el, items) {
      if (!el) return;
      const list = items || [];
      const key = JSON.stringify(list);
      if (el.getAttribute('data-v22-key') === key) return;
      el.setAttribute('data-v22-key', key);
      if (!list.length) {
        if (el.textContent === '—' && !el.children.length) return;
        el.innerHTML = '';
        el.textContent = '—';
        return;
      }
      while (el.children.length > list.length) {
        el.removeChild(el.lastChild);
      }
      while (el.children.length < list.length) {
        const span = document.createElement('span');
        span.className = 'cr-graph-domain';
        el.appendChild(span);
      }
      for (let i = 0; i < list.length; i++) {
        const span = el.children[i];
        const raw = list[i];
        const next = formatDisplayText(raw, { ellipsize: true, maxLen: 36 });
        const prevRaw = span.getAttribute('data-raw') || '';
        if (prevRaw === raw) continue;
        const hadValue = prevRaw && prevRaw !== '—';
        span.setAttribute('data-raw', raw);
        span.textContent = next;
        span.title = raw.length > next.length ? raw : '';
        if (hadValue) flashEl(span);
      }
    }

    function paintV22ActivityDelta(act) {
      const actList = document.getElementById('v22ActivityList');
      const actEmpty = document.getElementById('v22ActivityEmpty');
      const lines = (act && act.lines) || [];
      if (!actList) return;
      const key = JSON.stringify(lines);
      if (actList.getAttribute('data-v22-key') === key) {
        if (actEmpty) actEmpty.hidden = lines.length > 0;
        return;
      }
      actList.setAttribute('data-v22-key', key);
      if (actEmpty) actEmpty.hidden = lines.length > 0;
      while (actList.children.length > lines.length) {
        actList.removeChild(actList.lastChild);
      }
      for (let i = actList.children.length; i < lines.length; i++) {
        const li = document.createElement('li');
        li.className = 'cr-activity-feed-row cr-activity-feed-enter';
        actList.appendChild(li);
      }
      for (let i = 0; i < lines.length; i++) {
        const li = actList.children[i];
        const raw = lines[i];
        const next = formatDisplayText(raw, { ellipsize: true, maxLen: 56 });
        const prevRaw = li.getAttribute('data-raw') || '';
        if (prevRaw === raw) continue;
        const hadValue = prevRaw && prevRaw !== '—';
        li.setAttribute('data-raw', raw);
        li.textContent = next;
        li.title = raw.length > next.length ? raw : '';
        if (hadValue) {
          li.classList.add('cr-activity-feed-row--flash');
          flashEl(li);
        }
      }
    }

    function paintHomeLayer(s, v22View) {
      const recentList = document.getElementById('homeRecentList');
      const recentEmpty = document.getElementById('homeRecentEmpty');
      const nextList = document.getElementById('homeNextList');
      const nextEmpty = document.getElementById('homeNextEmpty');
      const view = v22View || null;
      const fileStream = (s && s.projectFileActivityItems) || [];
      const recentItems = fileStream.slice(0, 5);
      if (recentList) {
        recentList.hidden = recentItems.length === 0;
        recentList.innerHTML = recentItems
          .map(function (line) {
            return '<li>' + escapeHtml(formatDisplayText(line, { ellipsize: true, maxLen: 72 })) + '</li>';
          })
          .join('');
      }
      if (recentEmpty) recentEmpty.hidden = recentItems.length > 0;
      const projectNext = (s && s.projectState && s.projectState.nextActions) || [];
      const handoffNext =
        (s && s.understandingPanel && s.understandingPanel.handoff && s.understandingPanel.handoff.nextActions) || [];
      const structNext =
        view && view.structure && view.structure.nextCognition && view.structure.nextCognition !== '—'
          ? view.structure.nextCognition
          : '';
      const nextItems = projectNext.length
        ? projectNext.slice(0, 4)
        : handoffNext.length
          ? handoffNext.slice(0, 4)
          : structNext
            ? [structNext]
            : [];
      if (nextList) {
        nextList.hidden = nextItems.length === 0;
        nextList.innerHTML = nextItems
          .map(function (line) {
            return '<li>' + escapeHtml(formatDisplayText(line, { ellipsize: true, maxLen: 72 })) + '</li>';
          })
          .join('');
      }
      if (nextEmpty) nextEmpty.hidden = nextItems.length > 0;
    }

    function paintV22Delta(prev, next) {
      const view = next || null;
      if (!view) return;
      const c = view.cognition || {};
      const intel = view.intelligence || {};
      const dec = view.decision || {};
      const graph = view.graph || {};
      const struct = view.structure || {};
      const exp = view.exportLayer || {};

      setTextIfChanged('v22Intent', c.intent);
      setTextIfChanged('v22State', c.state);
      setTextIfChanged('v22Understanding', c.understanding);
      setTextIfChanged('v22Confidence', c.confidence);

      setTextIfChanged('v22HealthMeta', intel.healthCategory || '—', { ellipsize: false, flash: false });
      setTextIfChanged(
        'v22HealthScore',
        intel.healthScore != null ? Math.round(intel.healthScore * 100) + '% · ' + (intel.healthCategory || '') : 'Run sync to derive',
        { ellipsize: false },
      );
      setTextIfChanged(
        'v22KnowledgeHealth',
        intel.knowledgeHealthScore != null ? intel.knowledgeHealthScore + '%' : 'Run sync for lifecycle',
        { ellipsize: false },
      );
      setTextIfChanged(
        'v22ReviewQueue',
        intel.reviewQueueCount != null
          ? intel.reviewQueueCount > 0
            ? intel.reviewQueueCount + ' decision(s) need review'
            : 'Review queue clear'
          : '—',
        { ellipsize: false },
      );
      setTextIfChanged(
        'v22Coverage',
        intel.knowledgeCoverage != null ? Math.round(intel.knowledgeCoverage * 100) + '%' : '—',
        { ellipsize: false },
      );
      setTextIfChanged(
        'v22ConfIndex',
        intel.confidenceIndex != null ? Math.round(intel.confidenceIndex * 100) + '%' : '—',
        { ellipsize: false },
      );
      setTextIfChanged('v22Timeline', intel.timelineSummary);
      setTextIfChanged(
        'v22ImpactRadius',
        intel.impactRadius != null ? String(intel.impactRadius) : '—',
        { ellipsize: false },
      );

      setTextIfChanged('v22DecSnapshot', dec.decisionSnapshot);
      setTextIfChanged('v22DecGraph', dec.graphSummary);
      fillV22List(document.getElementById('v22DecLinks'), dec.decisionLinks);
      fillV22List(document.getElementById('v22DecHistory'), dec.decisionHistory);

      setTextIfChanged('v22GIntent', graph.intentGraph);
      setTextIfChanged('v22GStructure', graph.structureGraph);
      setTextIfChanged('v22GImpact', graph.impactOverlay);
      setTextIfChanged('v22GEvolution', graph.evolutionTimeline);
      fillV22Domains(document.getElementById('v22GHotspots'), graph.hotspots);

      paintV22ActivityDelta(view.activity || { lines: [] });

      setTextIfChanged('v22StructBuilder', struct.stateBuilder);
      fillV22Domains(document.getElementById('v22StructModules'), struct.moduleMap);
      fillV22List(document.getElementById('v22StructProblems'), struct.openProblems);
      fillV22List(document.getElementById('v22StructDecisions'), struct.linkedDecisions);
      setTextIfChanged('v22StructNext', struct.nextCognition);

      setTextIfChanged('v22McpHint', exp.mcpSnapshotHint);
      setTextIfChanged(
        'v22TokenEst',
        exp.tokenEstimate ? '~' + exp.tokenEstimate + ' tokens' : '—',
        { ellipsize: false },
      );
      setTextIfChanged('v22InjectPreview', exp.injectPreview);
    }

    function paintV22View(v) {
      paintV22Delta(null, v);
    }

    function setText(id, text) {
      const el = document.getElementById(id);
      if (el) el.textContent = text || '—';
    }

    function paintStateDelta(prev, s, byokPayload) {
      const aiIntent = s.aiIntent || null;
      syncTaskNotesFromState(s);
      if (
        !jsonEq(prev.summary, s.summary) ||
        !jsonEq(prev.projectFileActivityItems, s.projectFileActivityItems) ||
        !jsonEq(prev.activityStreamItems, s.activityStreamItems)
      ) {
        paintSummary(s);
      }
      if (
        !jsonEq(prev.recentFiles, s.recentFiles) ||
        !jsonEq(prev.recentFileActivitySuffixes, s.recentFileActivitySuffixes) ||
        !jsonEq(prev.gitStaged, s.gitStaged) ||
        !jsonEq(prev.gitWorking, s.gitWorking)
      ) {
        paintLists(s);
      }
      if (
        !jsonEq(prev.aiIntent, s.aiIntent) ||
        !jsonEq(prev.activityObservedGoals, s.activityObservedGoals)
      ) {
        paintAiRibbon(byokPayload, aiIntent, s.activityObservedGoals || []);
      }
      if (
        !jsonEq(prev.v22View, s.v22View) ||
        !jsonEq(prev.projectState, s.projectState) ||
        !jsonEq(prev.understandingPanel, s.understandingPanel) ||
        !jsonEq(prev.projectFileActivityItems, s.projectFileActivityItems) ||
        !jsonEq(prev.activityStreamItems, s.activityStreamItems)
      ) {
        paintHomeLayer(s, s.v22View || null);
      }
      if (!jsonEq(prev.v22View, s.v22View)) {
        paintV22Delta(prev.v22View || null, s.v22View || null);
      }
      if (!jsonEq(prev.intentGraph, s.intentGraph)) {
        paintGraphPanel(s.intentGraph || null);
      }
      if (!jsonEq(prev.projectState, s.projectState)) {
        paintProjectStatePanel(s.projectState || null);
      }
      if (!jsonEq(prev.governanceStatus, s.governanceStatus)) {
        paintGovernancePanel(s.governanceStatus || null);
      }
      if (!jsonEq(prev.understandingPanel, s.understandingPanel)) {
        paintUnderstandingPanel(s.understandingPanel || null);
      }
      if (!jsonEq(prev.stateConflicts, s.stateConflicts)) {
        paintConflictsPanel(s.stateConflicts || null);
      }
      bumpTrackStatus(s);
    }

    function paintFullState(s, byokPayload) {
      const aiIntent = s.aiIntent || null;
      syncTaskNotesFromState(s);
      paintLists(s);
      paintSummary(s);
      paintAiRibbon(byokPayload, aiIntent, s.activityObservedGoals || []);
      paintV22View(s.v22View || null);
      paintHomeLayer(s, s.v22View || null);
      paintGraphPanel(s.intentGraph || null);
      paintProjectStatePanel(s.projectState || null);
      paintGovernancePanel(s.governanceStatus || null);
      paintUnderstandingPanel(s.understandingPanel || null);
      paintConflictsPanel(s.stateConflicts || null);
      bumpTrackStatus(s);
    }

    function fingerprintSidebar(s) {
      if (!s) return '';
      return JSON.stringify({
        summary: s.summary,
        recentFiles: s.recentFiles,
        recentSuffix: s.recentFileActivitySuffixes,
        gitStaged: s.gitStaged,
        gitWorking: s.gitWorking,
        goals: (s.aiIntent && s.aiIntent.goals) || [],
        activityGoals: s.activityObservedGoals || [],
        activityStream: s.activityStreamItems || [],
        v22View: s.v22View,
      });
    }

    function bumpTrackStatus(s) {
      if (!aiTrackStatus) return;
      const statusRow = document.getElementById('aiCardStatusRow');
      if (!s) {
        if (trackStatusTimer) {
          clearTimeout(trackStatusTimer);
          trackStatusTimer = null;
        }
        if (statusRow) statusRow.classList.remove('cr-ai-card-status--busy');
        aiTrackStatus.textContent = 'Workspace tracking active';
        lastTrackFingerprint = '';
        return;
      }
      const fp = fingerprintSidebar(s);
      if (lastTrackFingerprint && fp !== lastTrackFingerprint) {
        aiTrackStatus.textContent = 'Syncing workspace…';
        if (statusRow) statusRow.classList.add('cr-ai-card-status--busy');
        if (trackStatusTimer) clearTimeout(trackStatusTimer);
        trackStatusTimer = setTimeout(function () {
          aiTrackStatus.textContent = 'Workspace tracking active';
          if (statusRow) statusRow.classList.remove('cr-ai-card-status--busy');
          trackStatusTimer = null;
        }, 1000);
      }
      lastTrackFingerprint = fp;
    }

    function renderCollapsibleList(ul, items, sectionKey, itemSuffixes) {
      ul.innerHTML = '';
      if (!items || items.length === 0) {
        const li = document.createElement('li');
        li.className = 'muted-row';
        li.textContent = sectionKey === 'recent' ? 'No paths tracked yet' : '(nothing listed yet)';
        ul.appendChild(li);
        if (sectionKey === 'recent') {
          lastRecentTop = '';
        }
        return;
      }
      const expanded = expandState[sectionKey];
      const lim = expanded ? items.length : Math.min(items.length, LIST_PREVIEW);
      for (let i = 0; i < lim; i++) {
        const p = items[i];
        let textHtml = escapeHtml(p);
        if (sectionKey === 'recent' && itemSuffixes && itemSuffixes[i]) {
          textHtml += ' · ' + escapeHtml(itemSuffixes[i]);
        }
        const li = document.createElement('li');
        li.className = 'file-row cr-row-enter';
        li.style.animationDelay = Math.min(i, 10) * 55 + 'ms';
        if (sectionKey === 'recent' && i === 0 && lastRecentTop && lastRecentTop !== p) {
          li.classList.add('cr-file-row--flash');
        }
        li.innerHTML = '<span class="cr-file-ico">' + fileIcoHtml + '</span><span class="cr-file-text">' + textHtml + '</span>';
        li.addEventListener('click', () => vscode.postMessage({ type: 'openFile', relativePath: p }));
        ul.appendChild(li);
      }
      if (items.length > LIST_PREVIEW) {
        const toggle = document.createElement('li');
        toggle.className = 'toggle-more';
        toggle.textContent = expanded ? 'Show less' : 'More (+' + (items.length - LIST_PREVIEW) + ')';
        toggle.addEventListener('click', (e) => {
          e.preventDefault();
          expandState[sectionKey] = !expandState[sectionKey];
          if (lastState) paintLists(lastState);
        });
        ul.appendChild(toggle);
      }
      if (sectionKey === 'recent' && items.length) {
        lastRecentTop = items[0];
      }
    }

    function paintByok(b) {
      if (!byokProvider || !byokKeys || !byokModel || !byokExport || !byokWarn) return;
      if (!byokRuntime) return;
      if (!b) {
        byokRuntime.textContent = '—';
        byokProvider.textContent = '—';
        byokKeys.textContent = '—';
        byokModel.textContent = '—';
        byokExport.textContent = '—';
        byokWarn.hidden = true;
        return;
      }
      byokRuntime.textContent = 'Runtime: ${PRODUCT_DISPLAY_NAME} (@contora/runtime)';
      const labels = {
        off: 'Off (observing locally only)',
        openai: 'OpenAI',
        anthropic: 'Anthropic (Claude)',
        google: 'Google Gemini',
        deepseek: 'DeepSeek',
      };
      byokProvider.textContent = 'Provider: ' + (labels[b.aiProvider] || b.aiProvider);
      function mark(name, ok) {
        return name + (ok ? ' ✓' : ' —');
      }
      byokKeys.textContent =
        'Keys: ' +
        mark('OpenAI', b.keyOpenAI) +
        ' · ' +
        mark('Claude', b.keyAnthropic) +
        ' · ' +
        mark('Gemini', b.keyGoogle) +
        ' · ' +
        mark('DeepSeek', b.keyDeepseek);
      byokModel.textContent =
        b.aiProvider === 'off' ? 'Model: (BYOK off)' : 'Model: ' + (b.activeModelId || '—');
      const budgetTxt =
        !b.exportTokenBudget ? 'Unlimited' : String(b.exportTokenBudget) + ' tokens';
      byokExport.textContent =
        'Export: ' +
        (b.exportFormat || 'markdown') +
        ' · budget ' +
        budgetTxt +
        ' · append AI on export: ' +
        (b.appendAiOnExport ? 'on' : 'off') +
        ' · default mode: ' +
        (b.defaultAIMode || 'feature');
      byokWarn.hidden = !b.needsActiveProviderKey;
    }

    function paintCilAi(c) {
      const statusEl = document.getElementById('v22CilAiStatus');
      const providerEl = document.getElementById('v22CilAiProvider');
      const modulesEl = document.getElementById('v22CilAiModules');
      const routerEl = document.getElementById('v22CilAiRouter');
      const warnEl = document.getElementById('v22CilAiWarn');
      if (!statusEl || !providerEl || !modulesEl || !routerEl || !warnEl) return;
      if (!c) {
        statusEl.textContent = '—';
        providerEl.textContent = '—';
        modulesEl.textContent = '—';
        routerEl.textContent = '—';
        warnEl.hidden = true;
        return;
      }
      statusEl.textContent = c.enabled ? 'Enabled (explanation layer)' : 'Disabled (rule-only)';
      providerEl.textContent = (c.provider || '—') + ' · ' + (c.model || '—');
      modulesEl.textContent =
        c.modulesOn && c.modulesOn.length ? c.modulesOn.join(', ') : '(none — enable contora.cilAiEnabled)';
      routerEl.textContent = c.intentRouter || 'hybrid';
      if (c.needsKey) {
        warnEl.textContent = 'API key missing — expand Configure LLM below, then open Settings.';
        warnEl.hidden = false;
      } else {
        warnEl.hidden = true;
      }
    }

    function formatIntentUpdated(ts) {
      if (ts == null || !Number.isFinite(ts)) {
        return 'Sync time unknown';
      }
      const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
      if (mins === 0) {
        return 'Goals synced just now';
      }
      if (mins < 60) {
        return 'Goals synced ' + mins + ' min ago';
      }
      const h = Math.floor(mins / 60);
      return 'Goals synced ' + h + ' h ago';
    }

    function formatGraphUpdated(ts) {
      if (ts == null || !Number.isFinite(ts) || ts <= 0) {
        return 'pending';
      }
      const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
      if (mins === 0) {
        return 'just now';
      }
      if (mins < 60) {
        return mins + 'm ago';
      }
      const h = Math.floor(mins / 60);
      return h + 'h ago';
    }

    function graphStatusClass(status) {
      const s = String(status || '').toUpperCase();
      if (s === 'ACTIVE') {
        return 'cr-graph-status--active';
      }
      if (s === 'WEAKENING') {
        return 'cr-graph-status--weakening';
      }
      return 'cr-graph-status--partial';
    }

    function truncateGraphText(text, max) {
      const t = String(text || '').trim();
      if (t.length <= max) {
        return t;
      }
      return t.slice(0, max - 1) + '…';
    }

    /** Middle ellipsis for long paths — keeps prefix and suffix visible. */
    function truncateMiddle(text, max) {
      const t = String(text || '').trim();
      if (t.length <= max) {
        return t;
      }
      if (max <= 3) {
        return '…';
      }
      const budget = max - 1;
      const head = Math.ceil(budget / 2);
      const tail = Math.floor(budget / 2);
      return t.slice(0, head) + '…' + t.slice(t.length - tail);
    }

    function setGovMetaText(el, text, max, middle) {
      if (!el) {
        return;
      }
      const raw = String(text || '—').trim() || '—';
      el.textContent = middle ? truncateMiddle(raw, max) : truncateGraphText(raw, max);
      if (raw !== '—' && raw.length > max) {
        el.title = raw;
      } else {
        el.removeAttribute('title');
      }
    }

    function paintGraphPanel(panel) {
      if (!graphMetaEl || !graphEmptyEl) {
        return;
      }
      const g = panel || null;
      const empty = !g || g.empty;
      const hasIntents = !!(g && g.intents && g.intents.length > 0);
      const hasUnderstanding = !!(g && (g.projectIntent || g.problemArea || (g.domains && g.domains.length)));

      if (empty && !hasIntents && !hasUnderstanding) {
        graphMetaEl.textContent = 'building…';
        if (graphUnderstandingEl) {
          graphUnderstandingEl.hidden = true;
          graphUnderstandingEl.textContent = '';
        }
        if (graphProblemEl) {
          graphProblemEl.hidden = true;
          graphProblemEl.textContent = '';
        }
        if (graphDomainsEl) {
          graphDomainsEl.hidden = true;
          graphDomainsEl.innerHTML = '';
        }
        if (graphIntentListEl) {
          graphIntentListEl.hidden = true;
          graphIntentListEl.innerHTML = '';
        }
        graphEmptyEl.hidden = false;
        return;
      }

      graphEmptyEl.hidden = hasIntents || hasUnderstanding;
      const confPct = g && Number.isFinite(g.summaryConfidence)
        ? Math.round(g.summaryConfidence * 100)
        : null;
      graphMetaEl.textContent =
        (confPct != null ? confPct + '% · ' : '') + 'updated ' + formatGraphUpdated(g && g.updatedAt);

      if (graphUnderstandingEl) {
        if (g && g.projectIntent) {
          graphUnderstandingEl.hidden = false;
          graphUnderstandingEl.textContent = truncateGraphText(g.projectIntent, 160);
        } else {
          graphUnderstandingEl.hidden = true;
          graphUnderstandingEl.textContent = '';
        }
      }

      if (graphProblemEl) {
        const parts = [];
        if (g && g.problemArea) {
          parts.push(g.problemArea);
        }
        if (g && g.hotspot) {
          parts.push('hotspot: ' + g.hotspot);
        }
        if (parts.length) {
          graphProblemEl.hidden = false;
          graphProblemEl.textContent = parts.join(' · ');
        } else {
          graphProblemEl.hidden = true;
          graphProblemEl.textContent = '';
        }
      }

      if (graphDomainsEl) {
        graphDomainsEl.innerHTML = '';
        const domains = (g && g.domains) || [];
        if (domains.length) {
          graphDomainsEl.hidden = false;
          for (let di = 0; di < Math.min(domains.length, 5); di++) {
            const span = document.createElement('span');
            span.className = 'cr-graph-domain';
            span.textContent = domains[di];
            graphDomainsEl.appendChild(span);
          }
        } else {
          graphDomainsEl.hidden = true;
        }
      }

      if (graphIntentListEl) {
        graphIntentListEl.innerHTML = '';
        if (hasIntents) {
          graphIntentListEl.hidden = false;
          const items = g.intents.slice(0, 6);
          for (let ii = 0; ii < items.length; ii++) {
            const item = items[ii];
            const li = document.createElement('li');
            const badge = document.createElement('span');
            badge.className = 'cr-graph-status ' + graphStatusClass(item.status);
            badge.textContent = String(item.status || 'PARTIAL').toLowerCase();
            const text = document.createElement('span');
            text.className = 'cr-graph-text';
            text.textContent = truncateGraphText(item.text, 88);
            const conf = document.createElement('span');
            conf.className = 'cr-graph-conf';
            conf.textContent = Math.round((item.confidence || 0) * 100) + '%';
            li.appendChild(badge);
            li.appendChild(text);
            li.appendChild(conf);
            graphIntentListEl.appendChild(li);
          }
        } else {
          graphIntentListEl.hidden = true;
        }
      }
    }

    function fillPsbList(el, items) {
      if (!el) {
        return;
      }
      el.innerHTML = '';
      for (let i = 0; i < items.length; i++) {
        const li = document.createElement('li');
        li.textContent = truncateGraphText(items[i], 120);
        el.appendChild(li);
      }
    }

    function paintConflictsPanel(conflicts) {
      if (!confSecEl || !confListEl) {
        return;
      }
      const c = conflicts || null;
      if (!c || c.empty || !c.count) {
        confSecEl.hidden = true;
        confListEl.innerHTML = '';
        return;
      }
      confSecEl.hidden = false;
      if (confMetaEl) {
        confMetaEl.textContent = c.count + ' UNRESOLVED';
      }
      confListEl.innerHTML = '';
      const items = c.items || [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const li = document.createElement('li');
        li.className = 'cr-conf-item';
        const title = document.createElement('div');
        title.className = 'cr-conf-item-k';
        title.textContent = (item.title || item.type || 'conflict') + ' · ' + (item.status || 'UNRESOLVED');
        li.appendChild(title);
        const srcs = item.sources || [];
        for (let si = 0; si < Math.min(srcs.length, 4); si++) {
          const p = document.createElement('div');
          p.className = 'cr-graph-muted';
          p.style.marginTop = '2px';
          p.textContent = truncateGraphText(srcs[si], 140);
          li.appendChild(p);
        }
        confListEl.appendChild(li);
      }
    }

    function paintProjectStatePanel(panel) {
      if (!psbMetaEl || !psbEmptyEl) {
        return;
      }
      const p = panel || null;
      const empty = !p || p.empty;
      if (empty) {
        psbMetaEl.textContent = 'building…';
        if (psbGoalEl) psbGoalEl.textContent = '—';
        if (psbStageEl) psbStageEl.textContent = '—';
        if (psbModulesEl) { psbModulesEl.hidden = true; psbModulesEl.innerHTML = ''; }
        if (psbDecisionsBlock) psbDecisionsBlock.hidden = true;
        if (psbProblemsBlock) psbProblemsBlock.hidden = true;
        if (psbNextBlock) psbNextBlock.hidden = true;
        psbEmptyEl.hidden = false;
        return;
      }
      psbEmptyEl.hidden = true;
      const confPct = Number.isFinite(p.confidence) ? Math.round(p.confidence * 100) : null;
      psbMetaEl.textContent =
        (confPct != null ? confPct + '% · ' : '') + 'updated ' + formatGraphUpdated(p.updatedAt);
      if (psbGoalEl) psbGoalEl.textContent = truncateGraphText(p.projectGoal || '—', 200);
      if (psbStageEl) psbStageEl.textContent = truncateGraphText(p.currentStage || '—', 160);
      if (psbModulesEl) {
        psbModulesEl.innerHTML = '';
        const mods = p.activeModules || [];
        if (mods.length) {
          psbModulesEl.hidden = false;
          for (let mi = 0; mi < Math.min(mods.length, 8); mi++) {
            const span = document.createElement('span');
            span.className = 'cr-graph-domain';
            span.textContent = mods[mi];
            psbModulesEl.appendChild(span);
          }
        } else {
          psbModulesEl.hidden = true;
        }
      }
      const decisions = p.recentDecisions || [];
      if (psbDecisionsBlock && psbDecisionsEl) {
        if (decisions.length) {
          psbDecisionsBlock.hidden = false;
          fillPsbList(psbDecisionsEl, decisions);
        } else {
          psbDecisionsBlock.hidden = true;
        }
      }
      const problems = p.openProblems || [];
      if (psbProblemsBlock && psbProblemsEl) {
        if (problems.length) {
          psbProblemsBlock.hidden = false;
          fillPsbList(psbProblemsEl, problems);
        } else {
          psbProblemsBlock.hidden = true;
        }
      }
      const next = p.nextActions || [];
      if (psbNextBlock && psbNextEl) {
        if (next.length) {
          psbNextBlock.hidden = false;
          fillPsbList(psbNextEl, next);
        } else {
          psbNextBlock.hidden = true;
        }
      }
    }

    function paintTodayFromPanels(gov, projectState) {
      const g = gov || null;
      const p = projectState || null;
      const direction =
        (g && g.projectDirection && g.projectDirection.trim()) ||
        (p && p.projectGoal && p.projectGoal.trim()) ||
        '—';
      if (todayProjectGoalEl) {
        todayProjectGoalEl.textContent = truncateGraphText(direction, 220);
      }
      if (todayDirectionUpdatedEl) {
        const ts = g && g.directionUpdatedAt ? g.directionUpdatedAt : p && p.updatedAt ? p.updatedAt : 0;
        todayDirectionUpdatedEl.textContent =
          ts > 0 ? 'Updated ' + formatGraphUpdated(ts) : 'Set project direction to guide AI exports';
      }
      if (todayStageEl) {
        todayStageEl.textContent = p && p.currentStage ? truncateGraphText(p.currentStage, 160) : '—';
      }
      const next = p && p.nextActions && p.nextActions.length ? p.nextActions[0] : '';
      if (todayNextBlock && todayNextEl) {
        if (next) {
          todayNextBlock.hidden = false;
          todayNextEl.textContent = truncateGraphText(next, 160);
        } else {
          todayNextBlock.hidden = true;
          todayNextEl.textContent = '—';
        }
      }
    }

    function paintGovernancePanel(gov) {
      const g = gov || null;
      if (!g) {
        if (govActiveLabel) govActiveLabel.textContent = 'Not initialized';
        if (govConstLine) govConstLine.hidden = true;
        if (govTruthLine) govTruthLine.hidden = true;
        if (govIdentityLine) govIdentityLine.hidden = true;
        if (govProtectedCount) govProtectedCount.textContent = '—';
        if (govForbiddenCount) govForbiddenCount.textContent = '—';
        if (govReviewFile) {
          govReviewFile.textContent = '—';
          govReviewFile.removeAttribute('title');
        }
        if (govReviewRisk) govReviewRisk.textContent = '—';
        if (govReviewChange) govReviewChange.textContent = '—';
        if (govReviewSeverity) govReviewSeverity.textContent = '—';
        if (govReviewImpact) govReviewImpact.textContent = '—';
        if (govReviewConfidence) govReviewConfidence.textContent = '—';
        if (govReviewProtected) govReviewProtected.textContent = '—';
        if (govReviewTruth) govReviewTruth.textContent = '—';
        if (govReviewRecommendation) govReviewRecommendation.textContent = '—';
        if (govReviewSource) govReviewSource.textContent = '—';
        if (govReviewTimestamp) govReviewTimestamp.textContent = '—';
        if (govReviewScope) govReviewScope.value = 'auto';
        if (govReviewWhy) govReviewWhy.innerHTML = '';
        if (govInjectPreview) govInjectPreview.textContent = '—';
        if (govInjectionRules) govInjectionRules.innerHTML = '';
        if (govTokenEstimate) govTokenEstimate.textContent = '—';
        return;
      }
      if (govActiveLabel) {
        govActiveLabel.textContent = g.active ? 'Active' : 'Not initialized';
      }
      if (govConstLine) govConstLine.hidden = !g.constitutionLoaded;
      if (govTruthLine) govTruthLine.hidden = !g.truthLoaded;
      if (govIdentityLine) govIdentityLine.hidden = !g.identityLoaded;
      if (govProtectedCount) govProtectedCount.textContent = String(g.protectedPathCount ?? 0);
      if (govForbiddenCount) govForbiddenCount.textContent = String(g.forbiddenRuleCount ?? 0);
      setGovMetaText(govReviewFile, g.reviewFile || '—', 30, true);
      if (govReviewRisk) {
        govReviewRisk.textContent = g.reviewRisk || '—';
        govReviewRisk.className = riskClass(g.reviewRisk);
      }
      if (govReviewChange) govReviewChange.textContent = g.reviewChangeType || '—';
      if (govReviewSeverity) govReviewSeverity.textContent = g.reviewSeverity || '—';
      if (govReviewImpact) govReviewImpact.textContent = g.reviewImpact || '—';
      if (govReviewConfidence) govReviewConfidence.textContent = g.reviewConfidence || '—';
      if (govReviewProtected) govReviewProtected.textContent = g.reviewProtected || '—';
      if (govReviewTruth) govReviewTruth.textContent = g.reviewTruthImpact || '—';
      setGovMetaText(govReviewRecommendation, g.reviewRecommendation || '—', 22, false);
      setGovMetaText(govReviewSource, g.reviewSource || '—', 18, false);
      setGovMetaText(govReviewTimestamp, g.reviewTimestamp || '—', 22, false);
      if (govReviewScope && g.reviewScopeValue && govReviewScope.value !== g.reviewScopeValue) {
        govReviewScope.value = g.reviewScopeValue;
      }
      if (govReviewWhy) {
        govReviewWhy.innerHTML = '';
        const why = g.reviewWhyChain || [];
        if (!why.length) {
          const li = document.createElement('li');
          li.className = 'cr-why-neg';
          li.textContent = 'Run Review change to populate Why chain';
          govReviewWhy.appendChild(li);
        } else {
          for (let i = 0; i < why.length; i++) {
            const li = document.createElement('li');
            li.textContent = why[i];
            if (String(why[i]).charAt(0) === '✗') {
              li.className = 'cr-why-neg';
            }
            govReviewWhy.appendChild(li);
          }
          if (g.reviewRisk && g.reviewRisk !== '—') {
            const li = document.createElement('li');
            li.textContent = 'Final Risk: ' + g.reviewRisk;
            govReviewWhy.appendChild(li);
          }
        }
      }
      if (govInjectPreview) {
        const preview = g.injectPreview || 'Open a file — review runs automatically on switch.';
        govInjectPreview.textContent = truncateMiddle(preview, 72);
        if (preview.length > 72) {
          govInjectPreview.title = preview;
        } else {
          govInjectPreview.removeAttribute('title');
        }
      }
      if (govInjectionRules) {
        govInjectionRules.innerHTML = '';
        const rules = g.injectionRules || [];
        for (let i = 0; i < Math.min(rules.length, 4); i++) {
          const li = document.createElement('li');
          li.textContent = truncateGraphText(rules[i], 72);
          govInjectionRules.appendChild(li);
        }
        if (rules.length > 4) {
          const li = document.createElement('li');
          li.textContent = '+' + (rules.length - 4) + ' more in export';
          govInjectionRules.appendChild(li);
        }
      }
      if (govTokenEstimate) {
        const est = g.injectionTokenEstimate || 0;
        govTokenEstimate.textContent = est > 0 ? '~' + est + ' governance tokens in export' : '—';
      }
    }

    function closeOverlayPanel() {
      if (crOverlay) crOverlay.hidden = true;
    }

    function renderOverlay(overlay) {
      if (!crOverlay || !crOverlayBody || !crOverlayTitle || !overlay) return;
      crOverlayBody.innerHTML = '';
      if (overlay.kind === 'governance') {
        crOverlayTitle.textContent = 'Governance overview';
        appendOverlayRow(crOverlayBody, 'Constitution', overlay.constitutionLoaded ? 'Loaded' : 'Missing');
        appendOverlayRow(crOverlayBody, 'Truth layer', overlay.truthLoaded ? 'Loaded' : 'Missing');
        appendOverlayRow(crOverlayBody, 'Identity', overlay.identityLoaded ? 'Loaded' : 'Missing');
        appendOverlayList(crOverlayBody, 'Protected paths', overlay.protectedPaths || []);
        appendOverlayList(crOverlayBody, 'Forbidden actions', overlay.forbiddenActions || []);
        if (overlay.principles && overlay.principles.length) {
          appendOverlayList(crOverlayBody, 'Principles', overlay.principles);
        }
      } else if (overlay.kind === 'review') {
        crOverlayTitle.textContent = 'Change review';
        appendOverlayRow(crOverlayBody, 'Current file', overlay.file || '—');
        if (overlay.reviewSource) {
          appendOverlayRow(crOverlayBody, 'Source', overlay.reviewSource);
        }
        if (overlay.reviewTimestamp) {
          appendOverlayRow(crOverlayBody, 'Last check', overlay.reviewTimestamp);
        }
        appendOverlayRow(crOverlayBody, 'Risk', overlay.risk || '—', riskClass(overlay.risk));
        appendOverlayRow(crOverlayBody, 'Change type', overlay.changeType || '—');
        appendOverlayRow(crOverlayBody, 'Severity', overlay.severity || '—');
        appendOverlayRow(crOverlayBody, 'Impact', overlay.impact || '—');
        if (overlay.confidence != null) {
          appendOverlayRow(crOverlayBody, 'Confidence', String(Math.round(overlay.confidence * 100)) + '%');
        }
        appendOverlayRow(crOverlayBody, 'Governance', overlay.governance || '—', riskClass(overlay.governance));
        appendOverlayRow(crOverlayBody, 'Protected path', overlay.protectedPath || 'No');
        appendOverlayRow(crOverlayBody, 'Truth impact', overlay.truthImpact || 'No');
        appendOverlayRow(crOverlayBody, 'Reason', overlay.reason || '—');
        appendOverlayRow(
          crOverlayBody,
          'Recommendation',
          overlay.recommendation || '—',
          overlay.allow ? 'cr-review-pass' : 'cr-review-warn',
        );
        if (overlay.reasonChain && overlay.reasonChain.length) {
          appendOverlayList(crOverlayBody, 'Why?', overlay.reasonChain);
        }
      } else if (overlay.kind === 'cil') {
        crOverlayTitle.textContent = overlay.title || 'CIL';
        if (overlay.subtitle) {
          appendOverlayRow(crOverlayBody, 'Range', overlay.subtitle);
        }
        const pre = document.createElement('pre');
        pre.className = 'cr-overlay-pre';
        pre.textContent = (overlay.lines || []).join('\\n');
        crOverlayBody.appendChild(pre);
      }
      crOverlay.hidden = false;
    }

    function riskClass(label) {
      const t = String(label || '').toLowerCase();
      if (t.includes('block') || t === 'high' || t === 'critical') return 'cr-review-block';
      if (t.includes('confirm') || t.includes('warn') || t === 'medium') return 'cr-review-warn';
      return 'cr-review-pass';
    }

    function appendOverlayRow(parent, label, value, valueClass) {
      const row = document.createElement('div');
      row.className = 'cr-overlay-row';
      const k = document.createElement('span');
      k.className = 'cr-overlay-k';
      k.textContent = label;
      const v = document.createElement('div');
      v.textContent = value;
      if (valueClass) v.className = valueClass;
      row.appendChild(k);
      row.appendChild(v);
      parent.appendChild(row);
    }

    function appendOverlayList(parent, label, items) {
      const row = document.createElement('div');
      row.className = 'cr-overlay-row';
      const k = document.createElement('span');
      k.className = 'cr-overlay-k';
      k.textContent = label;
      row.appendChild(k);
      const ul = document.createElement('ul');
      ul.className = 'cr-overlay-list';
      const list = items && items.length ? items : ['(none)'];
      for (let i = 0; i < list.length; i++) {
        const li = document.createElement('li');
        li.textContent = list[i];
        ul.appendChild(li);
      }
      row.appendChild(ul);
      parent.appendChild(row);
    }

    if (crOverlayClose) crOverlayClose.addEventListener('click', closeOverlayPanel);
    if (crOverlayBackdrop) crOverlayBackdrop.addEventListener('click', closeOverlayPanel);
    if (crOverlayContinue) crOverlayContinue.addEventListener('click', closeOverlayPanel);

    function renderFnTreeNode(node, depth, isLast, prefix) {
      const li = document.createElement('li');
      li.className = 'cr-fn-tree-item';
      const line = document.createElement('div');
      line.className = 'cr-fn-tree-line';
      if (depth > 0) {
        const branch = document.createElement('span');
        branch.className = 'cr-fn-tree-branch';
        branch.textContent = prefix + (isLast ? '└── ' : '├── ');
        line.appendChild(branch);
      }
      const label = document.createElement('span');
      label.className = 'cr-fn-tree-label' + (depth === 0 ? ' cr-fn-tree-label--root' : '') +
        (node.kind === 'class' ? ' cr-fn-tree-label--class' : '');
      label.textContent = node.name;
      line.appendChild(label);
      if (depth === 0 && node.file) {
        const f = document.createElement('span');
        f.className = 'cr-fn-tree-file';
        const parts = node.file.replace(/\\\\/g, '/').split('/');
        f.textContent = parts[parts.length - 1] || node.file;
        line.appendChild(f);
      }
      li.appendChild(line);
      if (node.children && node.children.length) {
        const ul = document.createElement('ul');
        ul.className = 'cr-fn-tree-children';
        const childPrefix = depth === 0 ? '' : prefix + (isLast ? '    ' : '│   ');
        for (let ci = 0; ci < node.children.length; ci++) {
          ul.appendChild(renderFnTreeNode(
            node.children[ci],
            depth + 1,
            ci === node.children.length - 1,
            childPrefix,
          ));
        }
        li.appendChild(ul);
      }
      return li;
    }

    function renderKgNode(node, depth) {
      const li = document.createElement('li');
      li.className = 'cr-kg-node';
      const typeClass = 'cr-kg-type-' + (node.type || 'function');
      const line = document.createElement('div');
      if (depth > 0) {
        line.innerHTML = '<span class="cr-kg-arrow">↓</span>';
      }
      const label = document.createElement('span');
      label.className = typeClass;
      let labelText = node.name;
      if (typeof node.confidence === 'number' && node.confidence > 0) {
        labelText += ' · ' + Math.round(node.confidence * 100) + '%';
      }
      label.textContent = labelText;
      line.appendChild(label);
      li.appendChild(line);
      if (node.children && node.children.length) {
        const ul = document.createElement('ul');
        ul.className = 'cr-kg-tree';
        for (let i = 0; i < node.children.length; i++) {
          ul.appendChild(renderKgNode(node.children[i], depth + 1));
        }
        li.appendChild(ul);
      }
      return li;
    }

    function paintKnowledgeGraphPanel(kg) {
      const view = kg || { intentTrees: [], reasonTraces: [], inferenceTraces: [], impactDetails: [], hotspots: [], avgConfidence: 0, closureVersion: '—', schemaVersion: '—', parserBackend: '—', empty: true };
      const trees = view.intentTrees || [];
      const hasTrees = trees.length > 0;
      if (kgMetaEl) {
        const conf = typeof view.avgConfidence === 'number' && view.avgConfidence > 0
          ? ' · conf ' + Math.round(view.avgConfidence * 100) + '%'
          : '';
        const schema = view.schemaVersion && view.schemaVersion !== '—' ? ' · v' + view.schemaVersion : '';
        kgMetaEl.textContent = hasTrees
          ? trees.length + ' intents · ' + (view.parserBackend || 'regex') + schema + conf
          : '—';
      }
      if (kgIntentTreesEl && kgEmptyEl) {
        kgIntentTreesEl.innerHTML = '';
        if (hasTrees) {
          kgEmptyEl.hidden = true;
          for (let ti = 0; ti < trees.length; ti++) {
            const intent = trees[ti];
            const det = document.createElement('details');
            det.className = 'cr-kg-intent';
            if (ti === 0 || intent.expanded) {
              det.open = true;
            }
            const sum = document.createElement('summary');
            sum.textContent = intent.name;
            det.appendChild(sum);
            const rootUl = document.createElement('ul');
            rootUl.className = 'cr-kg-tree';
            const kids = intent.children || [];
            for (let ci = 0; ci < kids.length; ci++) {
              rootUl.appendChild(renderKgNode(kids[ci], 0));
            }
            det.appendChild(rootUl);
            kgIntentTreesEl.appendChild(det);
          }
        } else {
          kgEmptyEl.hidden = false;
        }
      }
      if (kgImpactDetailEl && fnDepImpactSec) {
        kgImpactDetailEl.innerHTML = '';
        const details = view.impactDetails || [];
        if (details.length) {
          fnDepImpactSec.hidden = false;
          kgImpactDetailEl.hidden = false;
          for (let di = 0; di < details.length; di++) {
            const row = details[di];
            const li = document.createElement('li');
            const target = document.createElement('span');
            target.className = 'cr-fn-impact-target';
            target.textContent = row.symbol;
            const effect = document.createElement('span');
            effect.className = 'cr-fn-impact-effect';
            const parts = [];
            if (row.affectedIntent) {
              parts.push('intent: ' + row.affectedIntent);
            }
            if (row.affectedFunctions && row.affectedFunctions.length) {
              parts.push('calls: ' + row.affectedFunctions.slice(0, 3).join(', '));
            }
            effect.textContent = parts.length ? '→ ' + parts.join(' · ') : '→ linked symbol';
            li.appendChild(target);
            li.appendChild(effect);
            kgImpactDetailEl.appendChild(li);
          }
        } else {
          kgImpactDetailEl.hidden = true;
        }
      }
      if (kgHotspotsListEl && kgHotspotsEmptyEl) {
        kgHotspotsListEl.innerHTML = '';
        const hotspots = view.hotspots || [];
        if (hotspots.length) {
          kgHotspotsListEl.hidden = false;
          kgHotspotsEmptyEl.hidden = true;
          if (kgHotspotsMetaEl) {
            kgHotspotsMetaEl.textContent = hotspots.length + ' active';
          }
          if (kgHotspotsSec) {
            kgHotspotsSec.hidden = false;
          }
          for (let hi = 0; hi < hotspots.length; hi++) {
            const h = hotspots[hi];
            const li = document.createElement('li');
            const target = document.createElement('span');
            target.className = 'cr-fn-impact-target';
            target.textContent = h.name + (h.kind === 'function' ? '()' : '');
            const effect = document.createElement('span');
            effect.className = 'cr-fn-impact-effect';
            effect.textContent = '→ ' + (h.lifecycle || 'active') + ' · score ' + Math.round((h.score || 0) * 100) + '%';
            li.appendChild(target);
            li.appendChild(effect);
            kgHotspotsListEl.appendChild(li);
          }
        } else {
          kgHotspotsListEl.hidden = true;
          kgHotspotsEmptyEl.hidden = false;
          if (kgHotspotsMetaEl) {
            kgHotspotsMetaEl.textContent = '—';
          }
        }
      }
    }

    function paintReasonTracePanel(kg) {
      const view = kg || { reasonTraces: [], inferenceTraces: [], empty: true };
      const traces = (view.reasonTraces || []).concat(view.inferenceTraces || []);
      if (!reasonTraceSec || !reasonTraceListEl || !reasonTraceEmptyEl) {
        return;
      }
      reasonTraceListEl.innerHTML = '';
      if (!traces.length) {
        reasonTraceSec.hidden = true;
        reasonTraceEmptyEl.hidden = false;
        return;
      }
      reasonTraceSec.hidden = false;
      reasonTraceEmptyEl.hidden = true;
      for (let i = 0; i < traces.length; i++) {
        const t = traces[i];
        const li = document.createElement('li');
        const target = document.createElement('div');
        target.className = 'cr-reason-target';
        target.textContent = t.targetName + (t.targetType === 'function' ? '()' : '');
        li.appendChild(target);
        if (t.linkedIntent) {
          const intent = document.createElement('div');
          intent.className = 'cr-reason-why';
          intent.textContent = 'Intent: ' + t.linkedIntent;
          li.appendChild(intent);
        }
        if (typeof t.confidence === 'number' && t.confidence > 0) {
          const conf = document.createElement('div');
          conf.className = 'cr-reason-why';
          conf.textContent = 'Confidence: ' + Math.round(t.confidence * 100) + '%';
          li.appendChild(conf);
        }
        for (let ri = 0; ri < (t.reasons || []).length; ri++) {
          const why = document.createElement('div');
          why.className = 'cr-reason-why';
          why.textContent = '• ' + t.reasons[ri];
          li.appendChild(why);
        }
        reasonTraceListEl.appendChild(li);
      }
    }

    function paintFunctionGraphPanel(fg) {
      const view = fg || { trees: [], fileFlows: [], impactLines: [], empty: true };
      const hasTrees = view.trees && view.trees.length > 0;
      const hasFlows = view.fileFlows && view.fileFlows.length > 0;
      const hasImpact = view.impactLines && view.impactLines.length > 0;

      if (fnGraphMetaEl) {
        const roots = hasTrees ? view.trees.length : 0;
        const calls = hasTrees
          ? view.trees.reduce(function (n, t) {
              function countKids(node) {
                let c = node.children ? node.children.length : 0;
                for (let i = 0; i < (node.children || []).length; i++) {
                  c += countKids(node.children[i]);
                }
                return c;
              }
              return n + countKids(t);
            }, 0)
          : 0;
        fnGraphMetaEl.textContent = hasTrees ? roots + ' roots · ' + calls + ' calls' : '—';
      }

      if (fnFileFlowsEl) {
        fnFileFlowsEl.innerHTML = '';
        if (hasFlows) {
          fnFileFlowsEl.hidden = false;
          for (let fi = 0; fi < view.fileFlows.length; fi++) {
            const flow = view.fileFlows[fi];
            const p = document.createElement('p');
            p.className = 'cr-fn-flow-line';
            const chain = flow.chain || [];
            let html = '';
            for (let ci = 0; ci < chain.length; ci++) {
              if (ci > 0) {
                html += '<span class="cr-fn-flow-arrow">↓</span>';
              }
              html += '<span class="cr-fn-flow-chain">' + chain[ci] + '</span>';
            }
            p.innerHTML = html;
            fnFileFlowsEl.appendChild(p);
          }
        } else {
          fnFileFlowsEl.hidden = true;
        }
      }

      if (fnGraphTreesEl && fnGraphEmptyEl) {
        fnGraphTreesEl.innerHTML = '';
        if (hasTrees) {
          fnGraphTreesEl.hidden = false;
          fnGraphEmptyEl.hidden = true;
          for (let ti = 0; ti < view.trees.length; ti++) {
            fnGraphTreesEl.appendChild(renderFnTreeNode(view.trees[ti], 0, ti === view.trees.length - 1, ''));
          }
        } else {
          fnGraphTreesEl.hidden = true;
          if (!hasFlows) {
            fnGraphEmptyEl.hidden = false;
          } else {
            fnGraphEmptyEl.hidden = true;
          }
        }
      }

      if (fnImpactListEl && fnDepImpactSec) {
        fnImpactListEl.innerHTML = '';
        if (hasImpact) {
          fnDepImpactSec.hidden = false;
          for (let ii = 0; ii < view.impactLines.length; ii++) {
            const row = view.impactLines[ii];
            const li = document.createElement('li');
            const target = document.createElement('span');
            target.className = 'cr-fn-impact-target';
            target.textContent = row.target;
            const effect = document.createElement('span');
            effect.className = 'cr-fn-impact-effect';
            effect.textContent = '→ ' + row.effect;
            const badge = document.createElement('span');
            badge.className = 'cr-fn-impact-badge cr-fn-impact-badge--' + (row.level || 'low');
            badge.textContent = row.level || 'low';
            li.appendChild(target);
            li.appendChild(effect);
            li.appendChild(badge);
            fnImpactListEl.appendChild(li);
          }
        } else {
          fnDepImpactSec.hidden = true;
        }
      }
    }

    function paintUnderstandingPanel(panel) {
      if (!handoffMetaEl || !handoffSummaryEl || !handoffEmptyEl) {
        return;
      }
      const p = panel || null;
      const h = p && p.handoff ? p.handoff : null;
      const fg = p && p.functionGraph ? p.functionGraph : null;
      const kg = p && p.knowledgeGraph ? p.knowledgeGraph : null;
      paintKnowledgeGraphPanel(kg);
      paintFunctionGraphPanel(fg);
      paintReasonTracePanel(kg);
      const intel = p && p.intelligence ? p.intelligence : null;
      if (pilHealthMetaEl && pilHealthLineEl && pilCoverageLineEl) {
        if (!intel || intel.empty) {
          pilHealthMetaEl.textContent = '—';
          pilHealthLineEl.textContent = 'Run sync to derive health metrics';
          pilCoverageLineEl.textContent = 'Knowledge coverage: —';
        } else {
          const scorePct = intel.healthScore != null ? Math.round(intel.healthScore * 100) + '%' : '—';
          pilHealthMetaEl.textContent = intel.healthCategory || '—';
          pilHealthLineEl.textContent = 'Health score: ' + scorePct + ' · ' + (intel.healthCategory || '—');
          const covPct = intel.knowledgeCoverage != null ? Math.round(intel.knowledgeCoverage * 100) + '%' : '—';
          pilCoverageLineEl.textContent = 'Knowledge coverage: ' + covPct;
        }
      }
      if (!h || h.empty) {
        handoffMetaEl.textContent = 'building…';
        handoffSummaryEl.textContent = '—';
        if (handoffIntentEl) { handoffIntentEl.hidden = true; handoffIntentEl.textContent = ''; }
        if (uImpactBlock) uImpactBlock.hidden = true;
        if (uTimelineDetails) uTimelineDetails.hidden = true;
        handoffEmptyEl.hidden = !!(fg && !fg.empty);
        return;
      }
      handoffEmptyEl.hidden = true;
      const risk = h.riskLevel ? ' · risk ' + h.riskLevel : '';
      handoffMetaEl.textContent = h.changedCount + ' changed · ' + h.impactCount + ' impacted' + risk;
      handoffSummaryEl.textContent = truncateGraphText(h.summary || h.currentFocus || '—', 240);
      if (handoffIntentEl) {
        handoffIntentEl.hidden = true;
        handoffIntentEl.textContent = '';
      }
      const impact = p.impact || { modules: [], empty: true };
      if (uImpactBlock && uImpactModules) {
        uImpactModules.innerHTML = '';
        if (!impact.empty && impact.modules.length) {
          uImpactBlock.hidden = false;
          for (let mi = 0; mi < impact.modules.length; mi++) {
            const span = document.createElement('span');
            span.className = 'cr-graph-domain';
            span.textContent = impact.modules[mi].split('/').pop() || impact.modules[mi];
            uImpactModules.appendChild(span);
          }
        } else {
          uImpactBlock.hidden = true;
        }
      }
      const tl = p.timeline || { entries: [], empty: true };
      if (uTimelineDetails && uTimelineList) {
        uTimelineList.innerHTML = '';
        if (!tl.empty && tl.entries.length) {
          uTimelineDetails.hidden = false;
          for (let ti = 0; ti < tl.entries.length; ti++) {
            const e = tl.entries[ti];
            const li = document.createElement('li');
            li.textContent = e.commit + ' · ' + e.file + ' · ' + e.summary + ' (' + e.impact + ')';
            uTimelineList.appendChild(li);
          }
        } else {
          uTimelineDetails.hidden = true;
        }
      }
    }

    function paintAiIntentPanel(aiIntent, activityGoals) {
      if (!aiIntentGoalsEl || !aiIntentEmptyEl) {
        return;
      }
      function dedupeConsecutiveLines(arr) {
        if (!arr || !arr.length) {
          return [];
        }
        const out = [];
        for (let i = 0; i < arr.length; i++) {
          const g = arr[i];
          if (out.length && out[out.length - 1] === g) {
            continue;
          }
          out.push(g);
        }
        return out;
      }
      const fromAi = !!(aiIntent && aiIntent.goals && aiIntent.goals.length > 0);
      const ag = activityGoals || [];
      const goals = dedupeConsecutiveLines(fromAi ? aiIntent.goals : ag);
      aiIntentGoalsEl.innerHTML = '';
      if (goals.length <= LIST_PREVIEW) {
        aiGoalsExpanded = false;
      }
      const showAll = goals.length <= LIST_PREVIEW || aiGoalsExpanded;
      const visibleGoals = showAll ? goals : goals.slice(0, LIST_PREVIEW);
      if (goals.length === 0) {
        aiIntentGoalsEl.hidden = true;
        aiIntentEmptyEl.hidden = false;
        if (aiIntentGoalsToggle) {
          aiIntentGoalsToggle.hidden = true;
        }
      } else {
        aiIntentEmptyEl.hidden = true;
        aiIntentGoalsEl.hidden = false;
        for (let gi = 0; gi < visibleGoals.length; gi++) {
          const g = visibleGoals[gi];
          const li = document.createElement('li');
          li.className = 'cr-goal-enter';
          li.style.animationDelay = Math.min(gi, 12) * 500 + 'ms';
          li.textContent = g;
          aiIntentGoalsEl.appendChild(li);
        }
        if (aiIntentGoalsToggle) {
          if (goals.length > LIST_PREVIEW) {
            aiIntentGoalsToggle.hidden = false;
            aiIntentGoalsToggle.textContent = aiGoalsExpanded
              ? 'Show less'
              : 'More (+' + (goals.length - LIST_PREVIEW) + ')';
            aiIntentGoalsToggle.setAttribute('aria-expanded', aiGoalsExpanded ? 'true' : 'false');
          } else {
            aiIntentGoalsToggle.hidden = true;
          }
        }
      }
      if (aiStatUpdated) {
        if (fromAi) {
          const age = formatIntentUpdated(aiIntent.updatedAt);
          aiStatUpdated.textContent = aiIntent.stale
            ? 'Intent may be outdated · ' + age
            : age;
        } else if (aiIntent && aiIntent.stale) {
          aiStatUpdated.textContent = 'Previous intent outdated — using live activity';
        } else if (goals.length > 0) {
          aiStatUpdated.textContent = 'Live intent from workspace activity';
        } else {
          aiStatUpdated.textContent = 'Waiting for workspace activity';
        }
      }
    }

    function paintAiRibbon(b, aiIntent, activityGoals) {
      if (!aiStatModel || !aiStatRuntime || !aiStatMode || !aiStatCtx || !aiStatTierBadge) {
        return;
      }
      paintAiIntentPanel(aiIntent, activityGoals);
      if (!b) {
        aiStatModel.textContent = '—';
        aiStatTierBadge.hidden = true;
        aiStatRuntime.textContent = '—';
        aiStatMode.textContent = '—';
        aiStatCtx.textContent = 'Export token budget —';
        return;
      }
      aiStatModel.textContent = b.aiProvider === 'off' ? '(cloud off)' : b.activeModelId || '—';
      aiStatTierBadge.hidden = true;
      if (b.aiProvider === 'off') {
        aiStatRuntime.textContent = 'Local heuristics';
      } else {
        aiStatRuntime.innerHTML =
          'Cloud AI (v3)<span class="cr-ai-byok-muted"> BYOK</span>';
      }
      const fromAi = !!(aiIntent && aiIntent.goals && aiIntent.goals.length > 0);
      const modeFromIntent = fromAi && aiIntent ? aiIntent.intentMode : undefined;
      aiStatMode.textContent = modeFromIntent || b.defaultAIMode || 'feature';
      const budgetTxt =
        !b.exportTokenBudget ? 'no cap' : String(b.exportTokenBudget) + ' tokens';
      aiStatCtx.textContent = 'Context ' + budgetTxt;
      if (aiContextTokensEl) {
        aiContextTokensEl.textContent = budgetTxt === 'no cap' ? 'Context budget: no cap' : budgetTxt;
      }
    }

    function wireClick(el, type) {
      if (!el) return;
      el.addEventListener('click', function () { vscode.postMessage({ type: type }); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); vscode.postMessage({ type: type }); }
      });
    }

    function paintActivityStream(items, silent) {
      if (!activityStreamListEl) {
        return;
      }
      const clockIco = document.querySelector('#sumActivity .cr-sum-ico--clock');
      const list = items && items.length ? items : [];
      if (list.length === 0) {
        activityStreamListEl.innerHTML = '';
        activityStreamListEl.hidden = true;
        lastActivityStreamHead = '';
        expandState.activityStream = false;
        if (clockIco) {
          clockIco.classList.remove('cr-sum-ico--pulse-soft');
        }
        return;
      }
      if (list.length <= LIST_PREVIEW) {
        expandState.activityStream = false;
      }
      const prevHead = lastActivityStreamHead;
      activityStreamListEl.hidden = false;
      activityStreamListEl.innerHTML = '';
      if (clockIco) {
        clockIco.classList.add('cr-sum-ico--pulse-soft');
      }
      const streamExpanded = expandState.activityStream;
      const lim = streamExpanded ? list.length : Math.min(list.length, LIST_PREVIEW);
      for (let i = 0; i < lim; i++) {
        const li = document.createElement('li');
        li.className = 'cr-activity-feed-row';
        li.textContent = list[i];
        const newHead = i === 0 && list[0] && !silent && list[0] !== prevHead;
        if (newHead) {
          li.classList.add('cr-activity-feed-enter', 'cr-activity-feed-row--flash');
        }
        activityStreamListEl.appendChild(li);
      }
      if (list.length > LIST_PREVIEW) {
        const toggle = document.createElement('li');
        toggle.className = 'toggle-more';
        toggle.textContent = streamExpanded ? 'Show less' : 'More (+' + (list.length - LIST_PREVIEW) + ')';
        toggle.addEventListener('click', function (e) {
          e.preventDefault();
          expandState.activityStream = !expandState.activityStream;
          if (lastState) {
            paintActivityStream((lastState.activityStreamItems) || [], false);
          }
        });
        activityStreamListEl.appendChild(toggle);
      }
      lastActivityStreamHead = list[0] || '';
    }

    function paintSummary(s, opts) {
      const silent = opts && opts.silent === true;
      if (!s || !s.summary) return;
      const a = s.summary.activeFilesLine;
      const g = s.summary.gitLine;
      const act = s.summary.activityLine;
      if (sumActiveBody) {
        if (!silent && lastSumActive && a !== lastSumActive) {
          sumActiveBody.classList.remove('cr-sum-body--anim');
          void sumActiveBody.offsetWidth;
          sumActiveBody.classList.add('cr-sum-body--anim');
          setTimeout(function () { sumActiveBody.classList.remove('cr-sum-body--anim'); }, 520);
        }
        lastSumActive = a;
        sumActiveBody.textContent = a;
      }
      if (sumGitBody) {
        if (!silent && lastSumGit && g !== lastSumGit) {
          sumGitBody.classList.remove('cr-sum-body--anim');
          void sumGitBody.offsetWidth;
          sumGitBody.classList.add('cr-sum-body--anim');
          setTimeout(function () { sumGitBody.classList.remove('cr-sum-body--anim'); }, 520);
        }
        lastSumGit = g;
        sumGitBody.textContent = g;
      }
      if (sumActivityBody && sumActivityLine) {
        if (!silent && lastSumActivity && act !== lastSumActivity) {
          sumActivityLine.classList.remove('cr-sum-line--flash');
          void sumActivityLine.offsetWidth;
          sumActivityLine.classList.add('cr-sum-line--flash');
          setTimeout(function () { sumActivityLine.classList.remove('cr-sum-line--flash'); }, 1100);
        }
        lastSumActivity = act;
        sumActivityBody.textContent = act;
      }
      paintActivityStream((s && s.activityStreamItems) || [], silent);
    }

    wireClick(document.getElementById('btnCilAiConfigure'), 'openLlmSettings');
    wireClick(document.getElementById('btnFooterSettings'), 'openContoraSettings');
    wireClick(document.getElementById('btnAiSemantic'), 'generateSemanticSummary');
    wireClick(document.getElementById('btnAiIntent'), 'analyzeWorkspaceIntent');
    wireClick(document.getElementById('btnAiCompress'), 'compressContextPreview');
    wireClick(document.getElementById('btnViewRules'), 'viewRules');
    wireClick(document.getElementById('btnReviewChange'), 'reviewChange');

    function paintLists(s) {
      const suf = (s && s.recentFileActivitySuffixes) || [];
      renderCollapsibleList(recentEl, s.recentFiles || [], 'recent', suf);
      renderCollapsibleList(gitStagedEl, s.gitStaged || [], 'staged');
      renderCollapsibleList(gitWorkingEl, s.gitWorking || [], 'working');
    }

    let phasedRestoreTimers = [];
    let phasedRestoreInProgress = false;

    function restoreTargets() {
      return {
        sumActive: document.getElementById('sumActive'),
        sumGit: document.getElementById('sumGit'),
        sumActivity: document.getElementById('sumActivity'),
        secRecent: document.getElementById('crSecRecent'),
        gitDetails: document.getElementById('crGitDetails'),
        secAiGoals: document.getElementById('crSecAiGoals'),
        secIntentGraph: document.getElementById('crSecIntentGraph'),
        secProjectState: document.getElementById('crSecProjectState'),
        secConflicts: document.getElementById('crSecConflicts'),
        secCortex: document.getElementById('crCortexDetails'),
      };
    }

    function hideAllRestoreTargets() {
      const t = restoreTargets();
      for (const k in t) {
        if (t[k]) t[k].classList.add('cr-restore-hidden');
      }
    }

    function showAllRestoreTargets() {
      const t = restoreTargets();
      for (const k in t) {
        if (t[k]) t[k].classList.remove('cr-restore-hidden');
      }
    }

    function clearPhasedRestoreFull() {
      phasedRestoreTimers.forEach(function (id) {
        clearTimeout(id);
      });
      phasedRestoreTimers = [];
      phasedRestoreInProgress = false;
      document.documentElement.classList.remove('cr-restore-hydrating');
      showAllRestoreTargets();
      const statusRow = document.getElementById('aiCardStatusRow');
      if (statusRow) statusRow.classList.remove('cr-ai-card-status--busy');
    }

    function runPhasedWorkspaceRestore(s, byok, aiIntent) {
      const activityGoals = (s && s.activityObservedGoals) || [];
      phasedRestoreTimers.forEach(function (id) {
        clearTimeout(id);
      });
      phasedRestoreTimers = [];
      phasedRestoreInProgress = true;
      const t = restoreTargets();
      document.documentElement.classList.add('cr-restore-hydrating');
      hideAllRestoreTargets();
      const aiTs = document.getElementById('aiTrackStatus');
      const statusRow = document.getElementById('aiCardStatusRow');
      if (aiTs) aiTs.textContent = 'Restoring workspace view…';
      if (statusRow) statusRow.classList.add('cr-ai-card-status--busy');

      paintSummary(s, { silent: true });
      paintLists(s);
      paintAiRibbon(byok, aiIntent, activityGoals);
      paintGraphPanel(s.intentGraph || null);
      paintProjectStatePanel(s.projectState || null);
      paintUnderstandingPanel(s.understandingPanel || null);
      paintConflictsPanel(s.stateConflicts || null);

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          document.documentElement.classList.remove('cr-restore-hydrating');
        });
      });

      function reveal(el) {
        if (el) el.classList.remove('cr-restore-hidden');
      }
      function rdel(ms, fn) {
        phasedRestoreTimers.push(setTimeout(fn, ms));
      }
      rdel(160, function () {
        reveal(t.secProjectState);
      });
      rdel(400, function () {
        reveal(t.sumActive);
        reveal(t.sumGit);
      });
      rdel(640, function () {
        reveal(t.sumActivity);
      });
      rdel(880, function () {
        reveal(t.secCortex);
        reveal(t.secIntentGraph);
        reveal(t.secRecent);
        reveal(t.secConflicts);
      });
      rdel(1040, function () {
        reveal(t.secAiGoals);
        paintAiIntentPanel(aiIntent || null, activityGoals);
      });
      rdel(1280, function () {
        reveal(t.gitDetails);
      });
      rdel(1660, function () {
        if (statusRow) statusRow.classList.remove('cr-ai-card-status--busy');
        if (aiTs) aiTs.textContent = 'Workspace tracking active';
        bumpTrackStatus(s);
        phasedRestoreInProgress = false;
        phasedRestoreTimers = [];
      });
    }

    const bootBarEl = document.getElementById('crBootBar');
    const bootBarText = document.getElementById('crBootBarText');
    function setBootLoading(state) {
      if (!bootBarEl) return;
      const blocking = !state || state.dataLoading === true;
      bootBarEl.hidden = !blocking;
      if (bootBarText && state && state.dataLoading === true) {
        bootBarText.textContent = 'Loading workspace data…';
      }
    }
    setBootLoading({ dataLoading: true, heavyLoading: false, panelsLoading: true });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === 'overlay') {
        renderOverlay(msg.overlay);
        return;
      }
      if (msg.type === 'exportProgress') {
        updateExportProgress(msg);
        return;
      }
      if (msg.type !== 'state') return;
      setBootLoading(msg.state);
      const s = msg.state;
      const byokPayload = msg.byok || null;
      const cilAiPayload = msg.cilAi || null;
      paintByok(byokPayload);
      paintCilAi(cilAiPayload);
      if (!s) {
        clearPhasedRestoreFull();
        lastState = null;
        expandState.recent = false;
        expandState.staged = false;
        expandState.working = false;
        expandState.activityStream = false;
        if (taskEl) taskEl.value = '';
        if (notesEl) notesEl.value = '';
        paintTaskMeta();
        paintLists({ recentFiles: [], recentFileActivitySuffixes: [], gitStaged: [], gitWorking: [] });
        if (sumActiveBody) sumActiveBody.textContent = '—';
        if (sumGitBody) sumGitBody.textContent = '—';
        if (sumActivityBody) sumActivityBody.textContent = 'Open a folder to start workspace tracking.';
        lastActivityStreamHead = '';
        paintActivityStream([], false);
        if (crVersion) crVersion.textContent = '${PRODUCT_DISPLAY_NAME}';
        lastSumGit = '';
        lastSumActive = '';
        lastSumActivity = '';
        lastRecentTop = '';
        paintAiRibbon(byokPayload, null, []);
        paintGraphPanel(null);
        paintProjectStatePanel(null);
        paintGovernancePanel(null);
        paintTodayFromPanels(null, null);
        paintUnderstandingPanel(null);
        paintConflictsPanel(null);
        bumpTrackStatus(null);
        return;
      }
      const prevState = lastState;

      try {
      lastState = s;
        if (crVersion) {
      crVersion.textContent = '${PRODUCT_DISPLAY_NAME} v' + (s.extensionVersion || '?');
        }

        if (prevState === null) {
        clearPhasedRestoreFull();
          paintFullState(s, byokPayload);
        return;
      }

        paintStateDelta(prevState, s, byokPayload);
      } catch (err) {
        console.error('Contorium sidebar paint failed:', err);
      }
    });

    paintTaskMeta();
    setTimeout(() => vscode.postMessage({ type: 'ready' }), 0);
    } catch (err) {
      document.body.innerHTML =
        '<div style="padding:12px;font-family:var(--vscode-font-family);color:var(--vscode-errorForeground)">' +
        '<p><strong>Contorium sidebar script error</strong></p>' +
        '<pre style="font-size:11px;white-space:pre-wrap">' +
        String(err && err.message ? err.message : err) +
        '</pre></div>';
      try {
        acquireVsCodeApi().postMessage({ type: 'ready' });
      } catch (_) { /* ignore */ }
    }
    })();
  </script>
</body>
</html>`;
    ContoraSidebarProvider.htmlTemplateCache = html;
    ContoraSidebarProvider.htmlTemplateCachedVersion = ContoraSidebarProvider.htmlTemplateVersion;
    return html.replace(/__NONCE__/g, nonce).replace(/__CSP_ATTR__/g, cspAttr);
  }
}
