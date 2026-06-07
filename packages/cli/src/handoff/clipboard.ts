import { spawnSync } from 'node:child_process';

/** Copy text to system clipboard (best-effort, cross-platform). */
export function copyToClipboard(text: string): boolean {
  try {
    if (process.platform === 'win32') {
      const result = spawnSync(
        'powershell',
        ['-NoProfile', '-Command', '[Console]::In.ReadToEnd() | Set-Clipboard'],
        { input: text, encoding: 'utf8', timeout: 8000 },
      );
      return result.status === 0;
    }
    if (process.platform === 'darwin') {
      const result = spawnSync('pbcopy', { input: text, encoding: 'utf8', timeout: 5000 });
      return result.status === 0;
    }
    const xclip = spawnSync('xclip', ['-selection', 'clipboard'], {
      input: text,
      encoding: 'utf8',
      timeout: 5000,
    });
    if (xclip.status === 0) {
      return true;
    }
    const wl = spawnSync('wl-copy', { input: text, encoding: 'utf8', timeout: 5000 });
    return wl.status === 0;
  } catch {
    return false;
  }
}
