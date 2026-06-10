import { spawn, spawnSync, type SpawnSyncReturns } from 'node:child_process';

function winClipBuffer(text: string): Buffer {
  return Buffer.from(`\ufeff${text}`, 'utf16le');
}

/** Fast Windows path — clip.exe (~50ms) vs PowerShell cold start (1–3s). */
function copyWindowsSync(text: string): boolean {
  const buf = winClipBuffer(text);
  try {
    const clip: SpawnSyncReturns<Buffer> = spawnSync('cmd', ['/c', 'clip'], {
      input: buf,
      windowsHide: true,
      timeout: 3000,
    });
    if (clip.status === 0) {
      return true;
    }
  } catch {
    /* fallback */
  }
  try {
    const ps = spawnSync(
      'powershell',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '[Console]::In.ReadToEnd() | Set-Clipboard'],
      { input: text, encoding: 'utf8', windowsHide: true, timeout: 8000 },
    );
    return ps.status === 0;
  } catch {
    return false;
  }
}

function copyWindowsAsync(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    const buf = winClipBuffer(text);
    let settled = false;
    const finish = (ok: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(ok);
    };

    try {
      const child = spawn('cmd', ['/c', 'clip'], {
        windowsHide: true,
        stdio: ['pipe', 'ignore', 'ignore'],
      });
      child.on('error', () => finish(copyWindowsSync(text)));
      child.on('close', (code) => finish(code === 0));
      const stdin = child.stdin;
      if (!stdin) {
        finish(copyWindowsSync(text));
        return;
      }
      stdin.end(buf);
    } catch {
      finish(copyWindowsSync(text));
    }
  });
}

/** Copy text to system clipboard (best-effort, cross-platform). */
export function copyToClipboard(text: string): boolean {
  try {
    if (process.platform === 'win32') {
      return copyWindowsSync(text);
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

/** Non-blocking clipboard — keeps dashboard keyboard responsive. */
export function copyToClipboardAsync(text: string): Promise<boolean> {
  if (process.platform === 'win32') {
    return copyWindowsAsync(text);
  }
  return Promise.resolve(copyToClipboard(text));
}
