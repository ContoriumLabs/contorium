import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getProjectHandoff, type ChpHandoffFormat } from './understanding/chpHandoff.js';

const INJECTION_STATE_FILE = 'mcp.handoff-injection.json';
const CONTEXT_FILE = 'mcp.auto-context.md';
const BOOTSTRAP_FILE = 'runtime.bootstrap.json';

export type HandoffInjectionStatus = 'pending' | 'injected' | 'skipped';

export interface HandoffInjectionState {
  runtime_id: string;
  status: HandoffInjectionStatus;
  prompted_at: number;
  resolved_at?: number;
  context_file: string;
  format?: ChpHandoffFormat;
  /** Set on each new AI chat — skip/inject applies to this chat only. */
  chat_session_id?: string;
}

export interface PrepareHandoffOptions {
  /** New AI chat (MCP reconnect / new Agent window) — always re-prompt. */
  newChat?: boolean;
}

function contoraPath(workspaceRoot: string, name: string): string {
  return path.join(path.resolve(workspaceRoot), '.contora', name);
}

async function readJson<T>(filePath: string): Promise<T | undefined> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/** Active runtime = bootstrap marker + handoff available. */
export async function checkActiveRuntime(workspaceRoot: string): Promise<{
  active: boolean;
  runtime_id?: string;
}> {
  const root = path.resolve(workspaceRoot);
  const bootstrap = await readJson<{ runtime_id?: string }>(contoraPath(root, BOOTSTRAP_FILE));
  if (!bootstrap?.runtime_id) {
    return { active: false };
  }
  const handoff = await getProjectHandoff(root, 'compact');
  if (!handoff.found) {
    return { active: false, runtime_id: bootstrap.runtime_id };
  }
  return { active: true, runtime_id: bootstrap.runtime_id };
}

export async function readHandoffInjectionState(
  workspaceRoot: string,
): Promise<HandoffInjectionState | undefined> {
  return readJson<HandoffInjectionState>(contoraPath(workspaceRoot, INJECTION_STATE_FILE));
}

export async function readConfirmedHandoffContext(
  workspaceRoot: string,
): Promise<string | undefined> {
  const state = await readHandoffInjectionState(workspaceRoot);
  if (state?.status !== 'injected') {
    return undefined;
  }
  try {
    return await fs.readFile(contoraPath(workspaceRoot, CONTEXT_FILE), 'utf8');
  } catch {
    return undefined;
  }
}

export function buildInjectionPromptMessage(projectHint: string, compactLine?: string): string {
  const project = projectHint || 'this project';
  const lines = [
    `[?] Contorium Runtime active for "${project}". Inject current working state? (Y/n)`,
    `Terminal: Enter or i · IDE: click [?] on status bar · Agent: confirm_handoff_injection`,
  ];
  if (compactLine) {
    lines.push(compactLine);
  }
  return lines.join('\n');
}

/** Prepare semi-auto injection — pending only, does NOT write context file. */
export async function prepareHandoffInjection(
  workspaceRoot: string,
  options?: PrepareHandoffOptions,
): Promise<{
  shouldPrompt: boolean;
  alreadyInjected: boolean;
  prompt?: string;
  state?: HandoffInjectionState;
  compact?: string;
}> {
  const root = path.resolve(workspaceRoot);
  const { active, runtime_id } = await checkActiveRuntime(root);
  if (!active || !runtime_id) {
    return { shouldPrompt: false, alreadyInjected: false };
  }

  const existing = await readHandoffInjectionState(root);
  const compact = await getProjectHandoff(root, 'compact');
  const project = path.basename(root);
  const chatSessionId = options?.newChat
    ? `chat-${Date.now()}`
    : existing?.chat_session_id ?? `chat-${Date.now()}`;

  if (options?.newChat) {
    const state: HandoffInjectionState = {
      runtime_id,
      status: 'pending',
      prompted_at: Date.now(),
      context_file: `.contora/${CONTEXT_FILE}`,
      chat_session_id: chatSessionId,
    };
    await writeJson(contoraPath(root, INJECTION_STATE_FILE), state);
    return {
      shouldPrompt: true,
      alreadyInjected: false,
      prompt: buildInjectionPromptMessage(project, compact.text),
      state,
      compact: compact.text,
    };
  }

  if (existing?.runtime_id === runtime_id && existing.status === 'injected') {
    return { shouldPrompt: false, alreadyInjected: true, state: existing };
  }
  if (existing?.runtime_id === runtime_id && existing.status === 'skipped') {
    return { shouldPrompt: false, alreadyInjected: false, state: existing };
  }

  const state: HandoffInjectionState = {
    runtime_id,
    status: 'pending',
    prompted_at: Date.now(),
    context_file: `.contora/${CONTEXT_FILE}`,
    chat_session_id: chatSessionId,
  };
  await writeJson(contoraPath(root, INJECTION_STATE_FILE), state);

  return {
    shouldPrompt: true,
    alreadyInjected: false,
    prompt: buildInjectionPromptMessage(project, compact.text),
    state,
    compact: compact.text,
  };
}

/** User confirmed — write context file and mark injected. */
export async function confirmHandoffInjection(
  workspaceRoot: string,
  format: ChpHandoffFormat = 'markdown',
  opts?: { text?: string },
): Promise<{
  ok: boolean;
  filePath?: string;
  text?: string;
  hint?: string;
}> {
  const root = path.resolve(workspaceRoot);
  const { active, runtime_id } = await checkActiveRuntime(root);
  if (!active || !runtime_id) {
    return { ok: false, hint: 'No active runtime or handoff — save changes or run sync first.' };
  }

  const result = opts?.text
    ? { found: true, text: opts.text }
    : await getProjectHandoff(root, format);
  if (!result.found || !result.text) {
    return { ok: false, hint: 'Handoff not ready.' };
  }

  const contextPath = contoraPath(root, CONTEXT_FILE);
  await fs.writeFile(contextPath, result.text, 'utf8');

  const state: HandoffInjectionState = {
    runtime_id,
    status: 'injected',
    prompted_at: (await readHandoffInjectionState(root))?.prompted_at ?? Date.now(),
    resolved_at: Date.now(),
    context_file: `.contora/${CONTEXT_FILE}`,
    format,
    chat_session_id: (await readHandoffInjectionState(root))?.chat_session_id,
  };
  await writeJson(contoraPath(root, INJECTION_STATE_FILE), state);
  await markHandoffInjectionUsed(root, runtime_id);

  return { ok: true, filePath: contextPath, text: result.text };
}

async function markHandoffInjectionUsed(workspaceRoot: string, runtimeId: string): Promise<void> {
  const handoffPath = contoraPath(workspaceRoot, 'handoff.json');
  const raw = await readJson<Record<string, unknown>>(handoffPath);
  if (!raw) {
    return;
  }
  raw.last_handoff_used = { runtime_id: runtimeId, at: Date.now() };
  await writeJson(handoffPath, raw);
}

/** User declined injection for this runtime session. */
export async function skipHandoffInjection(workspaceRoot: string): Promise<{ ok: boolean }> {
  const root = path.resolve(workspaceRoot);
  const { runtime_id } = await checkActiveRuntime(root);
  if (!runtime_id) {
    return { ok: false };
  }
  const state: HandoffInjectionState = {
    runtime_id,
    status: 'skipped',
    prompted_at: (await readHandoffInjectionState(root))?.prompted_at ?? Date.now(),
    resolved_at: Date.now(),
    context_file: `.contora/${CONTEXT_FILE}`,
    chat_session_id: (await readHandoffInjectionState(root))?.chat_session_id,
  };
  await writeJson(contoraPath(root, INJECTION_STATE_FILE), state);
  return { ok: true };
}

/** Reset pending state when runtime_id changes (new bootstrap). */
export async function syncInjectionWithRuntime(workspaceRoot: string): Promise<void> {
  const root = path.resolve(workspaceRoot);
  const { runtime_id } = await checkActiveRuntime(root);
  if (!runtime_id) {
    return;
  }
  const existing = await readHandoffInjectionState(root);
  if (existing && existing.runtime_id !== runtime_id) {
    await writeJson(contoraPath(root, INJECTION_STATE_FILE), {
      runtime_id,
      status: 'pending',
      prompted_at: Date.now(),
      context_file: `.contora/${CONTEXT_FILE}`,
      chat_session_id: `chat-${Date.now()}`,
    } satisfies HandoffInjectionState);
  }
}
