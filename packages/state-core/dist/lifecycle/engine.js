"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReviewQueue = buildReviewQueue;
exports.computeKnowledgeLifecycle = computeKnowledgeLifecycle;
exports.formatReviewQueue = formatReviewQueue;
exports.findDecisionLifecycle = findDecisionLifecycle;
exports.formatDecisionLifecycleAnswer = formatDecisionLifecycleAnswer;
const io_js_1 = require("../intelligence/dimensions/io.js");
const bootstrapState_js_1 = require("../bootstrap/bootstrapState.js");
const decisionConsistency_js_1 = require("../cil/decisionConsistency.js");
const eventStore_js_1 = require("../cil/eventStore.js");
const drift_js_1 = require("../cil/pik/drift.js");
const generator_js_1 = require("../cil/pik/generator.js");
const codeContradiction_js_1 = require("./codeContradiction.js");
const confidence_js_1 = require("./confidence.js");
const evolution_js_1 = require("./evolution.js");
const freshness_js_1 = require("./freshness.js");
const invalidation_js_1 = require("./invalidation.js");
const paths_js_1 = require("./paths.js");
const policy_js_1 = require("./policy.js");
const types_js_1 = require("./types.js");
function clamp100(n) {
    return Math.max(0, Math.min(100, Math.round(n)));
}
async function readDecisionMeta(workspaceRoot, decisionId) {
    const raw = await (0, io_js_1.readJsonFile)((0, paths_js_1.lifecycleMetaPath)(workspaceRoot, decisionId));
    return raw ?? {};
}
function conflictRefsFor(decisionId, conflicts) {
    return conflicts
        .filter((c) => c.decision === decisionId || c.by === decisionId)
        .map((c) => (c.decision === decisionId ? c.by : c.decision));
}
function buildReviewQueue(records) {
    const items = [];
    for (const r of records) {
        if (r.conflict_refs.length) {
            items.push({
                decision_id: r.decision_id,
                title: r.title,
                reason: 'conflict',
                detail: `Conflicts with ${r.conflict_refs.join(', ')}`,
                severity: 'high',
                action_hint: `Inspect evidence, then verify or update ${r.decision_id}.`,
                evidence: r.evidence.filter((e) => e.source === 'code' || e.source === 'adr'),
            });
        }
        if (r.expired) {
            items.push({
                decision_id: r.decision_id,
                title: r.title,
                reason: 'expired',
                detail: `Not verified for ${r.days_since_verified ?? '?'} days`,
                days: r.days_since_verified,
                severity: 'high',
                action_hint: `Run: contorium lifecycle verify ${r.decision_id} --type manual --by <name>`,
            });
        }
        else if (r.needs_review) {
            items.push({
                decision_id: r.decision_id,
                title: r.title,
                reason: 'stale',
                detail: `Freshness ${r.freshness_score}% - verify decision still holds`,
                days: r.days_since_verified,
                severity: 'medium',
                action_hint: `Re-check and run: contorium lifecycle verify ${r.decision_id} --type manual --by <name>`,
            });
        }
        if (!r.meta.owner?.trim() && r.lifecycle_status === 'ACTIVE') {
            items.push({
                decision_id: r.decision_id,
                title: r.title,
                reason: 'missing_owner',
                detail: 'Unknown ownership',
                severity: 'low',
                action_hint: `Run: contorium lifecycle owner ${r.decision_id} --owner <name>`,
            });
        }
        if (!r.last_verified_at && r.lifecycle_status === 'ACTIVE') {
            items.push({
                decision_id: r.decision_id,
                title: r.title,
                reason: 'unverified',
                detail: 'Never verified against current codebase',
                severity: 'medium',
                action_hint: `Run: contorium lifecycle verify ${r.decision_id} --type manual --by <name>`,
            });
        }
        const actionableSignals = r.validity_signals.filter((s) => s.severity === 'high' ||
            s.severity === 'critical' ||
            (s.type === 'OWNER_CHANGE' && s.severity === 'medium'));
        const coveredTypes = new Set(items
            .filter((i) => i.decision_id === r.decision_id)
            .flatMap((i) => (i.reason === 'conflict' ? ['ADR_CONFLICT'] : [])));
        for (const sig of actionableSignals) {
            if (coveredTypes.has(sig.type)) {
                continue;
            }
            coveredTypes.add(sig.type);
            items.push({
                decision_id: r.decision_id,
                title: r.title,
                reason: 'invalidation_trigger',
                trigger_type: sig.type,
                detail: sig.reason,
                severity: sig.severity === 'critical' ? 'critical' : sig.severity,
                action_hint: (0, invalidation_js_1.suggestedValidityAction)(r.validity_state, [sig], r.decision_id),
                evidence: sig.evidence
                    ? [{ source: 'metadata', detail: sig.evidence, term: sig.type }]
                    : undefined,
            });
        }
    }
    const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
    return items
        .sort((a, b) => {
        const severity = severityRank[b.severity] - severityRank[a.severity];
        return severity !== 0 ? severity : (b.days ?? 0) - (a.days ?? 0);
    })
        .slice(0, policy_js_1.LIFECYCLE_POLICY.maxReviewQueueItems);
}
function buildKnowledgeHealth(records, reviewItems, driftScore, derivedFrom) {
    const n = records.length || 1;
    const avgFresh = records.reduce((s, r) => s + r.freshness_score, 0) / n;
    const avgConf = records.reduce((s, r) => s + r.confidence.overall, 0) / n;
    const withOwner = records.filter((r) => r.meta.owner?.trim()).length;
    const verified = records.filter((r) => r.last_verified_at).length;
    const conflicts = records.filter((r) => r.conflict_refs.length).length;
    const expired = records.filter((r) => r.expired).length;
    const stale = records.filter((r) => r.needs_review && !r.expired).length;
    const dimensions = {
        completeness: clamp100(records.length ? Math.min(100, 40 + records.length * 8) : 20),
        freshness: clamp100(avgFresh),
        ownership: clamp100((withOwner / n) * 100),
        verification: clamp100((verified / n) * 100),
        conflict: clamp100(conflicts ? Math.max(10, 100 - conflicts * policy_js_1.LIFECYCLE_POLICY.conflictPenaltyPerDecision) : 100),
        drift: clamp100(100 - driftScore * 100),
        review_debt: clamp100(Math.max(0, 100 - reviewItems.length * policy_js_1.LIFECYCLE_POLICY.reviewDebtPenaltyPerItem)),
        overall: 0,
    };
    dimensions.overall = clamp100(dimensions.completeness * 0.1 +
        dimensions.freshness * 0.2 +
        dimensions.ownership * 0.1 +
        dimensions.verification * 0.15 +
        dimensions.conflict * 0.2 +
        dimensions.drift * 0.1 +
        dimensions.review_debt * 0.15);
    const score = clamp100((dimensions.overall + avgConf) / 2);
    const formatted = [
        'Knowledge Health (Lifecycle)',
        '',
        `Score: ${score}%`,
        '',
        `Freshness ${dimensions.freshness}% | Verification ${dimensions.verification}% | Conflict ${dimensions.conflict}%`,
        `Ownership ${dimensions.ownership}% | Drift ${dimensions.drift}% | Review debt ${dimensions.review_debt}%`,
        '',
        expired ? `${expired} expired decision(s)` : 'No expired decisions',
        stale ? `${stale} stale decision(s)` : '',
        conflicts ? `${conflicts} decision(s) with conflicts` : '',
        reviewItems.length ? `${reviewItems.length} item(s) in review queue` : 'Review queue clear',
    ].filter(Boolean);
    return {
        schema: types_js_1.KNOWLEDGE_HEALTH_SCHEMA,
        updated_at: new Date().toISOString(),
        projection_of: 'cognitive_events',
        derived_from: derivedFrom,
        score,
        dimensions,
        expired_decisions: expired,
        stale_decisions: stale,
        conflict_count: conflicts,
        missing_owner_count: records.filter((r) => !r.meta.owner?.trim()).length,
        unverified_count: records.filter((r) => !r.last_verified_at).length,
        formatted,
    };
}
/** Compute full Knowledge Lifecycle projection from CIL ADRs. */
async function computeKnowledgeLifecycle(workspaceRoot) {
    const [adrs, state, events] = await Promise.all([
        (0, eventStore_js_1.readAllAdrRecords)(workspaceRoot),
        (0, bootstrapState_js_1.readStateJson)(workspaceRoot),
        (0, eventStore_js_1.readAllCognitiveEvents)(workspaceRoot),
    ]);
    const conflicts = (0, decisionConsistency_js_1.detectDecisionContradictions)(adrs);
    const recentPaths = [
        ...(state?.gitWorking ?? []),
        ...(state?.gitStaged ?? []),
        ...(state?.recentFiles ?? []),
        ...events.slice(0, 24).flatMap((e) => e.files),
    ];
    const codeTensions = await (0, codeContradiction_js_1.detectCodeDecisionTensions)(adrs, recentPaths, workspaceRoot);
    const pik = await (0, generator_js_1.ensureProjectIntentKernel)(workspaceRoot).catch(() => null);
    const drift = pik
        ? await (0, drift_js_1.detectProjectDrift)(workspaceRoot, pik).catch(() => ({ drift_score: 0 }))
        : { drift_score: 0 };
    const records = [];
    for (const adr of adrs) {
        const meta = await readDecisionMeta(workspaceRoot, adr.id);
        const inferredUsed = (0, freshness_js_1.inferLastUsedAt)(adr, events);
        const lastUsedAt = meta.last_used_at ?? inferredUsed;
        let conflictRefs = conflictRefsFor(adr.id, conflicts);
        const codeHits = codeTensions.filter((t) => t.decision_id === adr.id);
        if (codeHits.length) {
            conflictRefs = [...new Set([...conflictRefs, ...codeHits.map((h) => h.code_signal)])];
        }
        const freshnessScore = (0, freshness_js_1.computeFreshnessScore)(adr, meta, lastUsedAt);
        const expired = (0, freshness_js_1.isDecisionExpired)(adr, meta);
        const lifecycleStatus = (0, evolution_js_1.mapAdrToLifecycleStatus)(adr.status);
        const supersededContext = (0, evolution_js_1.buildSupersededContext)(adr, adrs);
        const invalidation = await (0, invalidation_js_1.computeDecisionInvalidation)(workspaceRoot, {
            adr,
            meta,
            lifecycleStatus,
            codeHits,
            conflictRefs,
            expired,
            supersededContext,
        });
        const needsReview = expired ||
            freshnessScore < 50 ||
            invalidation.validity_state === 'NEEDS_REVALIDATION' ||
            invalidation.validity_state === 'INVALIDATED';
        const evolution = (0, evolution_js_1.buildDecisionEvolutionChain)(adrs, adr.id);
        const warnings = [];
        const evidence = [
            {
                source: 'adr',
                detail: `ADR ${adr.id} (${adr.status}) recorded ${adr.date}`,
                confidence: 1,
            },
        ];
        for (const hit of codeHits) {
            evidence.push({
                source: 'code',
                path: hit.evidence_path,
                term: hit.matched_code_term,
                detail: hit.detail,
                confidence: hit.confidence,
            });
        }
        const recordDraft = {
            decision_id: adr.id,
            title: adr.title,
            adr_status: adr.status,
            lifecycle_status: lifecycleStatus,
            created_at: adr.date,
            last_verified_at: meta.verified_at ?? adr.last_verified,
            days_since_verified: (0, freshness_js_1.daysSinceVerified)(adr, meta),
            last_used_at: lastUsedAt,
            days_since_used: (0, freshness_js_1.daysSinceUsed)(meta, lastUsedAt),
            freshness_score: freshnessScore,
            expired,
            needs_review: needsReview,
            meta: { ...meta, last_used_at: lastUsedAt },
            confidence: (0, confidence_js_1.computeDecisionConfidence)(adr, meta, conflictRefs, freshnessScore, invalidation.decay_penalty),
            superseded_by: adr.superseded_by,
            supersedes: adrs.filter((a) => a.superseded_by === adr.id).map((a) => a.id),
            evolution_chain: evolution,
            conflict_refs: conflictRefs,
            evidence,
            formatted_warnings: warnings,
            validity_state: invalidation.validity_state,
            validity_signals: invalidation.validity_signals,
            invalidation_score: invalidation.invalidation_score,
            decay_penalty: invalidation.decay_penalty,
            superseded_context: invalidation.superseded_context,
            assumptions: invalidation.assumptions,
        };
        const freshnessWarn = (0, freshness_js_1.formatFreshnessWarning)(recordDraft);
        if (freshnessWarn) {
            warnings.push(freshnessWarn);
        }
        if (conflictRefs.length) {
            warnings.push(`Contradicted by related decision(s): ${conflictRefs.join(', ')}`);
        }
        for (const hit of codeHits) {
            warnings.push(`Code tension: ${hit.detail}`);
            if (hit.confidence >= 0.75 && !meta.verified_at) {
                warnings.push('Automatic code scan suggests re-verification (contorium lifecycle verify)');
            }
        }
        if (adr.status === 'superseded' && adr.superseded_by) {
            warnings.push(`Superseded by ${adr.superseded_by}`);
        }
        for (const sig of invalidation.validity_signals) {
            warnings.push(`Validity (${sig.type}): ${sig.reason}`);
        }
        records.push({ ...recordDraft, formatted_warnings: warnings });
    }
    const review_queue = buildReviewQueue(records);
    const health = buildKnowledgeHealth(records, review_queue, drift.drift_score ?? 0, adrs.map((a) => a.id));
    return {
        schema: types_js_1.KNOWLEDGE_LIFECYCLE_SCHEMA,
        updated_at: new Date().toISOString(),
        projection_of: 'cognitive_events',
        derived_from: adrs.map((a) => a.id),
        decisions: records,
        health,
        review_queue,
    };
}
function formatReviewQueue(index) {
    const lines = ['Review Queue', ''];
    if (!index.review_queue.length) {
        lines.push('No items need review.');
        return lines;
    }
    for (const item of index.review_queue) {
        const days = item.days != null ? ` | ${item.days} days` : '';
        const trigger = item.trigger_type ? ` (${item.trigger_type})` : '';
        lines.push(`- [${item.severity}] ${item.title} - ${item.reason}${trigger}${days}`, `  ${item.detail}`);
        if (item.action_hint) {
            lines.push(`  Next: ${item.action_hint}`);
        }
        for (const ev of item.evidence?.slice(0, 2) ?? []) {
            const where = ev.path ? ` (${ev.path})` : '';
            lines.push(`  Evidence: ${ev.detail}${where}`);
        }
        lines.push('');
    }
    return lines;
}
function findDecisionLifecycle(index, decisionIdOrTopic) {
    const needle = decisionIdOrTopic.toLowerCase();
    return (index.decisions.find((d) => d.decision_id === decisionIdOrTopic) ??
        index.decisions.find((d) => d.title.toLowerCase().includes(needle)) ??
        index.decisions.find((d) => needle.includes(d.decision_id.toLowerCase())));
}
/** Format lifecycle trust block for Ask decision answers. */
function formatDecisionLifecycleAnswer(record, adrs) {
    const validityIcon = record.validity_state === 'VALID'
        ? ''
        : record.validity_state === 'DECAYING'
            ? '⚠'
            : record.validity_state === 'NEEDS_REVALIDATION'
                ? '⚠'
                : '✕';
    const lines = [
        `**${record.title}**`,
        '',
        `**Validity:** ${validityIcon ? `${validityIcon} ` : ''}${(0, invalidation_js_1.formatValidityStateLabel)(record.validity_state)}`,
    ];
    const primarySignal = [...record.validity_signals].sort((a, b) => {
        const rank = { critical: 4, high: 3, medium: 2, low: 1 };
        return rank[b.severity] - rank[a.severity];
    })[0];
    if (primarySignal && record.validity_state !== 'VALID') {
        lines.push(`**Why:** ${primarySignal.reason}`);
    }
    const suggested = (0, invalidation_js_1.suggestedValidityAction)(record.validity_state, record.validity_signals, record.decision_id);
    if (suggested) {
        lines.push(`**Suggested action:** ${suggested}`);
    }
    lines.push('', `**Confidence:** ${record.confidence.overall}%${record.decay_penalty ? ` (decay −${record.decay_penalty})` : ''}`, `**Status:** ${record.lifecycle_status} (${record.adr_status})`, record.last_verified_at
        ? `**Verified:** ${record.last_verified_at.slice(0, 10)} (${record.days_since_verified} days ago)`
        : '**Verified:** never', record.last_used_at
        ? `**Last used:** ${record.last_used_at.slice(0, 10)}${record.days_since_used != null ? ` (${record.days_since_used} days ago)` : ''}`
        : '**Last used:** no recent activity link', `**Freshness:** ${record.freshness_score}%`, '');
    if (record.superseded_context?.replacement) {
        lines.push(`**Replacement:** ${record.superseded_context.replacement}`);
        if (record.superseded_context.reason) {
            lines.push(`**Superseded reason:** ${record.superseded_context.reason}`);
        }
        lines.push('');
    }
    if (record.evolution_chain.length > 1) {
        const labels = record.evolution_chain.map((id) => {
            const a = adrs.find((x) => x.id === id);
            return a ? `${a.title}` : id;
        });
        lines.push('**Evolution:**', labels.join(' -> '), '');
    }
    if (record.conflict_refs.length) {
        lines.push(`**Conflict:** implementation or ADR tension detected (${record.conflict_refs.join(', ')})`, '');
    }
    const codeWarning = record.formatted_warnings.find((w) => w.startsWith('Code tension:'));
    if (codeWarning) {
        lines.push(`**Implementation signal:** ${codeWarning.replace(/^Code tension:\s*/, '')}`, '');
    }
    if (record.formatted_warnings.length) {
        lines.push('**Trust warnings:**', ...record.formatted_warnings.map((w) => `- ${w}`), '');
    }
    lines.push('_Lifecycle: validity | source | freshness | conflict | ownership | verification | consistency | usage_');
    return lines.join('\n');
}
