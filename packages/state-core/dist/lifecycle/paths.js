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
exports.REVIEW_QUEUE_FILE = exports.LIFECYCLE_META_DIR = exports.LIFECYCLE_INDEX_FILE = exports.LIFECYCLE_DIR = void 0;
exports.lifecycleRoot = lifecycleRoot;
exports.lifecycleIndexPath = lifecycleIndexPath;
exports.lifecycleReviewQueuePath = lifecycleReviewQueuePath;
exports.lifecycleMetaPath = lifecycleMetaPath;
const path = __importStar(require("node:path"));
exports.LIFECYCLE_DIR = 'lifecycle';
exports.LIFECYCLE_INDEX_FILE = 'index.json';
exports.LIFECYCLE_META_DIR = 'decisions';
exports.REVIEW_QUEUE_FILE = 'review-queue.json';
function lifecycleRoot(workspaceRoot) {
    return path.join(path.resolve(workspaceRoot), '.contora', exports.LIFECYCLE_DIR);
}
function lifecycleIndexPath(workspaceRoot) {
    return path.join(lifecycleRoot(workspaceRoot), exports.LIFECYCLE_INDEX_FILE);
}
function lifecycleReviewQueuePath(workspaceRoot) {
    return path.join(lifecycleRoot(workspaceRoot), exports.REVIEW_QUEUE_FILE);
}
function lifecycleMetaPath(workspaceRoot, decisionId) {
    const safe = decisionId.replace(/[^\w.-]+/g, '_');
    return path.join(lifecycleRoot(workspaceRoot), exports.LIFECYCLE_META_DIR, `${safe}.json`);
}
