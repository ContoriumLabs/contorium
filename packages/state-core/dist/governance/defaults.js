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
exports.defaultConstitution = defaultConstitution;
exports.defaultTruthLayer = defaultTruthLayer;
exports.defaultIdentity = defaultIdentity;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
async function readProjectMeta(root) {
    const fallback = path.basename(root);
    try {
        const text = await fs.readFile(path.join(root, 'package.json'), 'utf8');
        const pkg = JSON.parse(text);
        return {
            name: pkg.displayName ?? pkg.name ?? fallback,
            purpose: typeof pkg.description === 'string' ? pkg.description : undefined,
        };
    }
    catch {
        return { name: fallback };
    }
}
function defaultConstitution() {
    return {
        version: 1,
        principles: [
            'Do not modify core architecture without explicit approval',
            'Never introduce hardcoded production values without marking them in truth.json',
            'All mock data must be explicitly marked',
            'All AI changes must be traceable',
        ],
        protected_paths: [
            { path: 'src/core/', level: 'critical' },
            { path: 'packages/state-core/', level: 'high' },
            { path: 'packages/state-core/src/understanding/knowledgeGraph/', level: 'critical' },
        ],
        forbidden_actions: ['delete_database_schema', 'overwrite_core_logic'],
        forbidden_patterns: [
            { type: 'filesystem', pattern: 'rm -rf' },
            { type: 'database', pattern: 'drop table' },
            { type: 'database', pattern: 'drop database' },
            { type: 'database', pattern: 'truncate table' },
            { type: 'security', pattern: 'delete database' },
        ],
        ai_rules: [
            'Always check truth layer before modifying business logic',
            'Validate intent alignment before execution',
            'Review change severity on protected paths — not every edit is high risk',
        ],
    };
}
function defaultTruthLayer() {
    return {
        version: 1,
        mock_data: ['src/mock/**', '**/__mocks__/**', '**/*.mock.ts', '**/*.mock.js'],
        hardcoded_values: [],
        production_flags: [],
        sensitive_constants: [
            'PRICE_RATE',
            'TAX_RATE',
            'COMMISSION_RATE',
            'INTEREST_RATE',
            'FEE_RATE',
        ],
        business_rules: [],
    };
}
async function defaultIdentity(workspaceRoot) {
    const meta = await readProjectMeta(workspaceRoot);
    return {
        version: 1,
        name: meta.name,
        purpose: meta.purpose ?? 'Software project with AI-assisted development',
        current_focus: [],
        non_goals: ['Not a model company', 'Not an IDE replacement'],
    };
}
