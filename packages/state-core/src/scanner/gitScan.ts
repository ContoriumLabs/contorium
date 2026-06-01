import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function norm(p: string): string {
  return p.replace(/\\/g, '/');
}

/** Git scan without simple-git — for MCP/CLI standalone. */
export async function scanGitPorcelain(workspaceRoot: string): Promise<{
  staged: string[];
  working: string[];
  isRepo: boolean;
}> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', workspaceRoot, 'status', '--porcelain'],
      { timeout: 15_000, maxBuffer: 2 * 1024 * 1024 },
    );
    const staged = new Set<string>();
    const working = new Set<string>();
    for (const line of stdout.split('\n')) {
      if (line.length < 4) {
        continue;
      }
      const xy = line.slice(0, 2);
      const file = norm(line.slice(3).trim());
      if (!file) {
        continue;
      }
      const index = xy[0];
      const work = xy[1];
      if (index !== ' ' && index !== '?') {
        staged.add(file);
      }
      if (work !== ' ' && work !== '?') {
        working.add(file);
      }
      if (xy === '??') {
        working.add(file);
      }
    }
    return { staged: [...staged], working: [...working], isRepo: true };
  } catch {
    return { staged: [], working: [], isRepo: false };
  }
}
