import {
  appendExecutionLog,
  readChangeLog,
  writeChangeLog,
} from './store.js';
import { preActionCheck } from './executionGuard.js';
import type { ChangeRecord, PreActionCheckInput, RiskSeverity } from './types.js';
import type { ExecutionGuardResult } from './types.js';

const MAX_RECORDS = 200;

function newChangeId(): string {
  return `chg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function approvalFromGuard(guard: ExecutionGuardResult): ChangeRecord['approval'] {
  if (guard.action === 'block') {
    return 'rejected';
  }
  if (guard.action === 'confirm') {
    return 'pending';
  }
  return 'allow';
}

export interface ValidateAndTrackResult {
  guard: ExecutionGuardResult;
  /** @deprecated use guard.allow */
  validation: { status: string; reason: string; risk_level: RiskSeverity };
  recorded: boolean;
  change_id?: string;
  blocked: boolean;
}

/**
 * V3.2 Lightweight Guard + change log (no approval workflow).
 */
export async function validateAndTrackChange(
  workspaceRoot: string,
  action: PreActionCheckInput,
  source = 'mcp',
): Promise<ValidateAndTrackResult> {
  const guard = await preActionCheck(workspaceRoot, action);
  const blocked = guard.action === 'block' || (guard.action === 'confirm' && !guard.allow);

  const record: ChangeRecord = {
    id: newChangeId(),
    timestamp: Date.now(),
    change: action.description ?? `${action.type}${action.target_path ? `: ${action.target_path}` : ''}`,
    type: action.type === 'file_delete' ? 'file' : action.type === 'path_change' ? 'config' : 'file',
    risk_level: guard.risk_level,
    approval: approvalFromGuard(guard),
    target_path: action.target_path,
    source,
    validation: {
      status: guard.action === 'block' ? 'reject' : guard.action === 'confirm' ? 'require_approval' : 'allow',
      reason: guard.reason,
      risk_level: guard.risk_level,
      matched_rules: guard.detections.map((d) => `${d.type}:${d.detail.slice(0, 60)}`),
    },
  };

  const existing = (await readChangeLog(workspaceRoot)) ?? {
    version: 1 as const,
    generatedAt: Date.now(),
    records: [],
  };
  existing.generatedAt = Date.now();
  existing.records = [record, ...existing.records].slice(0, MAX_RECORDS);
  await writeChangeLog(workspaceRoot, existing);

  await appendExecutionLog(workspaceRoot, {
    ts: record.timestamp,
    event: 'execution_guard',
    action,
    guard,
    change_id: record.id,
    blocked,
  }).catch(() => undefined);

  const { recordGuardSession } = await import('./adapterHook.js');
  await recordGuardSession(workspaceRoot, guard, {
    source,
    target_path: action.target_path,
  }).catch(() => undefined);

  return {
    guard,
    validation: {
      status: record.validation!.status,
      reason: guard.reason,
      risk_level: guard.risk_level,
    },
    recorded: true,
    change_id: record.id,
    blocked,
  };
}

export async function listRecentChanges(
  workspaceRoot: string,
  limit = 20,
): Promise<ChangeRecord[]> {
  const log = await readChangeLog(workspaceRoot);
  return (log?.records ?? []).slice(0, limit);
}
