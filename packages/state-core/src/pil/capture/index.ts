import { readStateJson } from '../../bootstrap/bootstrapState.js';
import type { AdapterKind, BootstrapStateJson } from '../../types.js';
import { structureDecisionNode } from '../structure/decision.js';
import { preserveDecisionNode } from '../preserve/decision.js';
import { preserveStateJson } from '../preserve/state.js';
import type {
  CaptureDecisionInput,
  CaptureDecisionResult,
  CaptureFocusResult,
  CaptureNoteResult,
} from './types.js';

export type { CaptureDecisionInput, CaptureDecisionResult, CaptureFocusResult, CaptureNoteResult };

function emptyState(): BootstrapStateJson {
  return {
    sessionId: `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    currentTask: '',
    openFiles: [],
    recentFiles: [],
    gitStaged: [],
    gitWorking: [],
    notes: '',
    lastUpdated: Date.now(),
  };
}

/** PIL Capture — persist current project focus. */
export async function captureProjectFocus(
  workspaceRoot: string,
  focus: string,
  writer: AdapterKind = 'cli',
): Promise<CaptureFocusResult> {
  const trimmed = focus.trim();
  if (!trimmed) {
    throw new Error('focus is required');
  }
  const state = (await readStateJson(workspaceRoot)) ?? emptyState();
  state.currentTask = trimmed;
  state.lastUpdated = Date.now();
  await preserveStateJson(workspaceRoot, state, writer);
  return {
    workspaceRoot,
    captured: 'focus',
    focus: trimmed,
    lastUpdated: state.lastUpdated,
  };
}

/** PIL Capture — append a timestamped project note. */
export async function captureProjectNote(
  workspaceRoot: string,
  text: string,
  writer: AdapterKind = 'cli',
): Promise<CaptureNoteResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('text is required');
  }
  const state = (await readStateJson(workspaceRoot)) ?? emptyState();
  const stamp = new Date().toISOString();
  const line = `[${stamp}] ${trimmed}`;
  state.notes = state.notes.trim() ? `${state.notes.trim()}\n${line}` : line;
  state.lastUpdated = Date.now();
  await preserveStateJson(workspaceRoot, state, writer);
  return {
    workspaceRoot,
    captured: 'note',
    line,
    lastUpdated: state.lastUpdated,
  };
}

/** PIL Capture — record a decision (Structure → Preserve). */
export async function captureProjectDecision(
  workspaceRoot: string,
  input: CaptureDecisionInput,
): Promise<CaptureDecisionResult> {
  const selected = input.selected.trim();
  if (!selected) {
    throw new Error('selected is required');
  }
  const node = structureDecisionNode(input);
  const log = await preserveDecisionNode(workspaceRoot, node);
  return {
    workspaceRoot,
    captured: 'decision',
    decision_id: node.decision_id,
    selected,
    log_entries: log.entries.length,
  };
}
