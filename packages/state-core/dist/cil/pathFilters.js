"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isContoraInternalPath = isContoraInternalPath;
exports.filterUserFacingPaths = filterUserFacingPaths;
exports.filterUserFacingLines = filterUserFacingLines;
exports.sanitizeCognitiveEventForDisplay = sanitizeCognitiveEventForDisplay;
/** Paths under Contorium's local store — hidden from user-facing Ask/history output. */
function isContoraInternalPath(relPath) {
    const n = relPath.replace(/\\/g, '/').replace(/^\.\//, '').trim();
    if (!n) {
        return false;
    }
    return (n === '.contora' ||
        n.startsWith('.contora/') ||
        n.includes('/.contora/') ||
        n === 'contora' ||
        n.startsWith('contora/'));
}
function filterUserFacingPaths(paths) {
    return paths.filter((p) => !isContoraInternalPath(p));
}
/** Drop internal artifact paths from free-text impact/history lines. */
function filterUserFacingLines(lines) {
    return lines.filter((line) => {
        const t = line.trim();
        if (!t) {
            return false;
        }
        return !isContoraInternalPath(t);
    });
}
/** Sanitize event file/impact lists for Ask, CLI, and IDE display. */
function sanitizeCognitiveEventForDisplay(event) {
    const files = filterUserFacingPaths(event.files);
    const impact = filterUserFacingLines(event.impact);
    const fileCount = files.length;
    let title = event.title;
    if (/^Modified \d+ file\(s\)$/.test(title) && fileCount !== event.files.length) {
        title = fileCount ? `Modified ${fileCount} file(s)` : event.summary || event.title;
    }
    return { ...event, title, files, impact };
}
