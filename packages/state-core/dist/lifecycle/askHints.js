"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatLifecycleTrustWarnings = formatLifecycleTrustWarnings;
exports.appendLifecycleTrustWarnings = appendLifecycleTrustWarnings;
exports.listLifecycleDecisionsForPicker = listLifecycleDecisionsForPicker;
exports.findLifecycleRecordByPickerId = findLifecycleRecordByPickerId;
const eventStore_js_1 = require("../cil/eventStore.js");
const engine_js_1 = require("./engine.js");
const store_js_1 = require("./store.js");
function recordsMentionedInText(text, records) {
    const lower = text.toLowerCase();
    return records.filter((r) => {
        const title = r.title.toLowerCase();
        return title.length >= 4 && (lower.includes(title) || lower.includes(r.decision_id.toLowerCase()));
    });
}
/** Attach stale-trust warnings when history/entity/state answers touch aged decisions. */
function formatLifecycleTrustWarnings(index, answerText, intent) {
    if (!index?.decisions.length) {
        return undefined;
    }
    if (intent === 'decision' || intent === 'direction') {
        return undefined;
    }
    const mentioned = recordsMentionedInText(answerText, index.decisions);
    const flagged = mentioned.filter((r) => r.needs_review ||
        r.expired ||
        r.conflict_refs.length > 0 ||
        r.lifecycle_status !== 'ACTIVE' ||
        r.confidence.overall < 50 ||
        (r.validity_state && r.validity_state !== 'VALID'));
    const lines = [];
    if (flagged.length) {
        lines.push('**Lifecycle trust warnings** (decisions referenced in this answer):');
        for (const r of flagged.slice(0, 5)) {
            lines.push(`- **${r.title}** — validity ${r.validity_state ?? 'UNKNOWN'}, trust ${r.confidence.overall}%, freshness ${r.freshness_score}%`);
            const topSignal = r.validity_signals?.[0];
            if (topSignal && r.validity_state !== 'VALID') {
                lines.push(`  - ${topSignal.type}: ${topSignal.reason}`);
            }
            for (const w of r.formatted_warnings.slice(0, 2)) {
                lines.push(`  - ${w}`);
            }
        }
    }
    else if (intent === 'state' && index.review_queue.length > 0) {
        lines.push(`**Review queue:** ${index.review_queue.length} decision(s) need attention (Knowledge Health ${index.health.score}%).`);
        for (const item of index.review_queue.slice(0, 4)) {
            lines.push(`- ${item.title} (${item.reason}): ${item.detail}`);
        }
    }
    else if (index.review_queue.length >= 3 && (intent === 'history' || intent === 'entity')) {
        lines.push(`**Note:** ${index.review_queue.length} project decisions are in the review queue — historical facts may include stale authority.`);
    }
    if (!lines.length) {
        return undefined;
    }
    return lines.join('\n');
}
async function appendLifecycleTrustWarnings(workspaceRoot, answer, intent) {
    const index = (await (0, store_js_1.readKnowledgeLifecycle)(workspaceRoot)) ??
        undefined;
    const block = formatLifecycleTrustWarnings(index, answer, intent);
    if (!block) {
        return answer;
    }
    return `${answer}\n\n---\n\n${block}`;
}
/** Resolve lifecycle record for IDE owner/verify pickers. */
async function listLifecycleDecisionsForPicker(workspaceRoot) {
    let index = await (0, store_js_1.readKnowledgeLifecycle)(workspaceRoot);
    if (!index?.decisions.length) {
        const { computeKnowledgeLifecycle } = await Promise.resolve().then(() => __importStar(require('./engine.js')));
        index = await computeKnowledgeLifecycle(workspaceRoot);
    }
    const adrs = await (0, eventStore_js_1.readAllAdrRecords)(workspaceRoot);
    return index.decisions.map((r) => {
        const adr = adrs.find((a) => a.id === r.decision_id);
        return {
            id: r.decision_id,
            label: adr?.title ?? r.title,
            record: r,
        };
    });
}
async function findLifecycleRecordByPickerId(workspaceRoot, decisionId) {
    const index = await (0, store_js_1.readKnowledgeLifecycle)(workspaceRoot);
    if (!index) {
        return undefined;
    }
    return (0, engine_js_1.findDecisionLifecycle)(index, decisionId);
}
