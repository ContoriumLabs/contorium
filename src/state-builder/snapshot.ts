import { formatProjectSnapshotMarkdown as formatCore } from '@contora/state-core';
import { formatConflictsMarkdown } from '../state-engine';
import type { StateConflict } from '../state-engine/types';
import type { ProjectBuiltState } from './types';

/** Human-readable PROJECT SNAPSHOT for cross-AI handoff (disk artifact may include conflict audit). */
export function formatProjectSnapshotMarkdown(
  state: ProjectBuiltState,
  conflicts: readonly StateConflict[] = [],
): string {
  const base = formatCore(state);
  const conflictBlock = formatConflictsMarkdown(conflicts);
  if (!conflictBlock) {
    return base;
  }
  return `${base}${conflictBlock}\n`;
}

export { projectSnapshotBulletLines } from '@contora/state-core';
