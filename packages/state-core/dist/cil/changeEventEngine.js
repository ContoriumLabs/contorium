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
exports.CHANGE_EVENT_SCHEMA = void 0;
exports.collectChangeEvents = collectChangeEvents;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const bootstrapState_js_1 = require("../bootstrap/bootstrapState.js");
const eventStore_js_1 = require("./eventStore.js");
const dependencyInventory_js_1 = require("../lifecycle/dependencyInventory.js");
exports.CHANGE_EVENT_SCHEMA = 'contorium.change_events.v1';
function eventId(prefix, seed) {
    return `${prefix}_${seed.replace(/[^\w.-]+/g, '_').slice(0, 48)}`;
}
function dependencyBaselinePath(workspaceRoot) {
    return path.join(path.resolve(workspaceRoot), '.contora', 'governance', 'dependency_baseline.json');
}
async function readDependencyBaseline(workspaceRoot) {
    try {
        const raw = JSON.parse(await fs.readFile(dependencyBaselinePath(workspaceRoot), 'utf8'));
        if (Array.isArray(raw.packages)) {
            return new Set(raw.packages.map((p) => p.toLowerCase()));
        }
    }
    catch {
        // no baseline yet
    }
    return null;
}
async function writeDependencyBaseline(workspaceRoot, packages) {
    const file = dependencyBaselinePath(workspaceRoot);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, `${JSON.stringify({
        schema: 'contorium.dependency_baseline.v1',
        updated_at: new Date().toISOString(),
        packages: [...packages].sort(),
    }, null, 2)}\n`, 'utf8');
}
/** Infer candidate architecture/business events from narrative (confidence < 1, status candidate). */
function inferCandidateEvents(narrative, now) {
    const out = [];
    const n = narrative.toLowerCase();
    if (/migrat(?:e|ing|ion)|rewrite|re-architect|new stack|replace .+ with/i.test(narrative)) {
        out.push({
            id: eventId('cand_arch', 'migration'),
            type: 'ARCHITECTURE_CHANGE',
            source: 'candidate',
            time: now,
            detail: 'Potential architecture migration detected in workspace narrative',
            confidence: 0.7,
            status: 'candidate',
        });
    }
    if (/switch(?:ing)?\s+to\s+(postgres|mysql|mongodb|redis|sqlite)/i.test(narrative)) {
        const m = narrative.match(/switch(?:ing)?\s+to\s+(postgres|mysql|mongodb|redis|sqlite)/i);
        out.push({
            id: eventId('cand_dep', m?.[1] ?? 'switch'),
            type: 'DEPENDENCY_CHANGE',
            source: 'candidate',
            time: now,
            detail: `Potential dependency switch detected: ${m?.[0] ?? 'stack change'}`,
            confidence: 0.65,
            status: 'candidate',
        });
    }
    if (/deprecat|remove redis|drop sqlite|without oauth|no longer use/i.test(n)) {
        out.push({
            id: eventId('cand_rem', 'removal'),
            type: 'DEPENDENCY_REMOVAL',
            source: 'candidate',
            time: now,
            detail: 'Potential dependency removal noted in narrative (candidate — needs confirmation)',
            confidence: 0.68,
            status: 'candidate',
        });
    }
    return out;
}
/** Collect unified change events from git, deps, cognitive events, and candidates (优化.md §4.1). */
async function collectChangeEvents(workspaceRoot) {
    const [state, events, currentDeps] = await Promise.all([
        (0, bootstrapState_js_1.readStateJson)(workspaceRoot).catch(() => null),
        (0, eventStore_js_1.readAllCognitiveEvents)(workspaceRoot).catch(() => []),
        (0, dependencyInventory_js_1.collectWorkspaceDependencyNames)(workspaceRoot),
    ]);
    const out = [];
    const seen = new Set();
    const now = new Date().toISOString();
    const push = (evt) => {
        const key = `${evt.type}|${evt.detail ?? ''}|${(evt.files ?? []).join(',')}|${evt.status ?? 'confirmed'}`;
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        out.push(evt);
    };
    for (const file of state?.gitStaged ?? []) {
        push({
            id: eventId('git_staged', file),
            type: 'CODE_CHANGE',
            source: 'git',
            time: now,
            files: [file],
            detail: `Staged change: ${file}`,
            status: 'confirmed',
        });
    }
    for (const file of state?.gitWorking ?? []) {
        push({
            id: eventId('git_working', file),
            type: 'CODE_CHANGE',
            source: 'git',
            time: now,
            files: [file],
            detail: `Working tree change: ${file}`,
            status: 'confirmed',
        });
    }
    for (const file of (state?.recentFiles ?? []).slice(0, 24)) {
        push({
            id: eventId('recent', file),
            type: 'CODE_CHANGE',
            source: 'filesystem',
            time: now,
            files: [file],
            detail: `Recently touched: ${file}`,
            status: 'confirmed',
        });
    }
    // Manifest-touched paths → confirmed dependency scan trigger
    const manifestTouched = [...(state?.gitStaged ?? []), ...(state?.gitWorking ?? [])].filter((f) => /package\.json$|package-lock\.json$|pnpm-lock\.yaml$|yarn\.lock$/i.test(f));
    for (const file of manifestTouched) {
        push({
            id: eventId('manifest', file),
            type: 'DEPENDENCY_CHANGE',
            source: 'git',
            time: now,
            files: [file],
            detail: `Dependency manifest changed: ${file}`,
            status: 'confirmed',
        });
    }
    // Baseline diff → precise add/remove events
    const baseline = await readDependencyBaseline(workspaceRoot);
    if (baseline && currentDeps.size) {
        const { added, removed } = (0, dependencyInventory_js_1.detectDependencyManifestChanges)(baseline, currentDeps);
        for (const pkg of removed.slice(0, 12)) {
            const tech = Object.entries(dependencyInventory_js_1.TECH_TERM_TO_PACKAGES).find(([, pkgs]) => pkgs.some((p) => p.toLowerCase() === pkg))?.[0];
            push({
                id: eventId('dep_rm', pkg),
                type: 'DEPENDENCY_REMOVAL',
                source: 'dependency',
                time: now,
                detail: tech
                    ? `${tech} dependency removed (${pkg})`
                    : `Dependency removed: ${pkg}`,
                status: 'confirmed',
            });
        }
        for (const pkg of added.slice(0, 12)) {
            push({
                id: eventId('dep_add', pkg),
                type: 'DEPENDENCY_CHANGE',
                source: 'dependency',
                time: now,
                detail: `Dependency added: ${pkg}`,
                status: 'confirmed',
            });
        }
    }
    if (currentDeps.size) {
        await writeDependencyBaseline(workspaceRoot, currentDeps).catch(() => undefined);
    }
    for (const evt of events.slice(0, 32)) {
        if (!evt.files?.length && !evt.summary) {
            continue;
        }
        const blob = `${evt.title} ${evt.summary} ${evt.why ?? ''}`;
        const arch = /architecture|monolith|microservice|refactor/i.test(blob);
        const dep = /dependenc|package\.json|npm install|removed package/i.test(blob);
        push({
            id: eventId('cog', evt.id ?? evt.timestamp),
            type: arch ? 'ARCHITECTURE_CHANGE' : dep ? 'DEPENDENCY_CHANGE' : 'CODE_CHANGE',
            source: 'cognitive',
            time: evt.timestamp,
            files: evt.files,
            detail: evt.summary || evt.title,
            status: 'confirmed',
        });
    }
    const narrative = `${state?.currentTask ?? ''}\n${state?.notes ?? ''}`;
    if (/business scale|traffic (?:surge|growth|increased)|10x|100x/i.test(narrative)) {
        push({
            id: eventId('biz', 'scale'),
            type: 'BUSINESS_CHANGE',
            source: 'human',
            time: now,
            detail: 'Business scale or traffic growth noted in workspace narrative',
            status: 'confirmed',
        });
    }
    // AI/heuristic candidates — never auto-confirm (优化.md §4.1 C / §12)
    for (const cand of inferCandidateEvents(narrative, now)) {
        push(cand);
    }
    for (const evt of events.slice(0, 16)) {
        const blob = `${evt.title}\n${evt.summary}\n${evt.why ?? ''}`;
        if (/potential|maybe|consider|might|looks like/i.test(blob) && /migrat|rearchitect|replace/i.test(blob)) {
            push({
                id: eventId('cand_cog', evt.id ?? evt.timestamp),
                type: 'ARCHITECTURE_CHANGE',
                source: 'candidate',
                time: evt.timestamp,
                files: evt.files,
                detail: `Candidate: ${evt.summary || evt.title}`,
                confidence: Math.min(0.75, evt.confidence ?? 0.7),
                status: 'candidate',
            });
        }
    }
    return out.slice(0, 80);
}
