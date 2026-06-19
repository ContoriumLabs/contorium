import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  ChangeLog,
  CognitiveGraph,
  CognitiveIntent,
  CognitiveRisk,
  Constitution,
  Identity,
  ProjectCognitiveState,
  TruthLayer,
  UserRequestOverlay,
  GuardSession,
} from './types.js';

const GOVERNANCE_DIR = '.contora/governance';
const COGNITIVE_DIR = '.contora/cognitive';
const RUNTIME_DIR = '.contora/runtime';

function governancePath(workspaceRoot: string, name: string): string {
  return path.join(workspaceRoot, GOVERNANCE_DIR, name);
}

function cognitivePath(workspaceRoot: string, name: string): string {
  return path.join(workspaceRoot, COGNITIVE_DIR, name);
}

function runtimePath(workspaceRoot: string, name: string): string {
  return path.join(workspaceRoot, RUNTIME_DIR, name);
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

export async function governanceExists(workspaceRoot: string): Promise<boolean> {
  try {
    await fs.access(governancePath(workspaceRoot, 'constitution.json'));
    return true;
  } catch {
    return false;
  }
}

export async function readConstitution(workspaceRoot: string): Promise<Constitution | undefined> {
  return readJson<Constitution>(governancePath(workspaceRoot, 'constitution.json'));
}

export async function writeConstitution(workspaceRoot: string, data: Constitution): Promise<void> {
  await writeJson(governancePath(workspaceRoot, 'constitution.json'), data);
}

export async function readTruthLayer(workspaceRoot: string): Promise<TruthLayer | undefined> {
  return readJson<TruthLayer>(governancePath(workspaceRoot, 'truth.json'));
}

export async function writeTruthLayer(workspaceRoot: string, data: TruthLayer): Promise<void> {
  await writeJson(governancePath(workspaceRoot, 'truth.json'), data);
}

export async function readIdentity(workspaceRoot: string): Promise<Identity | undefined> {
  return readJson<Identity>(governancePath(workspaceRoot, 'identity.json'));
}

export async function writeIdentity(workspaceRoot: string, data: Identity): Promise<void> {
  await writeJson(governancePath(workspaceRoot, 'identity.json'), data);
}

export async function writeCognitiveState(
  workspaceRoot: string,
  data: ProjectCognitiveState,
): Promise<void> {
  await writeJson(cognitivePath(workspaceRoot, 'state.json'), data);
}

export async function writeCognitiveIntent(
  workspaceRoot: string,
  data: CognitiveIntent,
): Promise<void> {
  await writeJson(cognitivePath(workspaceRoot, 'intent.json'), data);
}

export async function writeCognitiveRisk(workspaceRoot: string, data: CognitiveRisk): Promise<void> {
  await writeJson(cognitivePath(workspaceRoot, 'risk.json'), data);
}

export async function writeCognitiveGraph(
  workspaceRoot: string,
  data: CognitiveGraph,
): Promise<void> {
  await writeJson(cognitivePath(workspaceRoot, 'graph.json'), data);
}

export async function readCognitiveState(
  workspaceRoot: string,
): Promise<ProjectCognitiveState | undefined> {
  return readJson<ProjectCognitiveState>(cognitivePath(workspaceRoot, 'state.json'));
}

export async function readCognitiveIntent(
  workspaceRoot: string,
): Promise<CognitiveIntent | undefined> {
  return readJson<CognitiveIntent>(cognitivePath(workspaceRoot, 'intent.json'));
}

export async function readCognitiveGraph(
  workspaceRoot: string,
): Promise<CognitiveGraph | undefined> {
  return readJson<CognitiveGraph>(cognitivePath(workspaceRoot, 'graph.json'));
}

/** User-owned request overlay (merged into derived cognitive — not a second truth). */
export async function readUserRequestOverlay(
  workspaceRoot: string,
): Promise<UserRequestOverlay | undefined> {
  return readJson<UserRequestOverlay>(cognitivePath(workspaceRoot, 'user-request.json'));
}

export async function writeUserRequestOverlay(
  workspaceRoot: string,
  data: UserRequestOverlay,
): Promise<void> {
  await writeJson(cognitivePath(workspaceRoot, 'user-request.json'), data);
}

export async function readGuardSession(workspaceRoot: string): Promise<GuardSession | undefined> {
  return readJson<GuardSession>(runtimePath(workspaceRoot, 'guard-session.json'));
}

export async function writeGuardSession(workspaceRoot: string, data: GuardSession): Promise<void> {
  await writeJson(runtimePath(workspaceRoot, 'guard-session.json'), data);
}

export async function readChangeLog(workspaceRoot: string): Promise<ChangeLog | undefined> {
  return readJson<ChangeLog>(runtimePath(workspaceRoot, 'change-log.json'));
}

export async function writeChangeLog(workspaceRoot: string, data: ChangeLog): Promise<void> {
  await writeJson(runtimePath(workspaceRoot, 'change-log.json'), data);
}

export async function appendExecutionLog(
  workspaceRoot: string,
  entry: Record<string, unknown>,
): Promise<void> {
  const dir = path.join(workspaceRoot, RUNTIME_DIR, 'execution_logs');
  await fs.mkdir(dir, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const filePath = path.join(dir, `${day}.jsonl`);
  await fs.appendFile(filePath, `${JSON.stringify(entry)}\n`, 'utf8');
}
