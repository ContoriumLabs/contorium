import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  AnyHandoffArtifact,
  ChangeArtifact,
  HandoffArtifact,
  HandoffArtifactV1,
  ImpactArtifact,
  IntentArtifact,
  ProjectGraph,
  ProjectTimeline,
} from './types.js';
import { deleteProjectKnowledgeGraph, readProjectKnowledgeGraph } from './knowledgeGraph/store.js';

const LEGACY_ARTIFACTS = ['impact.json', 'intent.json'] as const;

function contoraPath(workspaceRoot: string, name: string): string {
  return path.join(workspaceRoot, '.contora', name);
}

async function readJson<T>(filePath: string): Promise<T | undefined> {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function unlinkQuiet(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    /* absent */
  }
}

/** Normalize V3.0 handoff → V3.1 shape on read. */
export function normalizeHandoff(raw: AnyHandoffArtifact | undefined): HandoffArtifact | undefined {
  if (!raw) {
    return undefined;
  }
  if (raw.version === 2 && 'current_focus' in raw) {
    return raw as HandoffArtifact;
  }
  const v1 = raw as HandoffArtifactV1;
  return {
    version: 2,
    generatedAt: v1.generatedAt,
    goal: v1.goal,
    current_focus: v1.intent,
    key_changes: [
      ...v1.changed.changedFiles.map((f: string) => ({
        symbol: f,
        kind: 'file' as const,
        change_type: 'modified' as const,
      })),
      ...v1.changed.changed_functions.map((s) => ({
        symbol: s,
        kind: 'function' as const,
        change_type: 'modified' as const,
      })),
      ...v1.changed.changed_classes.map((s) => ({
        symbol: s,
        kind: 'class' as const,
        change_type: 'modified' as const,
      })),
    ],
    impact_summary: {
      risk: v1.impact.risk_level,
      affected_modules: v1.impact.affected_modules,
      affected_functions: v1.impact.affected_functions,
      details: v1.impact.details,
    },
    next_actions: v1.next_actions.map((line) => ({
      action: 'continue' as const,
      target: line.slice(0, 48),
      reason: line,
    })),
    context_graph_refs: [],
    summary: v1.summary,
  };
}

/** Normalize V3.0 change.json on read. */
export function normalizeChange(raw: unknown): ChangeArtifact | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const r = raw as Record<string, unknown>;
  if (r.version === 2 && Array.isArray(r.key_changes)) {
    return raw as ChangeArtifact;
  }
  const legacy = raw as {
    version?: number;
    generatedAt?: number;
    changedFiles?: string[];
    changed_functions?: string[];
    changed_classes?: string[];
  };
  const files = legacy.changedFiles ?? [];
  return {
    version: 2,
    generatedAt: legacy.generatedAt ?? Date.now(),
    changed_files: files,
    key_changes: [
      ...files.map((f) => ({ symbol: f, kind: 'file' as const, change_type: 'modified' as const })),
      ...(legacy.changed_functions ?? []).map((s) => ({
        symbol: s,
        kind: 'function' as const,
        change_type: 'modified' as const,
      })),
      ...(legacy.changed_classes ?? []).map((s) => ({
        symbol: s,
        kind: 'class' as const,
        change_type: 'modified' as const,
      })),
    ],
  };
}

export async function readProjectGraph(workspaceRoot: string): Promise<ProjectGraph | undefined> {
  const g = await readJson<ProjectGraph>(contoraPath(workspaceRoot, 'graph.json'));
  if (!g) {
    return undefined;
  }
  return { ...g, version: 2 };
}

export async function readChangeArtifact(workspaceRoot: string): Promise<ChangeArtifact | undefined> {
  const raw = await readJson<unknown>(contoraPath(workspaceRoot, 'change.json'));
  return normalizeChange(raw);
}

export async function readHandoffArtifact(workspaceRoot: string): Promise<HandoffArtifact | undefined> {
  const raw = await readJson<AnyHandoffArtifact>(contoraPath(workspaceRoot, 'handoff.json'));
  return normalizeHandoff(raw);
}

export async function readProjectTimeline(workspaceRoot: string): Promise<ProjectTimeline | undefined> {
  return readJson<ProjectTimeline>(contoraPath(workspaceRoot, 'timeline.json'));
}

/** @deprecated V3.1 — impact merged into handoff.json */
export async function readImpactArtifact(workspaceRoot: string): Promise<ImpactArtifact | undefined> {
  const legacy = await readJson<ImpactArtifact>(contoraPath(workspaceRoot, 'impact.json'));
  if (legacy) {
    return legacy;
  }
  const handoff = await readHandoffArtifact(workspaceRoot);
  if (!handoff) {
    return undefined;
  }
  return {
    version: 1,
    generatedAt: handoff.generatedAt,
    affected_functions: handoff.impact_summary.affected_functions,
    affected_modules: handoff.impact_summary.affected_modules,
    risk: handoff.impact_summary.risk,
    risk_level: handoff.impact_summary.risk,
    details: handoff.impact_summary.details,
  };
}

function confidenceFromHandoff(handoff: HandoffArtifact): number {
  switch (handoff.impact_summary.risk) {
    case 'high':
      return 0.88;
    case 'medium':
      return 0.72;
    default:
      return 0.58;
  }
}

/** @deprecated V3.1 — intent merged into handoff.json */
export async function readIntentArtifact(workspaceRoot: string): Promise<IntentArtifact | undefined> {
  const legacy = await readJson<IntentArtifact>(contoraPath(workspaceRoot, 'intent.json'));
  if (legacy) {
    return legacy;
  }
  const handoff = await readHandoffArtifact(workspaceRoot);
  if (!handoff) {
    return undefined;
  }
  const kg = await readProjectKnowledgeGraph(workspaceRoot);
  const fromGraph = kg?.snapshot?.graphSummary?.avgConfidence;
  const confidence =
    fromGraph && fromGraph > 0 ? fromGraph : confidenceFromHandoff(handoff);
  return {
    version: 1,
    generatedAt: handoff.generatedAt,
    intent: handoff.current_focus,
    confidence,
    signals: handoff.key_changes.slice(0, 4).map((k) => k.symbol),
  };
}

export async function writeUnderstandingArtifacts(
  workspaceRoot: string,
  artifacts: {
    graph: ProjectGraph;
    change: ChangeArtifact;
    handoff: HandoffArtifact;
    timeline: ProjectTimeline;
  },
): Promise<void> {
  const root = path.resolve(workspaceRoot);
  await Promise.all([
    writeJson(contoraPath(root, 'graph.json'), artifacts.graph),
    writeJson(contoraPath(root, 'change.json'), artifacts.change),
    writeJson(contoraPath(root, 'handoff.json'), artifacts.handoff),
    writeJson(contoraPath(root, 'timeline.json'), artifacts.timeline),
    ...LEGACY_ARTIFACTS.map((name) => unlinkQuiet(contoraPath(root, name))),
  ]);
}

export async function deleteUnderstandingArtifacts(workspaceRoot: string): Promise<void> {
  const names = ['graph.json', 'change.json', 'handoff.json', 'timeline.json', ...LEGACY_ARTIFACTS];
  await Promise.all([
    ...names.map((name) => unlinkQuiet(contoraPath(workspaceRoot, name))),
    deleteProjectKnowledgeGraph(workspaceRoot),
  ]);
}
