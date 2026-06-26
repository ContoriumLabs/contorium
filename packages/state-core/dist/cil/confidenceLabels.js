"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.freshnessFromAge = freshnessFromAge;
exports.freshnessLabelText = freshnessLabelText;
exports.riskFromReversibility = riskFromReversibility;
/** Map numeric confidence + age into user-facing freshness labels. */
function freshnessFromAge(isoDate, now = Date.now()) {
    if (!isoDate) {
        return 'unknown';
    }
    const ts = Date.parse(isoDate);
    if (!Number.isFinite(ts)) {
        return 'unknown';
    }
    const days = (now - ts) / (1000 * 60 * 60 * 24);
    if (days < 7) {
        return 'fresh';
    }
    if (days < 30) {
        return 'verified';
    }
    if (days < 90) {
        return 'stale';
    }
    return 'unknown';
}
function freshnessLabelText(label) {
    switch (label) {
        case 'fresh':
            return 'Fresh';
        case 'verified':
            return 'Verified';
        case 'stale':
            return 'Potentially stale';
        case 'unknown':
            return 'Unknown';
    }
}
function riskFromReversibility(rev) {
    if (rev === 'low') {
        return 'high';
    }
    if (rev === 'medium') {
        return 'medium';
    }
    return 'low';
}
