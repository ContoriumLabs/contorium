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
exports.GOVERNANCE_ARTIFACT_FILES = exports.GOVERNANCE_SCHEMA = void 0;
exports.validateArtifactSchema = validateArtifactSchema;
exports.governanceModeLabel = governanceModeLabel;
exports.mapGovernanceDecisionAction = mapGovernanceDecisionAction;
exports.buildGovernanceScopeFromReview = buildGovernanceScopeFromReview;
exports.scopeMapToArtifact = scopeMapToArtifact;
exports.scopeArtifactToMap = scopeArtifactToMap;
exports.buildGovernanceTraceSteps = buildGovernanceTraceSteps;
exports.persistGovernanceCycleArtifacts = persistGovernanceCycleArtifacts;
exports.persistGovernanceArtifacts = persistGovernanceArtifacts;
exports.readGovernanceDecision = readGovernanceDecision;
exports.readGovernanceScopeArtifact = readGovernanceScopeArtifact;
exports.readGovernanceTraceSummary = readGovernanceTraceSummary;
exports.readGovernanceTrace = readGovernanceTrace;
exports.readGovernanceCycle = readGovernanceCycle;
exports.loadGovernanceArtifactBundle = loadGovernanceArtifactBundle;
exports.loadGovernanceDashboardSnapshot = loadGovernanceDashboardSnapshot;
exports.buildGovernanceSupplement = buildGovernanceSupplement;
const fs = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const governanceReview_js_1 = require("./governanceReview.js");
const decisionProvenance_js_1 = require("../intelligence/decisionProvenance.js");
exports.GOVERNANCE_SCHEMA = 'governance.v1';
const GOVERNANCE_SUBDIR = '.contora/governance';
const LEGACY_CYCLE = '.contora/mcp/governance-cycle.json';
const TRACE_SUMMARY_MAX = 12;
const TRACE_FULL_MAX = 64;
function governanceDir(workspaceRoot) {
    return path.join(path.resolve(workspaceRoot), '.contora', 'governance');
}
function norm(p) {
    return p.replace(/\\/g, '/').replace(/^\.\//, '');
}
function uniq(paths) {
    return [...new Set(paths.map(norm).filter(Boolean))];
}
function header(source, at = Date.now()) {
    return {
        schema: exports.GOVERNANCE_SCHEMA,
        source,
        created_at: new Date(at).toISOString(),
    };
}
function riskNormalized(displayScore) {
    if (displayScore <= 0) {
        return 0;
    }
    return Math.min(1, displayScore / 100);
}
function riskScoreLabel(score) {
    if (score <= 0) {
        return '—';
    }
    return (score / 100).toFixed(2);
}
async function readJsonFile(filePath) {
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
async function writeJsonFile(filePath, data) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
/** Validate artifact header schema — no separate schema.json manifest. */
function validateArtifactSchema(artifact, expected = exports.GOVERNANCE_SCHEMA) {
    if (!artifact || typeof artifact !== 'object') {
        return false;
    }
    const schema = artifact.schema;
    return schema === expected;
}
function ruleCountFromBundle(decision, cycle, review) {
    if (typeof decision?.rule_count === 'number') {
        return decision.rule_count;
    }
    if (cycle?.matched_rules?.length) {
        return cycle.matched_rules.length;
    }
    return review?.reason_chain?.length ?? 0;
}
function governanceModeLabel(review) {
    if (!review) {
        return 'ADVISORY';
    }
    if (review.review_scope === 'git_staged') {
        return 'GIT STAGED';
    }
    if (review.review_scope === 'git_commit') {
        return 'GIT COMMIT';
    }
    if (review.review_scope === 'open_files') {
        return 'OPEN FILES';
    }
    return 'SOFT';
}
function mapGovernanceDecisionAction(review, mode = 'soft') {
    if (!review) {
        return 'allow';
    }
    if (mode === 'advisory') {
        if (review.risk === 'critical' || review.risk === 'high') {
            return 'inject_fix';
        }
        if (review.risk === 'medium') {
            return 'warn';
        }
        return 'allow';
    }
    if (!review.allow || review.status === 'block') {
        return 'block';
    }
    if (review.risk === 'critical' || review.risk === 'high') {
        return mode === 'strict' ? 'block' : 'inject_fix';
    }
    if (review.risk === 'medium' || review.status === 'warn') {
        return 'warn';
    }
    return 'allow';
}
function buildGovernanceScopeFromReview(review, extra, openFiles) {
    const primary = [...(extra?.primary_files ?? [])];
    const related = [...(extra?.related_files ?? [])];
    const risk = [...(extra?.risk_files ?? [])];
    const dependency = [...(extra?.dependency_files ?? [])];
    if (review?.file) {
        const f = norm(review.file);
        if (!primary.includes(f)) {
            primary.unshift(f);
        }
        if (review.protectedPath && !risk.includes(f)) {
            risk.push(f);
        }
    }
    if (review?.staged_files?.length) {
        for (const f of review.staged_files) {
            const n = norm(f);
            if (!primary.includes(n) && !related.includes(n)) {
                related.push(n);
            }
        }
    }
    for (const f of openFiles ?? []) {
        const n = norm(f);
        if (!primary.includes(n) && !related.includes(n)) {
            related.push(n);
        }
    }
    const primaryFull = uniq(primary);
    return {
        primary_files: primaryFull,
        related_files: uniq(related).filter((f) => !primaryFull.includes(f)),
        risk_files: uniq(risk),
        dependency_files: uniq(dependency),
    };
}
function scopeMapToArtifact(source, map, at = Date.now()) {
    return {
        ...header(source, at),
        files: {
            primary: map.primary_files,
            related: map.related_files,
            risk: map.risk_files,
        },
        modules: [],
        dependencies: map.dependency_files,
    };
}
function scopeArtifactToMap(scope) {
    if (!scope) {
        return { primary_files: [], related_files: [], risk_files: [], dependency_files: [] };
    }
    if ('files' in scope && scope.files) {
        return {
            primary_files: scope.files.primary ?? [],
            related_files: scope.files.related ?? [],
            risk_files: scope.files.risk ?? [],
            dependency_files: scope.dependencies ?? [],
        };
    }
    const legacy = scope;
    return {
        primary_files: legacy.primary_files ?? [],
        related_files: legacy.related_files ?? [],
        risk_files: legacy.risk_files ?? [],
        dependency_files: legacy.dependency_files ?? [],
    };
}
function countFilesAffected(scope) {
    return uniq([...scope.primary_files, ...scope.related_files, ...scope.risk_files]).length;
}
function buildGovernanceTraceSteps(input) {
    const injectRequired = Boolean(input.review?.recommendation.includes('inject')) || input.action === 'inject_fix';
    return [
        'diff / review ingested',
        `scope → ${input.files_affected} file(s)`,
        `rules → ${input.rule_count} reason(s)`,
        `risk engine → ${riskScoreLabel(input.risk_score)}`,
        `decision → ${input.action.toUpperCase()}`,
        injectRequired ? 'inject payload → YES' : 'inject payload → optional',
    ];
}
function normalizeDecision(raw) {
    if (!raw) {
        return null;
    }
    const legacy = raw;
    if (legacy.decision && typeof legacy.risk === 'number' && validateArtifactSchema(raw)) {
        return {
            ...raw,
            rule_count: raw.rule_count ?? legacy.rules_triggered ?? 0,
        };
    }
    return {
        ...header(raw.source ?? 'cli', Date.parse(raw.created_at) || Date.now()),
        allow: legacy.allow ?? true,
        risk: typeof legacy.risk === 'number' ? legacy.risk : riskNormalized(legacy.risk_score ?? 0),
        decision: legacy.decision ?? legacy.action ?? 'allow',
        mode_label: legacy.mode_label ?? 'SOFT',
        rule_count: legacy.rule_count ?? legacy.rules_triggered ?? 0,
        recommendation: legacy.recommendation ?? '',
    };
}
/**
 * Full governance cycle — writes decision, scope, trace, cycle (+ optional trace-full).
 * Review-only flows must NOT call this; use writeGovernanceReview only.
 */
async function persistGovernanceCycleArtifacts(workspaceRoot, input) {
    const root = path.resolve(workspaceRoot);
    const review = input.review;
    if (!review) {
        return null;
    }
    const mode = input.cycle_mode ?? 'soft';
    const scopeMap = input.scope ?? buildGovernanceScopeFromReview(review, undefined, input.open_files);
    const action = input.decision_action ?? mapGovernanceDecisionAction(review, mode);
    const filesAffected = countFilesAffected(scopeMap) || 1;
    const ruleCount = review.reason_chain?.length ?? 0;
    const riskScore = review.display_score ?? 0;
    const started = input.started_at ?? Date.now();
    const finished = Date.now();
    const matchedRules = (review.reason_chain ?? []).slice(0, TRACE_FULL_MAX);
    const decision = {
        ...header(input.source, finished),
        allow: review.allow,
        risk: riskNormalized(riskScore),
        decision: action,
        mode_label: governanceModeLabel(review),
        rule_count: ruleCount,
        recommendation: review.recommendation,
    };
    const scope = scopeMapToArtifact(input.source, scopeMap, finished);
    const steps = buildGovernanceTraceSteps({
        review,
        action,
        files_affected: filesAffected,
        rule_count: ruleCount,
        risk_score: riskScore,
    });
    const traceSummary = {
        ...header(input.source, finished),
        steps: steps.slice(0, TRACE_SUMMARY_MAX),
        step_count: steps.length,
    };
    const traceFull = {
        ...header(input.source, finished),
        steps: steps.slice(0, TRACE_FULL_MAX),
        reason_chain: (review.reason_chain ?? []).slice(0, TRACE_FULL_MAX),
        events: [],
    };
    const cycle = {
        ...header(input.source, finished),
        started_at: new Date(started).toISOString(),
        finished_at: new Date(finished).toISOString(),
        decision: action,
        metrics: {
            risk_score: riskScore,
            confidence: review.confidence,
            files_affected: filesAffected,
        },
        votes: [],
        matched_rules: matchedRules,
        trace_ref: 'trace.json',
        review_path: 'review.json',
        scope_ref: 'scope.json',
        decision_ref: 'decision.json',
        v4: input.v4_payload,
    };
    const dir = governanceDir(root);
    await Promise.all([
        writeJsonFile(path.join(dir, 'decision.json'), decision),
        writeJsonFile(path.join(dir, 'scope.json'), scope),
        writeJsonFile(path.join(dir, 'trace.json'), traceSummary),
        writeJsonFile(path.join(dir, 'trace-full.json'), traceFull),
        writeJsonFile(path.join(dir, 'cycle.json'), cycle),
    ]);
    const provenanceNode = (0, decisionProvenance_js_1.deriveDecisionProvenanceNode)({
        review,
        action,
        linked_intent: review.file.split('/')[0],
    });
    await (0, decisionProvenance_js_1.appendDecisionProvenanceNode)(root, provenanceNode).catch(() => undefined);
    return cycle;
}
/** @deprecated Use persistGovernanceCycleArtifacts — review-only must not call this. */
async function persistGovernanceArtifacts(workspaceRoot, input) {
    return persistGovernanceCycleArtifacts(workspaceRoot, input);
}
async function readGovernanceDecision(workspaceRoot) {
    const raw = await readJsonFile(path.join(governanceDir(workspaceRoot), 'decision.json'));
    return normalizeDecision(raw);
}
async function readGovernanceScopeArtifact(workspaceRoot) {
    const raw = await readJsonFile(path.join(governanceDir(workspaceRoot), 'scope.json'));
    if (!raw) {
        return null;
    }
    if (raw.schema === exports.GOVERNANCE_SCHEMA && raw.files) {
        return raw;
    }
    if (!validateArtifactSchema(raw) && !raw.primary_files) {
        return null;
    }
    const map = scopeArtifactToMap(raw);
    return scopeMapToArtifact(raw.source ?? 'cli', map, Date.parse(raw.created_at) || Date.now());
}
async function readGovernanceTraceSummary(workspaceRoot) {
    const raw = await readJsonFile(path.join(governanceDir(workspaceRoot), 'trace.json'));
    if (!raw) {
        return null;
    }
    if (raw.schema === exports.GOVERNANCE_SCHEMA && typeof raw.step_count === 'number') {
        return raw;
    }
    const steps = raw.steps ?? [];
    if (!steps.length) {
        return null;
    }
    return {
        ...header(raw.source ?? 'cli'),
        steps: steps.slice(0, TRACE_SUMMARY_MAX),
        step_count: steps.length,
    };
}
/** @deprecated Alias for readGovernanceTraceSummary */
async function readGovernanceTrace(workspaceRoot) {
    return readGovernanceTraceSummary(workspaceRoot);
}
async function readLegacyCycle(workspaceRoot) {
    const legacy = await readJsonFile(path.join(path.resolve(workspaceRoot), LEGACY_CYCLE));
    if (!legacy) {
        return null;
    }
    const review = await (0, governanceReview_js_1.readGovernanceReview)(workspaceRoot);
    const action = legacy.decision?.action ?? mapGovernanceDecisionAction(review, 'soft');
    return {
        ...header('mcp'),
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        decision: action,
        metrics: {
            risk_score: review?.display_score ?? legacy.metrics?.display_score,
        },
        votes: [],
        matched_rules: review?.reason_chain?.slice(0, TRACE_SUMMARY_MAX) ?? [],
        trace_ref: 'trace.json',
        review_path: 'review.json',
        scope_ref: 'scope.json',
        decision_ref: 'decision.json',
        v4: legacy,
    };
}
async function readGovernanceCycle(workspaceRoot) {
    const current = await readJsonFile(path.join(governanceDir(workspaceRoot), 'cycle.json'));
    if (current?.schema === exports.GOVERNANCE_SCHEMA || validateArtifactSchema(current)) {
        return current;
    }
    if (current && 'review_path' in current) {
        return current;
    }
    return readLegacyCycle(workspaceRoot);
}
/** Single entry for all consumers (Dashboard, Export, IDE). */
async function loadGovernanceArtifactBundle(workspaceRoot) {
    const [review, decision, scope, trace, cycle] = await Promise.all([
        (0, governanceReview_js_1.readGovernanceReview)(workspaceRoot),
        readGovernanceDecision(workspaceRoot),
        readGovernanceScopeArtifact(workspaceRoot),
        readGovernanceTraceSummary(workspaceRoot),
        readGovernanceCycle(workspaceRoot),
    ]);
    return { review, decision, scope, trace, cycle };
}
function sliceScope(full) {
    return {
        primary_files: full.primary_files.slice(0, 8),
        related_files: full.related_files.slice(0, 8),
        risk_files: full.risk_files.slice(0, 8),
        dependency_files: full.dependency_files.slice(0, 6),
    };
}
/** Dashboard snapshot — only via state-core bundle (no direct artifact dir reads in CLI). */
async function loadGovernanceDashboardSnapshot(workspaceRoot) {
    const bundle = await loadGovernanceArtifactBundle(workspaceRoot);
    const review = bundle.review;
    const scopeFull = scopeArtifactToMap(bundle.scope);
    if (!scopeFull.primary_files.length && !scopeFull.related_files.length && review) {
        Object.assign(scopeFull, buildGovernanceScopeFromReview(review));
    }
    const decision = bundle.decision;
    const action = decision?.decision ??
        bundle.cycle?.decision ??
        (review ? mapGovernanceDecisionAction(review, 'soft') : '—');
    const riskScore = (decision?.risk ?? 0) > 0
        ? Math.round(decision.risk * 100)
        : review?.display_score ?? bundle.cycle?.metrics?.risk_score ?? 0;
    const filesAffected = bundle.cycle?.metrics?.files_affected ??
        (countFilesAffected(scopeFull) || (review ? 1 : 0));
    return {
        review,
        scope: sliceScope(scopeFull),
        scope_full: scopeFull,
        decision_action: action,
        risk_score: riskScore,
        mode_label: decision?.mode_label ?? governanceModeLabel(review),
        rule_count: ruleCountFromBundle(decision, bundle.cycle, review),
        files_affected: filesAffected || (review ? 1 : 0),
    };
}
function scopeListMd(label, files) {
    const lines = [`### ${label}`, ''];
    if (!files.length) {
        lines.push('- (none)');
    }
    else {
        for (const f of files) {
            lines.push(`- ${f}`);
        }
    }
    return lines;
}
/** Markdown supplement — DECISION / SCOPE / TRACE (三端共用). */
function buildGovernanceSupplement(bundle) {
    const review = bundle.review;
    const decision = bundle.decision;
    const scopeMap = scopeArtifactToMap(bundle.scope);
    const hasScope = scopeMap.primary_files.length +
        scopeMap.related_files.length +
        scopeMap.risk_files.length >
        0;
    if (!review && !decision) {
        return '';
    }
    const action = decision?.decision ??
        bundle.cycle?.decision ??
        mapGovernanceDecisionAction(review, 'soft');
    const modeLabel = decision?.mode_label ?? governanceModeLabel(review);
    const riskScore = (decision?.risk ?? 0) > 0
        ? Math.round(decision.risk * 100)
        : review?.display_score ?? bundle.cycle?.metrics?.risk_score ?? 0;
    const ruleCount = ruleCountFromBundle(decision, bundle.cycle, review);
    const filesAffected = bundle.cycle?.metrics?.files_affected ??
        (countFilesAffected(hasScope ? scopeMap : buildGovernanceScopeFromReview(review)) ||
            (review ? 1 : 0));
    const effectiveScope = hasScope ? scopeMap : buildGovernanceScopeFromReview(review);
    const steps = bundle.trace?.steps ??
        buildGovernanceTraceSteps({
            review,
            action,
            files_affected: filesAffected,
            rule_count: ruleCount,
            risk_score: riskScore,
        });
    return [
        '',
        '## DECISION',
        '',
        `- action: ${action}`,
        `- allow: ${decision?.allow ?? review?.allow ?? true}`,
        `- risk: ${decision?.risk ?? riskNormalized(riskScore)}`,
        `- mode: ${modeLabel}`,
        `- files_affected: ${filesAffected}`,
        `- rule_count: ${ruleCount}`,
        '',
        '## SCOPE',
        '',
        ...scopeListMd('primary', effectiveScope.primary_files),
        '',
        ...scopeListMd('related', effectiveScope.related_files),
        '',
        ...scopeListMd('risk', effectiveScope.risk_files),
        '',
        ...scopeListMd('dependency', effectiveScope.dependency_files),
        '',
        '## TRACE',
        '',
        ...steps.slice(0, TRACE_SUMMARY_MAX).map((s, i) => `${i + 1}. ${s}`),
    ].join('\n');
}
exports.GOVERNANCE_ARTIFACT_FILES = [
    'governance/review.json',
    'governance/decision.json',
    'governance/scope.json',
    'governance/trace.json',
    'governance/trace-full.json',
    'governance/decision_graph.json',
    'governance/cycle.json',
    'mcp/governance-cycle.json',
];
