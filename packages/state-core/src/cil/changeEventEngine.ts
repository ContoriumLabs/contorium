import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { readStateJson } from '../bootstrap/bootstrapState.js';
import { readAllCognitiveEvents } from './eventStore.js';
import {
  collectWorkspaceDependencyNames,
  detectDependencyManifestChanges,
  TECH_TERM_TO_PACKAGES,
} from '../lifecycle/dependencyInventory.js';

export const CHANGE_EVENT_SCHEMA = 'contorium.change_events.v1' as const;

export type ChangeEventType =
  | 'CODE_CHANGE'
  | 'DEPENDENCY_CHANGE'
  | 'DEPENDENCY_REMOVAL'
  | 'ARCHITECTURE_CHANGE'
  | 'OWNER_CHANGE'
  | 'BUSINESS_CHANGE';

export type ChangeEventSource =
  | 'git'
  | 'ide'
  | 'mcp'
  | 'filesystem'
  | 'dependency'
  | 'human'
  | 'cognitive'
  | 'candidate';

export interface ChangeEvent {
  id: string;
  type: ChangeEventType;
  source: ChangeEventSource;
  time: string;
  files?: string[];
  detail?: string;
  /** Present for AI-inferred candidate events (优化.md §4.1 C). */
  confidence?: number;
  status?: 'confirmed' | 'candidate';
}

function eventId(prefix: string, seed: string): string {
  return `${prefix}_${seed.replace(/[^\w.-]+/g, '_').slice(0, 48)}`;
}

function dependencyBaselinePath(workspaceRoot: string): string {
  return path.join(path.resolve(workspaceRoot), '.contora', 'governance', 'dependency_baseline.json');
}

async function readDependencyBaseline(workspaceRoot: string): Promise<Set<string> | null> {
  try {
    const raw = JSON.parse(await fs.readFile(dependencyBaselinePath(workspaceRoot), 'utf8')) as {
      packages?: string[];
    };
    if (Array.isArray(raw.packages)) {
      return new Set(raw.packages.map((p) => p.toLowerCase()));
    }
  } catch {
    // no baseline yet
  }
  return null;
}

async function writeDependencyBaseline(workspaceRoot: string, packages: Set<string>): Promise<void> {
  const file = dependencyBaselinePath(workspaceRoot);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(
    file,
    `${JSON.stringify(
      {
        schema: 'contorium.dependency_baseline.v1',
        updated_at: new Date().toISOString(),
        packages: [...packages].sort(),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

/** Infer candidate architecture/business events from narrative (confidence < 1, status candidate). */
function inferCandidateEvents(narrative: string, now: string): ChangeEvent[] {
  const out: ChangeEvent[] = [];
  const n = narrative.toLowerCase();

  if (/migrat(?:e|ing|ion)|rewrite|re-architect|new stack|replace .+ with/i.test(narrative)) {
    out.push({
      id: eventId('cand_arch', 'migration'),
      type: 'ARCHITECTURE_CHANGE',
      source: 'candidate',
      time: now,
      detail: 'Potential architecture migration detected in workspace narrative',
      confidence: 0.7,
      status: 'candidate',
    });
  }

  if (/switch(?:ing)?\s+to\s+(postgres|mysql|mongodb|redis|sqlite)/i.test(narrative)) {
    const m = narrative.match(/switch(?:ing)?\s+to\s+(postgres|mysql|mongodb|redis|sqlite)/i);
    out.push({
      id: eventId('cand_dep', m?.[1] ?? 'switch'),
      type: 'DEPENDENCY_CHANGE',
      source: 'candidate',
      time: now,
      detail: `Potential dependency switch detected: ${m?.[0] ?? 'stack change'}`,
      confidence: 0.65,
      status: 'candidate',
    });
  }

  if (/deprecat|remove redis|drop sqlite|without oauth|no longer use/i.test(n)) {
    out.push({
      id: eventId('cand_rem', 'removal'),
      type: 'DEPENDENCY_REMOVAL',
      source: 'candidate',
      time: now,
      detail: 'Potential dependency removal noted in narrative (candidate — needs confirmation)',
      confidence: 0.68,
      status: 'candidate',
    });
  }

  return out;
}

/** Collect unified change events from git, deps, cognitive events, and candidates (优化.md §4.1). */
export async function collectChangeEvents(workspaceRoot: string): Promise<ChangeEvent[]> {
  const [state, events, currentDeps] = await Promise.all([
    readStateJson(workspaceRoot).catch(() => null),
    readAllCognitiveEvents(workspaceRoot).catch(() => []),
    collectWorkspaceDependencyNames(workspaceRoot),
  ]);

  const out: ChangeEvent[] = [];
  const seen = new Set<string>();
  const now = new Date().toISOString();

  const push = (evt: ChangeEvent): void => {
    const key = `${evt.type}|${evt.detail ?? ''}|${(evt.files ?? []).join(',')}|${evt.status ?? 'confirmed'}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push(evt);
  };

  for (const file of state?.gitStaged ?? []) {
    push({
      id: eventId('git_staged', file),
      type: 'CODE_CHANGE',
      source: 'git',
      time: now,
      files: [file],
      detail: `Staged change: ${file}`,
      status: 'confirmed',
    });
  }

  for (const file of state?.gitWorking ?? []) {
    push({
      id: eventId('git_working', file),
      type: 'CODE_CHANGE',
      source: 'git',
      time: now,
      files: [file],
      detail: `Working tree change: ${file}`,
      status: 'confirmed',
    });
  }

  for (const file of (state?.recentFiles ?? []).slice(0, 24)) {
    push({
      id: eventId('recent', file),
      type: 'CODE_CHANGE',
      source: 'filesystem',
      time: now,
      files: [file],
      detail: `Recently touched: ${file}`,
      status: 'confirmed',
    });
  }

  // Manifest-touched paths → confirmed dependency scan trigger
  const manifestTouched = [...(state?.gitStaged ?? []), ...(state?.gitWorking ?? [])].filter((f) =>
    /package\.json$|package-lock\.json$|pnpm-lock\.yaml$|yarn\.lock$/i.test(f),
  );
  for (const file of manifestTouched) {
    push({
      id: eventId('manifest', file),
      type: 'DEPENDENCY_CHANGE',
      source: 'git',
      time: now,
      files: [file],
      detail: `Dependency manifest changed: ${file}`,
      status: 'confirmed',
    });
  }

  // Baseline diff → precise add/remove events
  const baseline = await readDependencyBaseline(workspaceRoot);
  if (baseline && currentDeps.size) {
    const { added, removed } = detectDependencyManifestChanges(baseline, currentDeps);
    for (const pkg of removed.slice(0, 12)) {
      const tech = Object.entries(TECH_TERM_TO_PACKAGES).find(([, pkgs]) =>
        pkgs.some((p) => p.toLowerCase() === pkg),
      )?.[0];
      push({
        id: eventId('dep_rm', pkg),
        type: 'DEPENDENCY_REMOVAL',
        source: 'dependency',
        time: now,
        detail: tech
          ? `${tech} dependency removed (${pkg})`
          : `Dependency removed: ${pkg}`,
        status: 'confirmed',
      });
    }
    for (const pkg of added.slice(0, 12)) {
      push({
        id: eventId('dep_add', pkg),
        type: 'DEPENDENCY_CHANGE',
        source: 'dependency',
        time: now,
        detail: `Dependency added: ${pkg}`,
        status: 'confirmed',
      });
    }
  }
  if (currentDeps.size) {
    await writeDependencyBaseline(workspaceRoot, currentDeps).catch(() => undefined);
  }

  for (const evt of events.slice(0, 32)) {
    if (!evt.files?.length && !evt.summary) {
      continue;
    }
    const blob = `${evt.title} ${evt.summary} ${evt.why ?? ''}`;
    const arch = /architecture|monolith|microservice|refactor/i.test(blob);
    const dep = /dependenc|package\.json|npm install|removed package/i.test(blob);
    push({
      id: eventId('cog', evt.id ?? evt.timestamp),
      type: arch ? 'ARCHITECTURE_CHANGE' : dep ? 'DEPENDENCY_CHANGE' : 'CODE_CHANGE',
      source: 'cognitive',
      time: evt.timestamp,
      files: evt.files,
      detail: evt.summary || evt.title,
      status: 'confirmed',
    });
  }

  const narrative = `${state?.currentTask ?? ''}\n${state?.notes ?? ''}`;
  if (/business scale|traffic (?:surge|growth|increased)|10x|100x/i.test(narrative)) {
    push({
      id: eventId('biz', 'scale'),
      type: 'BUSINESS_CHANGE',
      source: 'human',
      time: now,
      detail: 'Business scale or traffic growth noted in workspace narrative',
      status: 'confirmed',
    });
  }

  // AI/heuristic candidates — never auto-confirm (优化.md §4.1 C / §12)
  for (const cand of inferCandidateEvents(narrative, now)) {
    push(cand);
  }
  for (const evt of events.slice(0, 16)) {
    const blob = `${evt.title}\n${evt.summary}\n${evt.why ?? ''}`;
    if (/potential|maybe|consider|might|looks like/i.test(blob) && /migrat|rearchitect|replace/i.test(blob)) {
      push({
        id: eventId('cand_cog', evt.id ?? evt.timestamp),
        type: 'ARCHITECTURE_CHANGE',
        source: 'candidate',
        time: evt.timestamp,
        files: evt.files,
        detail: `Candidate: ${evt.summary || evt.title}`,
        confidence: Math.min(0.75, evt.confidence ?? 0.7),
        status: 'candidate',
      });
    }
  }

  return out.slice(0, 80);
}
