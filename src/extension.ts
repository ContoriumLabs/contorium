import * as vscode from 'vscode';
import {
  EventStore,
  MemoryBuilder,
  ModeEngine,
  allocate,
  analyzeActivity,
  analyzeContextQuality,
  buildContextPayloadV2,
  buildSemanticSummaryBlock,
  countDuplicatePaths,
  formatWithAdapter,
  getModeStrategy,
  listIgnoredPathIssues,
  rankContextFilesWithDebug,
  trimStringToTokenBudget,
  estimateTokens,
  type ExportFormat,
} from './core';
import type { WorkspaceMemory } from './core/models/workspaceMemory';
import { IgnoreMatcher, shouldIgnoreWorkspacePath } from './core/ignore/ignoreMatcher';
import { appendEventJsonl, EventLog } from './core/events/eventLog';
import { WorkspaceScanner } from './scanner/workspaceScanner';
import { StateManager, newSessionId } from './state/stateManager';
import { detectWorkspaceSessionShift, topWorkspacePathsFromState } from './state/sessionBoundary';
import { restoreEditorsFromState } from './state/recovery';
import { writeLatestMemoryJson } from './storage/memoryWriter';
import {
  CONTORA_CONFIG_SECTION,
  CONTORA_IGNORE_FILE,
  CONTORA_LEGACY_IGNORE_FILE,
  PRODUCT_DISPLAY_NAME,
} from './constants';
import { ContoraSidebarProvider } from './ui/sidebarProvider';
import { buildGovernanceExportAppendix, runAndPersistGovernanceReview } from './ai/governanceReviewBridge';
import {
  deliverExportText,
  formatExportDeliveryMessage,
  readExportDelivery,
} from './ai/injectIntoAiChat';
import { runGovernanceInject } from './ai/runGovernanceInject';
import { runExportAIContext, type ExportMode, type ExportProgressReporter } from './ai/runExportAIContext';
import { readExportFormat } from './ai/exportFormat';
import { ContoraKeyManager } from './ai/auth/keyManager';
import { bindCilLlmKeyManager, syncCilLlmConfigFromIde } from './ai/cilLlmBridge';
import { registerLlmSettingsHandlers } from './ai/llmSettingsHandler';
import { buildAiReadyJsonExport, buildAiReadyMarkdownExport } from './ai/buildAiReadyExport';
import { compressExportJsonForBudget, compressExportMarkdownForBudget } from './ai/aiReadyExportCompression';
import { readExportLlmFallbackEnabled, readResolvedExportTokenBudget } from './ai/exportBudget';
import { ProviderManager } from './ai/providers/providerManager';
import { clearLastIntentStore } from './ai/runtime/intent/lastIntentStore';
import { clearSemanticSummaryCache } from './ai/runtime/semanticSummary/summaryCache';
import { loadUsableIntentFocusLines } from './core/memory/intentStore';
import type { CognitionPipeline } from './cognition/cognitionPipeline';
import type { CodeGraphParserService } from './cognition/codeGraphParserService';
import { loadCognitionExportContext } from './cognition/loaders';
import {
  endDashboardSession,
  hideRuntimeDashboard,
  registerDashboardStatusBar,
  runInjectRuntimeHandoff,
  showRuntimeDashboard,
} from './dashboard/autoAttach';
import { runAskContorium } from './cil/askContorium.js';
import { scheduleDashboardWake, scheduleRuntimeBootstrap } from './dashboard/wakeSpawn';
import {
  ideControlEnsureReady,
} from './control/controlBridge';

let scanners: WorkspaceScanner[] = [];
let workspaceIgnoreMatcher: IgnoreMatcher | undefined;
const ignoreDisposables: vscode.Disposable[] = [];

function disposeScanners(): void {
  for (const s of scanners) {
    s.dispose();
  }
  scanners = [];
}

function disposeIgnoreWatchers(): void {
  for (const d of ignoreDisposables) {
    d.dispose();
  }
  ignoreDisposables.length = 0;
}

function eventBufferCap(): number {
  const n = vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION).get<number>('maxEventBuffer');
  return typeof n === 'number' && n >= 20 ? Math.min(5000, n) : 200;
}

function eventsInPrompt(): number {
  const n = vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION).get<number>('eventsInPrompt');
  return typeof n === 'number' && n >= 0 ? Math.min(200, n) : 50;
}

function maxPriorityFilesCap(strategyMax: number): number {
  const n = vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION).get<number>('maxPriorityFiles');
  const cap = typeof n === 'number' && n >= 1 ? Math.min(40, n) : 12;
  return Math.min(cap, strategyMax);
}

function exportTokenBudget(): number {
  return readResolvedExportTokenBudget(vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION));
}

function mergeDiskEventLogEnabled(): boolean {
  return vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION).get<boolean>('mergeDiskEventLog') !== false;
}

function writeLatestMemoryOnSaveEnabled(): boolean {
  return vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION).get<boolean>('writeLatestMemoryOnSave') !== false;
}

function applyIgnoreToMemory(memory: WorkspaceMemory, ig: (p: string) => boolean): void {
  memory.workingFiles = memory.workingFiles.filter((f) => !ig(f));
  memory.openFiles = memory.openFiles.filter((f) => !ig(f));
  memory.gitState.staged = memory.gitState.staged.filter((f) => !ig(f));
  memory.gitState.modified = memory.gitState.modified.filter((f) => !ig(f));
  memory.recentEvents = memory.recentEvents.filter((e) => {
    if (e.type === 'file_focus' || e.type === 'file_save' || e.type === 'file_create' || e.type === 'file_delete') {
      return !ig(e.file);
    }
    if (e.type === 'file_rename') {
      return !ig(e.oldFile) && !ig(e.newFile);
    }
    return true;
  });
}

let globalEventStore: EventStore | undefined;
let cognitionPipeline: CognitionPipeline | undefined;
let codeGraphParser: CodeGraphParserService | undefined;
let cognitionInitPromise: Promise<void> | undefined;

/** Defer tree-sitter / cognition pipeline so activate returns before heavy modules load. */
const COGNITION_DEFER_MS = 2_000;
const CONTROL_ENSURE_DEFER_MS = 6_000;
const BOOTSTRAP_DEFER_MS = 50;
const RUNTIME_BOOTSTRAP_DEFER_MS = 2_500;
const WORKSPACE_BOOTSTRAP_TIMEOUT_MS = 45_000;

async function loadStateWithTimeout(
  stateManager: StateManager,
  folder: vscode.WorkspaceFolder,
): Promise<import('./types/state').ProjectState> {
  return stateManager.loadResilient(folder);
}

function scheduleCognitionServices(
  context: vscode.ExtensionContext,
  stateManager: StateManager,
  eventStore?: EventStore,
): void {
  const runUpdate = (): void => {
    cognitionPipeline?.scheduleUpdate(eventStore);
  };
  if (cognitionInitPromise) {
    void cognitionInitPromise.then(runUpdate);
    return;
  }
  cognitionInitPromise = new Promise((resolve) => {
    setTimeout(() => {
      void (async () => {
        try {
          const [{ CognitionPipeline: Pipeline }, { CodeGraphParserService: ParserService }] =
            await Promise.all([
              import('./cognition/cognitionPipeline'),
              import('./cognition/codeGraphParserService'),
            ]);
          cognitionPipeline = new Pipeline(stateManager);
          codeGraphParser = new ParserService(cognitionPipeline, () => stateManager.getPrimaryFolder());
          codeGraphParser.activate(context);
          cognitionPipeline.scheduleUpdate(eventStore);
        } catch (err) {
          cognitionInitPromise = undefined;
          console.warn(`[${PRODUCT_DISPLAY_NAME}] cognition services init failed:`, err);
        } finally {
          resolve();
        }
      })();
    }, COGNITION_DEFER_MS);
  });
}

/** Baseline for “session shift” detection (Current focus + top paths). Reset on workspace sync / Start fresh. */
let sessionBoundaryBaseline: { focus: string; paths: string[] } | undefined;
let sessionBoundaryCooldownUntil = 0;
let sessionBoundaryPromptLock = false;
const SESSION_SHIFT_COOLDOWN_MS = 90_000;

async function handleSessionBoundaryAfterTaskEdit(
  folder: vscode.WorkspaceFolder,
  newTask: string,
  stateManager: StateManager,
  refreshSidebar: () => void,
): Promise<void> {
  const st = stateManager.getCached(folder) ?? (await stateManager.load(folder));
  const paths = topWorkspacePathsFromState(st);
  const nextFocus = (newTask ?? '').trim();

  if (!sessionBoundaryBaseline) {
    sessionBoundaryBaseline = { focus: nextFocus, paths: [...paths] };
    return;
  }

  const now = Date.now();
  if (now < sessionBoundaryCooldownUntil || sessionBoundaryPromptLock) {
    sessionBoundaryBaseline = { focus: nextFocus, paths: [...paths] };
    return;
  }

  if (
    !detectWorkspaceSessionShift(sessionBoundaryBaseline.focus, nextFocus, sessionBoundaryBaseline.paths, paths)
  ) {
    sessionBoundaryBaseline = { focus: nextFocus, paths: [...paths] };
    return;
  }

  sessionBoundaryPromptLock = true;
  try {
    const pick = await vscode.window.showInformationMessage(
      'Detected a major workspace shift. Start a fresh AI context session?',
      'Start fresh',
      'Keep current',
    );
    if (pick === 'Start fresh') {
      await vscode.commands.executeCommand('contora.startFreshAiSession');
    }
  } finally {
    sessionBoundaryPromptLock = false;
    sessionBoundaryCooldownUntil = Date.now() + SESSION_SHIFT_COOLDOWN_MS;
    const st2 = stateManager.getCached(folder) ?? (await stateManager.load(folder));
    sessionBoundaryBaseline = {
      focus: (st2.currentTask ?? '').trim(),
      paths: topWorkspacePathsFromState(st2),
    };
    refreshSidebar();
  }
}

function createEventStore(stateManager: StateManager, context: vscode.ExtensionContext): EventStore {
  return new EventStore(eventBufferCap(), (ev) => {
    cognitionPipeline?.ingestEvent(ev);
    const persist = vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION).get<boolean>('persistEventLog');
    if (persist === false) {
      return;
    }
    const folder = stateManager.getPrimaryFolder();
    if (!folder) {
      return;
    }
    void (async () => {
      try {
        const st = stateManager.getCached(folder) ?? (await stateManager.load(folder));
        const sid = st.sessionId ?? 'unknown';
        await appendEventJsonl(folder.uri.fsPath, sid, ev);
        scheduleDashboardWake(context, folder.uri.fsPath, ev.type);
      } catch {
        /* ignore IO errors */
      }
    })();
  });
}

async function ensureIgnoreMatcher(folder: vscode.WorkspaceFolder): Promise<IgnoreMatcher> {
  const cfg = vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION);
  workspaceIgnoreMatcher = await IgnoreMatcher.forWorkspaceRoot(
    folder.uri.fsPath,
    cfg.get<boolean>('useDefaultIgnoreRules') !== false,
    cfg.get<string[]>('extraIgnoreSubstrings') ?? [],
  );
  return workspaceIgnoreMatcher;
}

function bindIgnoreFileWatcher(folder: vscode.WorkspaceFolder, matcher: IgnoreMatcher): void {
  disposeIgnoreWatchers();
  const bindOne = (pattern: string) => {
    const w = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, pattern));
    const reload = (): void => {
      void matcher.reloadWorkspaceFile(folder.uri.fsPath);
    };
    w.onDidChange(reload);
    w.onDidCreate(reload);
    w.onDidDelete(reload);
    ignoreDisposables.push(w);
  };
  bindOne(CONTORA_IGNORE_FILE);
  bindOne(CONTORA_LEGACY_IGNORE_FILE);
}

async function mergeDiskIfEnabled(stateManager: StateManager, es: EventStore | undefined): Promise<void> {
  if (!es || !mergeDiskEventLogEnabled()) {
    return;
  }
  const folder = stateManager.getPrimaryFolder();
  if (!folder) {
    return;
  }
  try {
    const st = stateManager.getCached(folder) ?? (await stateManager.load(folder));
    const sid = st.sessionId ?? 'unknown';
    const disk = await EventLog.replayRecent(folder.uri.fsPath, sid, eventBufferCap());
    es.mergeFromDisk(disk);
  } catch {
    /* ignore */
  }
}

function startScanners(
  stateManager: StateManager,
  eventStore: EventStore,
  onAfterPersist?: () => void,
  options?: { deferInitialScan?: boolean },
): WorkspaceScanner[] {
  disposeScanners();
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    return [];
  }
  const next: WorkspaceScanner[] = [];
  for (const folder of folders) {
    const s = new WorkspaceScanner(folder, stateManager, eventStore, onAfterPersist);
    s.start(options);
    next.push(s);
  }
  scanners = next;
  return next;
}

let workspaceBootstrapPromise: Promise<void> | undefined;

function scheduleSidebarRefresh(sidebar: ContoraSidebarProvider): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = undefined;
      void sidebar.refresh();
    }, 180);
  };
}

function scheduleSidebarRefreshFromEditor(sidebar: ContoraSidebarProvider): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = undefined;
      void sidebar.refreshLight();
    }, 450);
  };
}

export function activate(context: vscode.ExtensionContext): void {
  void import('@contora/state-core').catch((err) => {
    console.error(
      `[${PRODUCT_DISPLAY_NAME}] Failed to load @contora/state-core — run "npm run compile" and Reload Window:`,
      err,
    );
    void vscode.window.showErrorMessage(
      `${PRODUCT_DISPLAY_NAME}: state-core failed to load. Run npm run compile in the repo, then Developer: Reload Window.`,
    );
  });

  const stateManager = new StateManager();
  void (async () => {
    const folder = stateManager.getPrimaryFolder();
    if (folder) {
      try {
        await stateManager.load(folder);
      } catch {
        /* warm cache for sidebar first paint */
      }
    }
  })();
  const memoryBuilder = new MemoryBuilder();
  const modeEngine = new ModeEngine();

  let sidebar!: ContoraSidebarProvider;
  const onAfterTaskUpdated = (folder: vscode.WorkspaceFolder, task: string): void => {
    void handleSessionBoundaryAfterTaskEdit(folder, task, stateManager, () => {
      void sidebar.refresh();
    });
  };
  sidebar = new ContoraSidebarProvider(
    context,
    stateManager,
    undefined,
    onAfterTaskUpdated,
  );

  registerDashboardStatusBar(context, () => stateManager.getPrimaryFolder());

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ContoraSidebarProvider.viewId, sidebar, {
      // false = fresh HTML on reopen; avoids stale/crashed webview showing blank forever
      webviewOptions: { retainContextWhenHidden: false },
    }),
  );

  const refreshSidebarDebounced = scheduleSidebarRefresh(sidebar);
  const refreshFromEditorDebounced = scheduleSidebarRefreshFromEditor(sidebar);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      refreshFromEditorDebounced();
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.scheme === 'file' && e.document.isDirty) {
        refreshFromEditorDebounced();
      }
    }),
    vscode.window.tabGroups.onDidChangeTabs(() => {
      refreshFromEditorDebounced();
    }),
  );

  const onAfterScannerPersist = (): void => {
    refreshSidebarDebounced();
    if (cognitionPipeline) {
      cognitionPipeline.scheduleUpdate(globalEventStore);
    } else {
      scheduleCognitionServices(context, stateManager, globalEventStore);
    }
    const folder = stateManager.getPrimaryFolder();
    if (folder) {
      scheduleDashboardWake(context, folder.uri.fsPath, 'scanner-persist');
    }
  };

  const syncWorkspace = async (): Promise<void> => {
    globalEventStore = createEventStore(stateManager, context);
    sidebar.setEventStore(globalEventStore);
    const folder = stateManager.getPrimaryFolder();
    sidebar.setWorkspaceFolder(folder);
    if (!folder) {
      disposeScanners();
      disposeIgnoreWatchers();
      workspaceIgnoreMatcher = undefined;
      sessionBoundaryBaseline = undefined;
      return;
    }

    // Paint sidebar shell from cache immediately (before disk / scanners).
    void sidebar.refresh();

    const matcherPromise = ensureIgnoreMatcher(folder);
    void mergeDiskIfEnabled(stateManager, globalEventStore);

    const [st0, matcher] = await Promise.all([
      loadStateWithTimeout(stateManager, folder),
      matcherPromise,
    ]);
    void sidebar.refresh();

    const eventCount = globalEventStore?.getAll().length ?? 0;

    bindIgnoreFileWatcher(folder, matcher);
    startScanners(stateManager, globalEventStore, onAfterScannerPersist, { deferInitialScan: true });

    // Background: dual-mode scan must not block scanners or sidebar first paint.
    void (async () => {
      try {
        const { applyDualModeWorkspaceInput } = await import('./adapters/workspaceBootstrap');
        const stMerged = await applyDualModeWorkspaceInput(folder, st0, eventCount);
        if (JSON.stringify(stMerged) !== JSON.stringify(st0)) {
          await stateManager.replace(folder, stMerged);
          void sidebar.refresh();
        }
      } catch (err) {
        console.warn(`[${PRODUCT_DISPLAY_NAME}] dual-mode background merge failed:`, err);
      }
    })();

    scheduleCognitionServices(context, stateManager, globalEventStore);
    sessionBoundaryBaseline = {
      focus: (st0.currentTask ?? '').trim(),
      paths: topWorkspacePathsFromState(st0),
    };

    setTimeout(() => {
      scheduleRuntimeBootstrap(context, folder.uri.fsPath);
    }, RUNTIME_BOOTSTRAP_DEFER_MS);

    setTimeout(() => {
      void ideControlEnsureReady(folder).catch(() => undefined);
    }, CONTROL_ENSURE_DEFER_MS);
  };

  const runWorkspaceBootstrap = (): Promise<void> => {
    if (!workspaceBootstrapPromise) {
      workspaceBootstrapPromise = Promise.race([
        syncWorkspace(),
        new Promise<void>((_, reject) => {
          setTimeout(
            () => reject(new Error('workspace bootstrap timeout')),
            WORKSPACE_BOOTSTRAP_TIMEOUT_MS,
          );
        }),
      ]).catch((err) => {
        workspaceBootstrapPromise = undefined;
        console.error(`[${PRODUCT_DISPLAY_NAME}] workspace bootstrap failed:`, err);
        throw err;
      });
    }
    return workspaceBootstrapPromise;
  };

  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => {
    workspaceBootstrapPromise = undefined;
    void runWorkspaceBootstrap();
  }));

  const ensureWorkspaceReady = async (): Promise<boolean> => {
    try {
      await runWorkspaceBootstrap();
      return !!globalEventStore;
    } catch {
      return false;
    }
  };

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      try {
        if (e.affectsConfiguration('contora.maxEventBuffer')) {
          await syncWorkspace();
          return;
        }
        if (e.affectsConfiguration('contora.mergeDiskEventLog')) {
          await mergeDiskIfEnabled(stateManager, globalEventStore);
          return;
        }
        if (
          e.affectsConfiguration('contora.useDefaultIgnoreRules') ||
          e.affectsConfiguration('contora.extraIgnoreSubstrings')
        ) {
          const folder = stateManager.getPrimaryFolder();
          if (folder && workspaceIgnoreMatcher) {
            const cfg = vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION);
            workspaceIgnoreMatcher.updateSettings(
              cfg.get<boolean>('useDefaultIgnoreRules') !== false,
              cfg.get<string[]>('extraIgnoreSubstrings') ?? [],
            );
          }
        }
        if (
          e.affectsConfiguration('contora.cilAiEnabled') ||
          e.affectsConfiguration('contora.cilIntentRouter') ||
          e.affectsConfiguration('contora.aiProvider') ||
          e.affectsConfiguration('contora.openaiModel') ||
          e.affectsConfiguration('contora.anthropicModel') ||
          e.affectsConfiguration('contora.googleModel') ||
          e.affectsConfiguration('contora.deepseekModel') ||
          e.affectsConfiguration('contora.openaiBaseUrl') ||
          e.affectsConfiguration('contora.deepseekBaseUrl')
        ) {
          const folder = stateManager.getPrimaryFolder();
          if (folder) {
            void syncCilLlmConfigFromIde(folder.uri.fsPath).catch(() => undefined);
          }
        }
      } finally {
        const refreshKeys = [
          'contora.aiProvider',
          'contora.cilAiEnabled',
          'contora.cilIntentRouter',
          'contora.defaultAIMode',
          'contora.exportFormat',
          'contora.exportTokenBudget',
          'contora.appendAiSummaryOnExport',
        ];
        if (refreshKeys.some((k) => e.affectsConfiguration(k))) {
          void sidebar.refresh();
        }
      }
    }),
  );

  context.subscriptions.push(
    context.secrets.onDidChange((ev) => {
      if (ev.key.startsWith('contora.apiKey.')) {
        void sidebar.refresh();
      }
    }),
  );

  const shouldIgnore = (): ((p: string) => boolean) => {
    const m = workspaceIgnoreMatcher;
    if (m) {
      return (p: string) => m.shouldIgnore(p);
    }
    const cfg = vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION);
    return (p: string) =>
      shouldIgnoreWorkspacePath(p, cfg.get<boolean>('useDefaultIgnoreRules') !== false, cfg.get<string[]>('extraIgnoreSubstrings') ?? []);
  };

  const contoraKeys = new ContoraKeyManager(context.secrets);
  bindCilLlmKeyManager(contoraKeys);
  registerLlmSettingsHandlers(context, contoraKeys, stateManager);
  const aiProviders = new ProviderManager(contoraKeys);

  const runExport = async (
    reporter?: ExportProgressReporter,
    showToast = true,
    mode: ExportMode = 'cognitive-snapshot',
  ) => {
    const result = await runExportAIContext(
      {
        stateManager,
        ensureWorkspaceReady,
        ensureIgnoreMatcher,
        getEventStore: () => globalEventStore,
        getScanners: () => scanners,
        getCognitionPipeline: () => cognitionPipeline,
        shouldIgnore,
        memoryBuilder,
        modeEngine,
        aiProviders,
        eventsInPrompt,
        readExportFormat,
        onAfterGovernanceReview: () => {
          void sidebar.refresh();
        },
      },
      reporter,
      mode,
    );
    if (showToast && result.message) {
      if (result.ok) {
        await vscode.window.showInformationMessage(result.message);
      } else {
        await vscode.window.showWarningMessage(result.message);
      }
    }
    return result;
  };

  sidebar.registerExportRunner(async (reporter, mode) => runExport(reporter, false, mode));

  context.subscriptions.push(
    vscode.commands.registerCommand('contora.exportAIContext', () =>
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `${PRODUCT_DISPLAY_NAME}: Transfer Context`,
          cancellable: false,
        },
        async (progress) => {
          let lastPercent = 0;
          await runExport((update) => {
            const increment = Math.max(0, update.percent - lastPercent);
            lastPercent = update.percent;
            progress.report({ message: update.label, increment });
          }, true, 'cognitive-snapshot');
        },
      ),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('contora.exportFullIntelligence', () =>
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `${PRODUCT_DISPLAY_NAME}: Transfer Intelligence`,
          cancellable: false,
        },
        async (progress) => {
          let lastPercent = 0;
          await runExport((update) => {
            const increment = Math.max(0, update.percent - lastPercent);
            lastPercent = update.percent;
            progress.report({ message: update.label, increment });
          }, true, 'full-intelligence');
        },
      ),
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('contora.smartGovernanceInject', () =>
      runGovernanceInject(stateManager, 'smart'),
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('contora.diffGovernanceInject', () =>
      runGovernanceInject(stateManager, 'diff'),
    ),
  );

  const runStartFreshAiSession = async (): Promise<void> => {
    const folder = stateManager.getPrimaryFolder();
    if (!folder) {
      await vscode.window.showWarningMessage(`${PRODUCT_DISPLAY_NAME}: Open a folder workspace first.`);
      return;
    }
    if (!(await ensureWorkspaceReady())) {
      return;
    }
    const es = globalEventStore;
    if (!es) {
      return;
    }
    for (const s of scanners) {
      await s.flushNow();
    }
    const lastIntentUri = vscode.Uri.joinPath(folder.uri, '.contora', 'last-intent.json');
    try {
      await vscode.workspace.fs.delete(lastIntentUri, { useTrash: false });
    } catch {
      /* missing or unreadable file is OK */
    }
    clearLastIntentStore();
    clearSemanticSummaryCache();
    await cognitionPipeline?.clearDerivedArtifacts(folder);
    es.clear();
    await stateManager.update(folder, { sessionId: newSessionId() });
    await mergeDiskIfEnabled(stateManager, es);
    const st0 = stateManager.getCached(folder) ?? (await stateManager.load(folder));
    sessionBoundaryBaseline = {
      focus: (st0.currentTask ?? '').trim(),
      paths: topWorkspacePathsFromState(st0),
    };
    void sidebar.refresh();
    await vscode.window.showInformationMessage(
      `${PRODUCT_DISPLAY_NAME}: Fresh AI context session started. Session activity was cleared; workspace files and Git are unchanged.`,
    );
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('contora.startFreshAiSession', runStartFreshAiSession),
  );

  setTimeout(() => {
    void import('./ai/registerPhase3')
      .then(({ registerPhase3AiRuntime }) => {
  registerPhase3AiRuntime(
    context,
    {
      stateManager,
      getEventStore: () => globalEventStore,
      memoryBuilder,
      modeEngine,
      flushScanners: async () => {
        for (const s of scanners) {
          await s.flushNow();
        }
      },
      eventsInPrompt,
      exportTokenBudget,
      maxPriorityFilesCap,
      shouldIgnore,
      refreshSidebar: () => {
        void sidebar.refresh();
      },
      flushCognition: async () => {
              if (!cognitionPipeline) {
                scheduleCognitionServices(context, stateManager, globalEventStore);
                await cognitionInitPromise;
              }
        await cognitionPipeline?.flushNow(globalEventStore);
      },
    },
    { keys: contoraKeys, providers: aiProviders },
  );
      })
      .catch((err) => {
        console.warn(`[${PRODUCT_DISPLAY_NAME}] Phase3 AI runtime registration failed:`, err);
      });
  }, 0);

  context.subscriptions.push(
    vscode.commands.registerCommand('contora.saveStateNow', async () => {
      const folder = stateManager.getPrimaryFolder();
      if (!folder) {
        await vscode.window.showWarningMessage(`${PRODUCT_DISPLAY_NAME}: Open a folder workspace first.`);
        return;
      }
      if (!(await ensureWorkspaceReady())) {
        return;
      }
      if (!workspaceIgnoreMatcher) {
        await ensureIgnoreMatcher(folder);
      }
      for (const s of scanners) {
        await s.flushNow();
      }
      const state = await stateManager.load(folder);
      if (writeLatestMemoryOnSaveEnabled() && globalEventStore) {
        try {
          const ig = shouldIgnore();
          const mode = modeEngine.normalizeMode(
            vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION).get<string>('defaultAIMode'),
          );
          const strategy = getModeStrategy(mode);
          const evAll = globalEventStore.getAll();
          const evRank = evAll.length > 500 ? evAll.slice(-500) : evAll;
          const pipe = rankContextFilesWithDebug(state, evRank, strategy, ig, 2);
          let ranked = pipe.ranked;
          const analysis = analyzeActivity(evRank, state, ig);
          const sumBlock = buildSemanticSummaryBlock(analysis, state, 8, evRank, ig, {
            rankingDebug: pipe.debugExplanations,
          });
          const semanticMd = sumBlock.markdown;
          const budget = exportTokenBudget();
          let rankedForTop = ranked;
          if (budget > 0) {
            rankedForTop = allocate(ranked, budget, { semanticMarkdown: semanticMd, graphMarkdown: '' }).priorityItems;
          }
          const take = maxPriorityFilesCap(strategy.maxPriorityFiles);
          const priorityTop = rankedForTop.slice(0, take);
          const recent = globalEventStore.getLast(eventsInPrompt());
          const memory = memoryBuilder.build(state, recent, state.sessionId ?? 'unknown');
          applyIgnoreToMemory(memory, ig);
          memory.priorityFiles = priorityTop;
          memory.semanticSummary = semanticMd;
          const baseQ = analyzeContextQuality({
            estimatedSemanticTokens: estimateTokens(semanticMd),
            exportTokenBudget: budget,
            priorityPathCount: priorityTop.length,
            duplicatePathCount: countDuplicatePaths([
              ...priorityTop.map((p) => p.path),
              ...state.openFiles,
              ...state.recentFiles.slice(0, 24),
            ]),
            eventCount: evRank.length,
            lowSignalRatio:
              evRank.length > 0
                ? 1 - Math.min(1, Object.keys(analysis.fileActivity).length / evRank.length)
                : 0,
          });
          const quality = {
            score: baseQ.score,
            warnings: [...baseQ.warnings, ...listIgnoredPathIssues(priorityTop.map((p) => p.path), ig)],
          };
          const intentEval = await loadUsableIntentFocusLines(folder, state);
          const fp = await writeLatestMemoryJson(folder.uri.fsPath, {
            savedAt: Date.now(),
            sessionId: state.sessionId ?? 'unknown',
            mode,
            strategyLabel: strategy.strategyLabel,
            memory,
            analysis,
            intelligence: sumBlock.intelligence,
            quality,
            lifecycle: {
              qualityScore: quality.score,
              hasUsableAiIntent: !!intentEval?.length,
              heuristicIntentWindowHours: 2,
            },
          });
          void fp;
        } catch {
          /* ignore memory mirror errors */
        }
      }
      await sidebar.refresh();
      await vscode.window.showInformationMessage(`${PRODUCT_DISPLAY_NAME}: State saved to .contora/state.json.`);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('contora.injectRuntimeHandoff', async () => {
      const folder = stateManager.getPrimaryFolder();
      if (!folder) {
        await vscode.window.showWarningMessage(`${PRODUCT_DISPLAY_NAME}: Open a folder workspace first.`);
        return;
      }
      await runInjectRuntimeHandoff(folder.uri.fsPath);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('contora.askContorium', () => runAskContorium()),
    vscode.commands.registerCommand('contora.cilHistory', () => sidebar.showCilHistory()),
    vscode.commands.registerCommand('contora.cilDecisions', () => sidebar.showCilDecisions()),
    vscode.commands.registerCommand('contora.cilAiTest', async () => {
      await vscode.commands.executeCommand('contora.testLlmConnection');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('contora.showDashboard', async () => {
      const folder = stateManager.getPrimaryFolder();
      if (!folder) {
        await vscode.window.showWarningMessage(`${PRODUCT_DISPLAY_NAME}: Open a folder workspace first.`);
        return;
      }
      await showRuntimeDashboard(folder);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('contora.hideDashboard', async () => {
      const folder = stateManager.getPrimaryFolder();
      if (!folder) {
        return;
      }
      await hideRuntimeDashboard(folder);
    }),
  );

  async function runControlGovernance(): Promise<void> {
    await sidebar.showGovernanceOverview();
  }

  async function runControlCheck(): Promise<void> {
    await sidebar.showChangeReview();
  }

  async function runControlIntent(): Promise<void> {
    await sidebar.promptEditDirection();
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('contora.controlGovernance', runControlGovernance),
    vscode.commands.registerCommand('contora.getGovernance', runControlGovernance),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('contora.controlCheck', runControlCheck),
    vscode.commands.registerCommand('contora.checkAction', runControlCheck),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('contora.controlIntent', runControlIntent),
    vscode.commands.registerCommand('contora.updateProjectIntent', runControlIntent),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('contora.restoreSession', async () => {
      const folder = stateManager.getPrimaryFolder();
      if (!folder) {
        await vscode.window.showWarningMessage(`${PRODUCT_DISPLAY_NAME}: Open a folder workspace first.`);
        return;
      }
      const st = await stateManager.load(folder);
      await restoreEditorsFromState(folder, st);
      await vscode.window.showInformationMessage(`${PRODUCT_DISPLAY_NAME}: Opened editors from saved state.`);
    }),
  );

  context.subscriptions.push({ dispose: () => disposeScanners() });
  context.subscriptions.push({ dispose: () => disposeIgnoreWatchers() });
  context.subscriptions.push({ dispose: () => cognitionPipeline?.dispose() });
  context.subscriptions.push({ dispose: () => codeGraphParser?.dispose() });

  // Return quickly from activate; bootstrap scanners / disk replay after a short yield.
  setTimeout(() => void runWorkspaceBootstrap(), BOOTSTRAP_DEFER_MS);
}

export function deactivate(): void {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (folder) {
    void endDashboardSession(folder);
  }
  disposeScanners();
  disposeIgnoreWatchers();
  cognitionPipeline?.dispose();
  codeGraphParser?.dispose();
}
