import * as path from 'node:path';

export const COGNITIVE_EVENTS_DIR = 'cognitive-events';
export const ADR_DIR = 'decisions';
export const SNAPSHOTS_DIR = 'snapshots';
export const MODULE_HISTORY_DIR = 'module-history';
export const KNOWLEDGE_DIR = 'knowledge';
export const CIL_INDEX_FILE = 'cil_index.json';
export const COGNITIVE_HEALTH_FILE = 'cognitive-health.json';

export function cilRoot(workspaceRoot: string): string {
  return path.join(path.resolve(workspaceRoot), '.contora');
}

export function cognitiveEventsDir(workspaceRoot: string): string {
  return path.join(cilRoot(workspaceRoot), COGNITIVE_EVENTS_DIR);
}

export function cognitiveEventPath(workspaceRoot: string, eventId: string): string {
  const date = eventId.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? 'unknown';
  return path.join(cognitiveEventsDir(workspaceRoot), `${date}_${eventId}.json`);
}

export function adrDir(workspaceRoot: string): string {
  return path.join(cilRoot(workspaceRoot), ADR_DIR);
}

export function adrPath(workspaceRoot: string, adrId: string): string {
  return path.join(adrDir(workspaceRoot), `${adrId}.json`);
}

export function snapshotsDir(workspaceRoot: string): string {
  return path.join(cilRoot(workspaceRoot), SNAPSHOTS_DIR);
}

export function snapshotPath(workspaceRoot: string, snapshotId: string): string {
  return path.join(snapshotsDir(workspaceRoot), `${snapshotId}.json`);
}

export function moduleHistoryDir(workspaceRoot: string): string {
  return path.join(cilRoot(workspaceRoot), MODULE_HISTORY_DIR);
}

export function moduleHistoryPath(workspaceRoot: string, moduleSlug: string): string {
  return path.join(moduleHistoryDir(workspaceRoot), `${moduleSlug}.json`);
}

export function cilIndexPath(workspaceRoot: string): string {
  return path.join(cilRoot(workspaceRoot), CIL_INDEX_FILE);
}

export function decisionGraphPath(workspaceRoot: string): string {
  return path.join(adrDir(workspaceRoot), 'graph.json');
}

export function knowledgeDir(workspaceRoot: string): string {
  return path.join(cilRoot(workspaceRoot), KNOWLEDGE_DIR);
}

export function knowledgeEntityPath(workspaceRoot: string, entitySlug: string): string {
  return path.join(knowledgeDir(workspaceRoot), `${entitySlug}.json`);
}

export function knowledgeIndexPath(workspaceRoot: string): string {
  return path.join(knowledgeDir(workspaceRoot), '_index.json');
}

export function cognitiveHealthPath(workspaceRoot: string): string {
  return path.join(cilRoot(workspaceRoot), COGNITIVE_HEALTH_FILE);
}
