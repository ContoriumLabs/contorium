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

function readWindowsSync(): string | undefined {
  try {
    const ps = spawnSync(
      'powershell',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', 'Get-Clipboard -Raw'],
      { encoding: 'utf8', windowsHide: true, timeout: 5000 },
    );
    if (ps.status === 0 && typeof ps.stdout === 'string') {
      return ps.stdout.replace(/\r\n/g, '\n').replace(/\n$/, '');
    }
  } catch {
    /* fallback */
  }
  return undefined;
}

function readFromClipboardSync(): string | undefined {
  try {
    if (process.platform === 'win32') {
      return readWindowsSync();
    }
    if (process.platform === 'darwin') {
      const result = spawnSync('pbpaste', { encoding: 'utf8', timeout: 5000 });
      if (result.status === 0 && typeof result.stdout === 'string') {
        return result.stdout.replace(/\n$/, '');
      }
      return undefined;
    }
    const xclip = spawnSync('xclip', ['-selection', 'clipboard', '-o'], {
      encoding: 'utf8',
      timeout: 5000,
    });
    if (xclip.status === 0 && typeof xclip.stdout === 'string') {
      return xclip.stdout.replace(/\n$/, '');
    }
    const wl = spawnSync('wl-paste', ['-n'], { encoding: 'utf8', timeout: 5000 });
    if (wl.status === 0 && typeof wl.stdout === 'string') {
      return wl.stdout.replace(/\n$/, '');
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/** Read system clipboard text (best-effort, cross-platform). */
export function readFromClipboardAsync(): Promise<string | undefined> {
  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      try {
        const child = spawn(
          'powershell',
          ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', 'Get-Clipboard -Raw'],
          { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] },
        );
        let out = '';
        child.stdout?.on('data', (buf: Buffer) => {
          out += buf.toString('utf8');
        });
        child.on('error', () => resolve(readFromClipboardSync()));
        child.on('close', (code) => {
          if (code === 0 && out.length > 0) {
            resolve(out.replace(/\r\n/g, '\n').replace(/\n$/, ''));
            return;
          }
          resolve(readFromClipboardSync());
        });
      } catch {
        resolve(readFromClipboardSync());
      }
    });
  }
  return Promise.resolve(readFromClipboardSync());
}
