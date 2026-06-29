"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coerceTimestampToIso = coerceTimestampToIso;
exports.isoDatePrefix = isoDatePrefix;
/** Safe ISO timestamp for cognitive events (handles ms, seconds, ISO strings). */
function coerceTimestampToIso(raw, fallbackMs = Date.now()) {
    if (raw == null) {
        return new Date(fallbackMs).toISOString();
    }
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) {
            return new Date(fallbackMs).toISOString();
        }
        const parsed = Date.parse(trimmed);
        if (Number.isFinite(parsed)) {
            return new Date(parsed).toISOString();
        }
        return new Date(fallbackMs).toISOString();
    }
    if (!Number.isFinite(raw)) {
        return new Date(fallbackMs).toISOString();
    }
    // Project evolution events use epoch ms; legacy data may use unix seconds.
    const ms = raw > 1e11 ? raw : raw * 1000;
    const d = new Date(ms);
    if (!Number.isFinite(d.getTime())) {
        return new Date(fallbackMs).toISOString();
    }
    return d.toISOString();
}
function isoDatePrefix(iso) {
    return iso.slice(0, 10);
}
