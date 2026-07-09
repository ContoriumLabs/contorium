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
exports.persistKnowledgeLifecycle = persistKnowledgeLifecycle;
exports.readKnowledgeLifecycle = readKnowledgeLifecycle;
exports.readReviewQueueArtifact = readReviewQueueArtifact;
exports.writeDecisionLifecycleMeta = writeDecisionLifecycleMeta;
exports.readDecisionLifecycleMeta = readDecisionLifecycleMeta;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const io_js_1 = require("../intelligence/dimensions/io.js");
const engine_js_1 = require("./engine.js");
const paths_js_1 = require("./paths.js");
const types_js_1 = require("./types.js");
async function persistKnowledgeLifecycle(workspaceRoot) {
    const root = (0, paths_js_1.lifecycleRoot)(workspaceRoot);
    await fs.mkdir(path.join(root, 'decisions'), { recursive: true });
    const index = await (0, engine_js_1.computeKnowledgeLifecycle)(workspaceRoot);
    await (0, io_js_1.writeJsonFile)((0, paths_js_1.lifecycleIndexPath)(workspaceRoot), index);
    const reviewArtifact = {
        schema: types_js_1.REVIEW_QUEUE_SCHEMA,
        updated_at: index.updated_at,
        items: index.review_queue,
        formatted: index.review_queue.length
            ? index.review_queue.flatMap((item) => {
                const days = item.days != null ? ` | ${item.days} days` : '';
                const lines = [`- [${item.severity}] ${item.title} - ${item.reason}${days}`, `  ${item.detail}`];
                if (item.action_hint) {
                    lines.push(`  Next: ${item.action_hint}`);
                }
                return lines;
            })
            : ['No items need review.'],
    };
    await (0, io_js_1.writeJsonFile)((0, paths_js_1.lifecycleReviewQueuePath)(workspaceRoot), reviewArtifact);
    return index;
}
async function readKnowledgeLifecycle(workspaceRoot) {
    const raw = await (0, io_js_1.readJsonFile)((0, paths_js_1.lifecycleIndexPath)(workspaceRoot));
    if (raw?.schema === types_js_1.KNOWLEDGE_LIFECYCLE_SCHEMA && Array.isArray(raw.decisions)) {
        return raw;
    }
    return null;
}
async function readReviewQueueArtifact(workspaceRoot) {
    const raw = await (0, io_js_1.readJsonFile)((0, paths_js_1.lifecycleReviewQueuePath)(workspaceRoot));
    if (raw?.schema === types_js_1.REVIEW_QUEUE_SCHEMA && Array.isArray(raw.items)) {
        return raw;
    }
    return null;
}
async function writeDecisionLifecycleMeta(workspaceRoot, decisionId, meta) {
    await (0, io_js_1.writeJsonFile)((0, paths_js_1.lifecycleMetaPath)(workspaceRoot, decisionId), meta);
}
async function readDecisionLifecycleMeta(workspaceRoot, decisionId) {
    return (0, io_js_1.readJsonFile)((0, paths_js_1.lifecycleMetaPath)(workspaceRoot, decisionId));
}
