/** TTY helpers for Expanded fullscreen dashboard (alternate screen buffer). */

export function terminalHeight(): number {
  const rows = process.stdout.rows;
  return rows && rows >= 10 ? rows : 24;
}

export function enterAlternateScreen(): void {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[?1049h\x1b[H');
  }
}

export function exitAlternateScreen(): void {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[?1049l');
  }
}

/** Write a multi-line frame without full-screen erase (avoids flicker on animation ticks). */
export function writeFrameInPlace(text: string, previousLineCount = 0): number {
  if (!process.stdout.isTTY) {
    process.stdout.write(`${text}\n`);
    return text.split('\n').length;
  }
  process.stdout.write('\x1b[H');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    process.stdout.write(`\x1b[${i + 1};1H\x1b[K${lines[i] ?? ''}`);
  }
  for (let i = lines.length; i < previousLineCount; i++) {
    process.stdout.write(`\x1b[${i + 1};1H\x1b[K`);
  }
  return lines.length;
}
