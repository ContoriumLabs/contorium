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
exports.scanDependencyValiditySignals = scanDependencyValiditySignals;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
/** Decision vocabulary → npm package names that implement it. */
const TECH_PACKAGES = {
    redis: ['redis', 'ioredis', '@redis/client', 'node-redis'],
    jwt: ['jsonwebtoken', 'jose', 'passport-jwt', '@auth0/angular-jwt'],
    oauth: ['oauth', 'oauth2', 'passport-oauth2', 'openid-client'],
    postgres: ['pg', 'postgres', 'postgresql', '@prisma/client', 'prisma'],
    mysql: ['mysql', 'mysql2'],
    mongodb: ['mongodb', 'mongoose'],
    sqlite: ['sqlite3', 'better-sqlite3', '@libsql/client'],
    graphql: ['graphql', '@apollo/server', 'apollo-server', 'graphql-yoga'],
    mcp: ['@modelcontextprotocol/sdk', 'mcp'],
};
function extractTechTerms(text) {
    const lower = text.toLowerCase();
    return Object.keys(TECH_PACKAGES).filter((term) => {
        const re = new RegExp(`\\b${term}\\b`, 'i');
        return re.test(lower);
    });
}
async function readWorkspaceDependencies(workspaceRoot) {
    const names = new Set();
    const candidates = [
        'package.json',
        'packages/state-core/package.json',
        'packages/cli/package.json',
        'packages/mcp/package.json',
    ];
    for (const rel of candidates) {
        const full = path.join(workspaceRoot, rel);
        try {
            const raw = JSON.parse(await fs.readFile(full, 'utf8'));
            for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
                const deps = raw[section];
                if (deps && typeof deps === 'object') {
                    for (const name of Object.keys(deps)) {
                        names.add(name.toLowerCase());
                    }
                }
            }
        }
        catch {
            // skip missing manifests
        }
    }
    return names;
}
/** Detect dependency drift vs ADR technology choices. */
async function scanDependencyValiditySignals(workspaceRoot, adr) {
    if (adr.status === 'superseded' || adr.status === 'deprecated' || adr.status === 'rejected') {
        return [];
    }
    const terms = extractTechTerms(`${adr.title} ${adr.reason}`);
    if (!terms.length) {
        return [];
    }
    const installed = await readWorkspaceDependencies(workspaceRoot);
    if (!installed.size) {
        return [];
    }
    const signals = [];
    const now = new Date().toISOString();
    const adrText = `${adr.title} ${adr.reason}`.toLowerCase();
    for (const term of terms) {
        const packages = TECH_PACKAGES[term] ?? [];
        const hasPkg = packages.some((p) => installed.has(p.toLowerCase()));
        if (hasPkg) {
            continue;
        }
        const altInstalled = Object.entries(TECH_PACKAGES)
            .filter(([other]) => other !== term)
            .filter(([, pkgs]) => pkgs.some((p) => installed.has(p.toLowerCase())))
            .map(([other]) => other)
            .filter((other) => adrText.includes(other) === false);
        if (altInstalled.length) {
            signals.push({
                type: 'DEPENDENCY_CHANGE',
                detected_at: now,
                reason: `Decision emphasizes "${term}" but workspace uses ${altInstalled.slice(0, 2).join(', ')}`,
                severity: 'high',
                evidence: term,
                detail: `Referenced stack may have migrated away from ${term}`,
            });
        }
        else {
            signals.push({
                type: 'DEPENDENCY_REMOVAL',
                detected_at: now,
                reason: `Referenced technology "${term}" has no matching dependency in workspace manifests`,
                severity: 'medium',
                evidence: term,
                detail: 'Dependency may have been removed or decision predates current stack',
            });
        }
    }
    return signals.slice(0, 4);
}
