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
exports.normalizeProtectedPathRules = normalizeProtectedPathRules;
exports.defaultForbiddenPatterns = defaultForbiddenPatterns;
exports.matchProtectedPath = matchProtectedPath;
exports.scanForbiddenPatterns = scanForbiddenPatterns;
exports.loadGovernanceBundle = loadGovernanceBundle;
exports.validateActionWithBundle = validateActionWithBundle;
exports.validateAction = validateAction;
exports.validatePathChange = validatePathChange;
exports.getGovernanceSummary = getGovernanceSummary;
const path = __importStar(require("node:path"));
const store_js_1 = require("./store.js");
function normalizeRelPath(p) {
    return p.replace(/\\/g, '/').replace(/^\.\//, '');
}
function normalizeProtectedPathRules(entries) {
    return entries.map((entry) => {
        if (typeof entry === 'string') {
            return { path: entry, level: 'high' };
        }
        return entry;
    });
}
function defaultForbiddenPatterns() {
    return [
        { type: 'filesystem', pattern: 'rm -rf' },
        { type: 'database', pattern: 'drop table' },
        { type: 'database', pattern: 'drop database' },
        { type: 'database', pattern: 'truncate table' },
        { type: 'security', pattern: 'delete database' },
    ];
}
function pathMatchesGlob(filePath, pattern) {
    const norm = normalizeRelPath(filePath);
    const pat = normalizeRelPath(pattern);
    if (pat.endsWith('/**')) {
        const prefix = pat.slice(0, -3);
        return norm === prefix || norm.startsWith(`${prefix}/`);
    }
    if (pat.startsWith('**/')) {
        const suffix = pat.slice(3);
        return norm.endsWith(suffix) || norm.includes(`/${suffix}`);
    }
    if (pat.includes('*')) {
        const escaped = pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
        return new RegExp(`^${escaped}$`).test(norm);
    }
    return norm === pat || norm.startsWith(`${pat}/`);
}
function matchProtectedPath(filePath, constitution) {
    if (!filePath) {
        return undefined;
    }
    const norm = normalizeRelPath(filePath);
    for (const rule of normalizeProtectedPathRules(constitution.protected_paths)) {
        const p = normalizeRelPath(rule.path);
        if (norm === p || norm.startsWith(`${p}/`) || norm.startsWith(p)) {
            return { path: rule.path, level: rule.level ?? 'high' };
        }
    }
    return undefined;
}
function isMockPath(filePath, truth) {
    if (!filePath) {
        return false;
    }
    return truth.mock_data.some((pattern) => pathMatchesGlob(filePath, pattern));
}
function scanForbiddenPatterns(probe, constitution) {
    const patterns = constitution.forbidden_patterns?.length
        ? constitution.forbidden_patterns
        : defaultForbiddenPatterns();
    const lower = probe.toLowerCase();
    for (const rule of patterns) {
        if (lower.includes(rule.pattern.toLowerCase())) {
            return rule;
        }
    }
    return undefined;
}
function isSensitiveTruthHit(target, probe, truth) {
    if (!target) {
        return undefined;
    }
    const norm = normalizeRelPath(target);
    const registered = truth.hardcoded_values.find((h) => normalizeRelPath(h.file) === norm);
    if (registered && registered.severity === 'high') {
        return registered;
    }
    const sensitiveNames = truth.sensitive_constants ?? [];
    for (const name of sensitiveNames) {
        const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (re.test(probe)) {
            return {
                file: norm,
                line: 0,
                reason: `Sensitive constant ${name} referenced in change`,
                severity: 'high',
            };
        }
    }
    return undefined;
}
async function loadGovernanceBundle(workspaceRoot) {
    const [constitution, truth, identity] = await Promise.all([
        (0, store_js_1.readConstitution)(workspaceRoot),
        (0, store_js_1.readTruthLayer)(workspaceRoot),
        (0, store_js_1.readIdentity)(workspaceRoot),
    ]);
    if (!constitution || !truth || !identity) {
        return null;
    }
    return { constitution, truth, identity };
}
function validateActionWithBundle(bundle, action) {
    const { constitution, truth } = bundle;
    const target = action.target_path ? normalizeRelPath(action.target_path) : undefined;
    const probe = [action.diff_text, action.code_snippet, action.description].filter(Boolean).join('\n');
    const forbiddenPattern = probe ? scanForbiddenPatterns(probe, constitution) : undefined;
    if (forbiddenPattern) {
        return {
            status: 'reject',
            reason: `Forbidden pattern detected (${forbiddenPattern.type}): ${forbiddenPattern.pattern}`,
            risk_level: 'high',
            matched_rules: [`forbidden_patterns:${forbiddenPattern.type}:${forbiddenPattern.pattern}`],
        };
    }
    const protectedMatch = matchProtectedPath(target, constitution);
    if (protectedMatch &&
        (action.type === 'file_write' || action.type === 'file_delete' || action.type === 'path_change')) {
        return {
            status: 'allow',
            reason: `Path is under protected area (${protectedMatch.level}): ${protectedMatch.path} — severity depends on change`,
            risk_level: protectedMatch.level === 'critical' ? 'high' : 'medium',
            matched_rules: [`protected_paths:${protectedMatch.path}:${protectedMatch.level}`],
        };
    }
    if (target && isMockPath(target, truth) && action.type === 'file_write') {
        return {
            status: 'allow',
            reason: 'Target is marked mock data in truth layer',
            risk_level: 'low',
            matched_rules: ['truth:mock_data'],
        };
    }
    const truthHit = probe ? isSensitiveTruthHit(target, probe, truth) : undefined;
    if (truthHit && action.type === 'file_write') {
        return {
            status: 'allow',
            reason: truthHit.reason,
            risk_level: 'high',
            matched_rules: [`truth:sensitive:${target}`],
        };
    }
    return {
        status: 'allow',
        reason: 'No governance rule violation detected',
        risk_level: 'low',
    };
}
async function validateAction(workspaceRoot, action) {
    const bundle = await loadGovernanceBundle(workspaceRoot);
    if (!bundle) {
        return {
            status: 'allow',
            reason: 'Governance layer not initialized — validation skipped',
            risk_level: 'low',
        };
    }
    return validateActionWithBundle(bundle, action);
}
function validatePathChange(bundle, filePath, changeType = 'write') {
    return validateActionWithBundle(bundle, {
        type: changeType === 'delete' ? 'file_delete' : 'file_write',
        target_path: filePath,
    });
}
async function getGovernanceSummary(workspaceRoot) {
    const resolved = path.resolve(workspaceRoot);
    const bundle = await loadGovernanceBundle(resolved);
    if (!bundle) {
        return {
            found: false,
            workspaceRoot: resolved,
            protected_path_count: 0,
            mock_path_patterns: 0,
        };
    }
    return {
        found: true,
        workspaceRoot: resolved,
        constitution: bundle.constitution,
        truth: bundle.truth,
        identity: bundle.identity,
        protected_path_count: normalizeProtectedPathRules(bundle.constitution.protected_paths).length,
        mock_path_patterns: bundle.truth.mock_data.length,
    };
}
