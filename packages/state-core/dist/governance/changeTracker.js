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
exports.validateAndTrackChange = validateAndTrackChange;
exports.listRecentChanges = listRecentChanges;
const store_js_1 = require("./store.js");
const executionGuard_js_1 = require("./executionGuard.js");
const MAX_RECORDS = 200;
function newChangeId() {
    return `chg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
function approvalFromGuard(guard) {
    if (guard.action === 'block') {
        return 'rejected';
    }
    if (guard.action === 'confirm') {
        return 'pending';
    }
    return 'allow';
}
/**
 * V3.2 Lightweight Guard + change log (no approval workflow).
 */
async function validateAndTrackChange(workspaceRoot, action, source = 'mcp') {
    const guard = await (0, executionGuard_js_1.preActionCheck)(workspaceRoot, action);
    const blocked = guard.action === 'block' || (guard.action === 'confirm' && !guard.allow);
    const record = {
        id: newChangeId(),
        timestamp: Date.now(),
        change: action.description ?? `${action.type}${action.target_path ? `: ${action.target_path}` : ''}`,
        type: action.type === 'file_delete' ? 'file' : action.type === 'path_change' ? 'config' : 'file',
        risk_level: guard.risk_level,
        approval: approvalFromGuard(guard),
        target_path: action.target_path,
        source,
        validation: {
            status: guard.action === 'block' ? 'reject' : guard.action === 'confirm' ? 'require_approval' : 'allow',
            reason: guard.reason,
            risk_level: guard.risk_level,
            matched_rules: guard.detections.map((d) => `${d.type}:${d.detail.slice(0, 60)}`),
        },
    };
    const existing = (await (0, store_js_1.readChangeLog)(workspaceRoot)) ?? {
        version: 1,
        generatedAt: Date.now(),
        records: [],
    };
    existing.generatedAt = Date.now();
    existing.records = [record, ...existing.records].slice(0, MAX_RECORDS);
    await (0, store_js_1.writeChangeLog)(workspaceRoot, existing);
    await (0, store_js_1.appendExecutionLog)(workspaceRoot, {
        ts: record.timestamp,
        event: 'execution_guard',
        action,
        guard,
        change_id: record.id,
        blocked,
    }).catch(() => undefined);
    const { recordGuardSession } = await Promise.resolve().then(() => __importStar(require('./adapterHook.js')));
    await recordGuardSession(workspaceRoot, guard, {
        source,
        target_path: action.target_path,
    }).catch(() => undefined);
    return {
        guard,
        validation: {
            status: record.validation.status,
            reason: guard.reason,
            risk_level: guard.risk_level,
        },
        recorded: true,
        change_id: record.id,
        blocked,
    };
}
async function listRecentChanges(workspaceRoot, limit = 20) {
    const log = await (0, store_js_1.readChangeLog)(workspaceRoot);
    return (log?.records ?? []).slice(0, limit);
}
