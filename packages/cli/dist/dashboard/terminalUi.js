/** TTY helpers for Expanded fullscreen dashboard (alternate screen buffer). */
export function terminalHeight() {
    const rows = process.stdout.rows;
    return rows && rows >= 10 ? rows : 24;
}
export function enterAlternateScreen() {
    if (process.stdout.isTTY) {
        process.stdout.write('\x1b[?1049h\x1b[H');
    }
}
export function exitAlternateScreen() {
    if (process.stdout.isTTY) {
        process.stdout.write('\x1b[?1049l');
    }
}
