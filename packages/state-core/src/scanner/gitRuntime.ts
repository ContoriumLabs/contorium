import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Contorium git subprocess gate — MCP/Codex startup keeps git.exe off until runtime activity.
 * CLI `contorium sync` sets allow via refreshGit; IDE extension enables on file/git events.
 */
let gitSubprocessAllowed = process.env.CONTORIUM_ALLOW_GIT === '1';

export function isGitSubprocessAllowed(): boolean {
  return gitSubprocessAllowed || process.env.CONTORIUM_ALLOW_GIT === '1';
}

export function setGitSubprocessAllowed(allowed: boolean): void {
  gitSubprocessAllowed = allowed;
}

/** Append one line when git.exe actually runs (diagnose startup flashes). */
export function traceGitInvocation(workspaceRoot: string, args: string[]): void {
  if (process.env.CONTORIUM_GIT_TRACE !== '1') {
    return;
  }
  try {
    const root = path.resolve(workspaceRoot);
    const fp = path.join(root, '.contora', 'git-trace.log');
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    const line = `${new Date().toISOString()}\t${args.join(' ')}\n`;
    fs.appendFileSync(fp, line, 'utf8');
  } catch {
    // ignore
  }
}
