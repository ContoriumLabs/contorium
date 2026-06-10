/** Non-blocking keyboard input for TTY dashboard control. */

export type KeyHandler = (key: string, raw?: string) => void;

export function setupKeyboard(onKey: KeyHandler): () => void {
  if (!process.stdin.isTTY) {
    return () => undefined;
  }

  const stdin = process.stdin;
  const wasRaw = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  const handler = (chunk: string): void => {
    const raw = chunk;
    const key = raw.length === 1 ? raw : raw.slice(-1);
    onKey(key, raw);
  };

  stdin.on('data', handler);

  return () => {
    stdin.off('data', handler);
    if (!wasRaw) {
      stdin.setRawMode(false);
    }
    stdin.pause();
  };
}
