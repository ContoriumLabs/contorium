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
exports.TECH_TERM_TO_PACKAGES = void 0;
exports.extractTechTerms = extractTechTerms;
exports.collectWorkspaceDependencyNames = collectWorkspaceDependencyNames;
exports.detectDependencyManifestChanges = detectDependencyManifestChanges;
exports.techTermForPackage = techTermForPackage;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
/** Decision vocabulary → npm package names that implement it. */
exports.TECH_TERM_TO_PACKAGES = {
    redis: ['redis', 'ioredis', '@redis/client', 'node-redis'],
    jwt: ['jsonwebtoken', 'jose', 'passport-jwt', '@auth0/angular-jwt'],
    oauth: ['oauth', 'oauth2', 'passport-oauth2', 'openid-client'],
    postgres: ['pg', 'postgres', 'postgresql', '@prisma/client', 'prisma'],
    mysql: ['mysql', 'mysql2'],
    mongodb: ['mongodb', 'mongoose'],
    sqlite: ['sqlite3', 'better-sqlite3', '@libsql/client'],
    graphql: ['graphql', '@apollo/server', 'apollo-server', 'graphql-yoga'],
    mcp: ['@modelcontextprotocol/sdk', 'mcp'],
    kafka: ['kafkajs', 'node-rdkafka'],
    rabbitmq: ['amqplib', 'amqp-connection-manager'],
};
const DEFAULT_MANIFEST_CANDIDATES = [
    'package.json',
    'packages/state-core/package.json',
    'packages/cli/package.json',
    'packages/mcp/package.json',
    'packages/runtime/package.json',
];
function extractTechTerms(text) {
    const lower = text.toLowerCase();
    return Object.keys(exports.TECH_TERM_TO_PACKAGES).filter((term) => {
        const re = new RegExp(`\\b${term}\\b`, 'i');
        return re.test(lower);
    });
}
async function collectWorkspaceDependencyNames(workspaceRoot, extraManifests = []) {
    const names = new Set();
    const candidates = [...new Set([...DEFAULT_MANIFEST_CANDIDATES, ...extraManifests])];
    for (const rel of candidates) {
        const full = path.join(workspaceRoot, rel);
        try {
            const raw = JSON.parse(await fs.readFile(full, 'utf8'));
            for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
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
function detectDependencyManifestChanges(previous, current) {
    const added = [];
    const removed = [];
    for (const p of current) {
        if (!previous.has(p)) {
            added.push(p);
        }
    }
    for (const p of previous) {
        if (!current.has(p)) {
            removed.push(p);
        }
    }
    return { added, removed };
}
function techTermForPackage(pkgName) {
    const lower = pkgName.toLowerCase();
    for (const [term, pkgs] of Object.entries(exports.TECH_TERM_TO_PACKAGES)) {
        if (pkgs.some((p) => p.toLowerCase() === lower)) {
            return term;
        }
    }
    return undefined;
}
