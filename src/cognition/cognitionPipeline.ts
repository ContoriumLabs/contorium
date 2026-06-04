import type * as vscode from 'vscode';
import type { EventStore } from '../core/engine/eventStore';
import { collectChangedPathsForInvalidation } from '../core/memory/memoryLifecycle';
import { readAndEvaluatePersistedIntent } from '../core/memory/intentStore';
import type { WorkspaceEvent } from '../core/models/events';
import { buildStateSummary, writeStateSummary } from '../intelligence';
import { buildIntentGraph, writeIntentGraph, readIntentGraph } from '../intent-graph';
import { deleteStateSummary } from '../intelligence/store';
import { deleteIntentGraph } from '../intent-graph/store';
import { deleteProjectBuiltState } from '../state-builder/store';
import { deleteConflictsArtifact } from '../state-engine';
import { deleteUnderstandingArtifacts } from '@contora/state-core';
import { rebuildProjectStateArtifacts } from '../state-builder/rebuild';
import type { StateManager } from '../state/stateManager';

const DEBOUNCE_MS = 7_000;
const BATCH_THRESHOLD = 20;

/**
 * v0.7 passive cognition feed — read-only on state.json, writes derived artifacts only.
 * Hooks: EventStore append + scanner persist debounce.
 */
export class CognitionPipeline {
  private pendingEvents = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private updateLock = false;
  private hotPaths: string[] = [];

  constructor(private readonly stateManager: StateManager) {}

  ingestEvent(_ev: WorkspaceEvent): void {
    this.pendingEvents++;
    if (this.pendingEvents >= BATCH_THRESHOLD) {
      void this.runUpdate();
      return;
    }
    this.scheduleDebounce();
  }

  scheduleUpdate(_eventStore?: EventStore, hotPaths?: string[]): void {
    if (hotPaths?.length) {
      this.hotPaths = [...new Set([...this.hotPaths, ...hotPaths.map((p) => p.replace(/\\/g, '/'))])].slice(
        -24,
      );
    }
    this.scheduleDebounce();
  }

  private scheduleDebounce(): void {
    if (this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      void this.runUpdate();
    }, DEBOUNCE_MS);
  }

  async flushNow(eventStore?: EventStore): Promise<void> {
    if (this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    await this.runUpdate(eventStore);
  }

  async clearDerivedArtifacts(folder: vscode.WorkspaceFolder): Promise<void> {
    await Promise.all([
      deleteStateSummary(folder),
      deleteIntentGraph(folder),
      deleteProjectBuiltState(folder),
      deleteConflictsArtifact(folder),
      deleteUnderstandingArtifacts(folder.uri.fsPath),
    ]);
    this.pendingEvents = 0;
  }

  dispose(): void {
    if (this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
  }

  private async runUpdate(eventStore?: EventStore): Promise<void> {
    if (this.updateLock) {
      return;
    }
    const folder = this.stateManager.getPrimaryFolder();
    if (!folder) {
      return;
    }
    this.updateLock = true;
    this.pendingEvents = 0;
    try {
      const state = this.stateManager.getCached(folder) ?? (await this.stateManager.load(folder));
      const es = eventStore;
      const events = es?.getAll() ?? [];
      const evWindow = events.length > 500 ? events.slice(-500) : events;
      const summary = buildStateSummary(state, evWindow);
      await writeStateSummary(folder, summary);

      const changedPaths = collectChangedPathsForInvalidation(state);
      const recentEditPaths = evWindow
        .filter(
          (e) =>
            e.type === 'file_save' ||
            e.type === 'file_focus' ||
            e.type === 'file_create' ||
            e.type === 'file_delete' ||
            e.type === 'file_rename',
        )
        .map((e) => {
          if (e.type === 'file_rename') {
            return e.newFile;
          }
          if ('file' in e) {
            return e.file;
          }
          return '';
        })
        .filter(Boolean);
      const allChanged = [...new Set([...changedPaths, ...recentEditPaths.slice(0, 24)])];

      const evaluated = await readAndEvaluatePersistedIntent(folder, state, es);
      const existing = await readIntentGraph(folder);
      const graph = buildIntentGraph({
        state,
        summary,
        changedPaths: allChanged,
        persistedIntent: evaluated?.file,
        intentUsable: evaluated?.usable,
        existing,
      });
      await writeIntentGraph(folder, graph);

      // L1 events → L2 state → L3 normalize → L4 snapshot (L5 intent graph does not feed snapshot)
      await rebuildProjectStateArtifacts({
        folder,
        state,
        events: evWindow,
        summary,
        extraHotPaths: this.hotPaths.splice(0),
      });
    } catch (err) {
      console.error('[Contorium] cognition pipeline update failed:', err);
    } finally {
      this.updateLock = false;
    }
  }
}
