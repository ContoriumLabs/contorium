import { padVisible, truncate } from './uiHelpers.js';
export const SCROLL_SHORTCUTS_HINT = 'Scroll or resize terminal to view all shortcuts';
function hintRows(args) {
    const rows = [
        { key: '[c]', desc: 'Copy PIL context to clipboard' },
        { key: '[i]', desc: 'Inject compact handoff to AI chat' },
        { key: '[q]', desc: 'Quit dashboard' },
        { key: '[↑↓]', desc: 'Cycle view mode (A–E)' },
        { key: '[←→]', desc: 'Cycle LLM provider (view E, step 1)' },
        { key: '[Enter]', desc: 'Apply view / confirm provider / save API key' },
    ];
    if (args.injectionPending) {
        return [
            { key: '[Enter/i]', desc: 'Confirm pending handoff injection' },
            { key: '[n]', desc: 'Skip this injection' },
            ...rows,
        ];
    }
    return rows;
}
function formatHintRow(row, useColor, width) {
    const keyW = 10;
    const keyCol = row.key.padEnd(keyW);
    const keyStyled = useColor ? `\x1b[1m${keyCol}\x1b[0m` : keyCol;
    const desc = row.desc;
    const plain = `${keyCol} ${desc}`;
    if (plain.length <= width) {
        return useColor ? `${keyStyled} ${desc}` : plain;
    }
    return truncate(`${keyCol} ${desc}`, width);
}
/** Plain shortcut lines (no box borders). */
export function renderKeyHintFooter(args) {
    const c = args.useColor;
    const dim = (s) => (c ? `\x1b[2m${s}\x1b[0m` : s);
    const bold = (s) => (c ? `\x1b[1m${s}\x1b[0m` : s);
    const w = args.width;
    const lines = [
        bold('Shortcuts'),
        dim('─'.repeat(Math.max(12, Math.min(w, 48)))),
        ...hintRows(args).map((row) => formatHintRow(row, c, w)),
    ];
    return lines.map((line) => truncate(line, w));
}
export function shortcutScrollHintBoxed(inner, useColor) {
    const dim = useColor ? `\x1b[2m${SCROLL_SHORTCUTS_HINT}\x1b[0m` : SCROLL_SHORTCUTS_HINT;
    return `│ ${padVisible(dim, inner)} │`;
}
/** @deprecated use renderKeyHintFooter */
export function renderKeyHintLines(args) {
    return renderKeyHintFooter(args);
}
