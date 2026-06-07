/** Non-blocking single-key input for TTY dashboard control. */
export function setupKeyboard(onKey) {
    if (!process.stdin.isTTY) {
        return () => undefined;
    }
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const handler = (chunk) => {
        const key = chunk.length === 1 ? chunk : chunk.slice(-1);
        onKey(key);
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
