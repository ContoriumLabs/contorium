"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trimStringToTokenBudget = trimStringToTokenBudget;
const governanceReview_js_1 = require("../../governance/governanceReview.js");
/** Trim long text to roughly `budget` tokens (drop lines from the end). */
function trimStringToTokenBudget(text, budget) {
    if (budget <= 0 || (0, governanceReview_js_1.estimateTokens)(text) <= budget) {
        return text;
    }
    const lines = text.split('\n');
    let lo = 0;
    let hi = lines.length;
    while (lo < hi) {
        const mid = Math.floor((lo + hi + 1) / 2);
        const candidate = lines.slice(0, mid).join('\n');
        if ((0, governanceReview_js_1.estimateTokens)(candidate) <= budget) {
            lo = mid;
        }
        else {
            hi = mid - 1;
        }
    }
    if (lo <= 0) {
        return `${text.slice(0, Math.max(0, budget * 4 - 80))}\n…`;
    }
    return `${lines.slice(0, lo).join('\n')}\n\n<!-- trimmed to ~${budget} tokens -->`;
}
