import { spawn, execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isGitSubprocessAllowed, traceGitInvocation } from './gitRuntime.js';

export interface RunGitOptions {
  timeout?: number;
  maxBuffer?: number;
  /** Bypass runtime gate (CLI sync / explicit refresh only). */
  force?: boolean;
}

let cachedGitExe: string | undefined;

/** Resolve real git.exe on Windows — never git.cmd (opens console). */
export function resolveGitExecutable(): string {
  if (cachedGitExe) {
    return cachedGitExe;
  }
  if (process.platform !== 'win32') {
    cachedGitExe = 'git';
    return cachedGitExe;
  }

  const fromEnv = process.env.GIT_EXEC_PATH?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) {
    cachedGitExe = fromEnv;
    return cachedGitExe;
  }

  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
  const candidates = [
    path.join(programFiles, 'Git', 'mingw64', 'bin', 'git.exe'),
    path.join(programFiles, 'Git', 'bin', 'git.exe'),
    path.join(programFiles, 'Git', 'cmd', 'git.exe'),
    path.join(programFilesX86, 'Git', 'cmd', 'git.exe'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      cachedGitExe = candidate;
      return cachedGitExe;
    }
  }

  try {
    const where = execFileSync('where.exe', ['git.exe'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5_000,
    });
    const line = where
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find((s) => s.toLowerCase().endsWith('git.exe') && fs.existsSync(s));
    if (line) {
      cachedGitExe = line;
      return cachedGitExe;
    }
  } catch {
    // fall through
  }

  cachedGitExe = 'git.exe';
  return cachedGitExe;
}

function gitEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'never',
    GIT_ASKPASS: '',
    SSH_ASKPASS: '',
    GIT_PAGER: '',
    PAGER: '',
  };
}

/** Run git in workspace root — deferred until runtime activity unless forced. */
export async function runGit(
  workspaceRoot: string,
  gitArgs: string[],
  options?: RunGitOptions,
): Promise<string> {
  if (!options?.force && !isGitSubprocessAllowed()) {
    return '';
  }

  traceGitInvocation(workspaceRoot, gitArgs);

  const git = resolveGitExecutable();
  const timeout = options?.timeout ?? 15_000;
  const maxBuffer = options?.maxBuffer ?? 2 * 1024 * 1024;
  const args = [
    '-C',
    path.resolve(workspaceRoot),
    '-c',
    'core.pager=',
    '-c',
    'core.hooksPath=NUL',
    '-c',
    'credential.helper=',
    '--no-pager',
    ...gitArgs,
  ];

  return new Promise((resolve, reject) => {
    const spawnOpts: import('node:child_process').SpawnOptions = {
      windowsHide: true,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: gitEnv(),
    };
    if (process.platform === 'win32') {
      (spawnOpts as import('node:child_process').SpawnOptions & { creationFlags?: number }).creationFlags =
        0x08000000;
    }

    const child = spawn(git, args, spawnOpts);

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      reject(new Error(`git timed out after ${timeout}ms`));
    }, timeout);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      if (stdout.length > maxBuffer) {
        killed = true;
        child.kill('SIGTERM');
        reject(new Error('git stdout exceeded maxBuffer'));
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) {
        return;
      }
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(stderr.trim() || `git exited with code ${code ?? 'unknown'}`));
    });
  });
}
