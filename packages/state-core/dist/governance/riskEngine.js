"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeGovernanceImpact = computeGovernanceImpact;
exports.recommendationFor = recommendationFor;
exports.computeGovernanceRisk = computeGovernanceRisk;
const changeAnalyzer_js_1 = require("./changeAnalyzer.js");
function pathTier(level, protectedPath) {
    if (!protectedPath) {
        return 'normal';
    }
    if (level === 'critical') {
        return 'critical';
    }
    return 'protected';
}
function changeBucket(changeType, severity) {
    switch (changeType) {
        case 'comment':
        case 'style':
        case 'test':
            return 'trivial';
        case 'config':
            return 'config';
        case 'logic':
            return 'logic';
        case 'api':
            return 'api';
        case 'architecture':
            return 'architecture';
        case 'database':
        case 'security':
            return 'critical';
        default:
            return severity === 'critical' ? 'critical' : 'logic';
    }
}
function matrixRisk(path, bucket) {
    if (bucket === 'critical') {
        return 'critical';
    }
    if (path === 'normal') {
        if (bucket === 'trivial') {
            return 'low';
        }
        if (bucket === 'config') {
            return 'low';
        }
        if (bucket === 'api' || bucket === 'logic') {
            return 'medium';
        }
        if (bucket === 'architecture') {
            return 'high';
        }
        return 'medium';
    }
    if (path === 'protected') {
        if (bucket === 'trivial') {
            return 'medium';
        }
        if (bucket === 'config') {
            return 'medium';
        }
        if (bucket === 'api' || bucket === 'logic') {
            return 'high';
        }
        if (bucket === 'architecture') {
            return 'critical';
        }
        return 'high';
    }
    // critical protected tier
    if (bucket === 'trivial') {
        return 'medium';
    }
    if (bucket === 'config') {
        return 'medium';
    }
    if (bucket === 'architecture') {
        return 'critical';
    }
    return 'high';
}
function computeGovernanceImpact(changeType, truthImpact, protectedPath) {
    if (changeType === 'database') {
        return 'database';
    }
    if (changeType === 'security') {
        return 'security';
    }
    if (truthImpact) {
        return 'truth';
    }
    if (changeType === 'architecture' || changeType === 'api') {
        return 'architecture';
    }
    if (protectedPath && (changeType === 'logic' || changeType === 'config')) {
        return 'architecture';
    }
    return 'none';
}
/** Recommendation = Risk × Change Type (not risk alone). */
function recommendationFor(risk, changeType) {
    if (risk === 'critical') {
        return 'explicit_approval_required';
    }
    if (risk === 'high') {
        if (changeType === 'security' || changeType === 'database') {
            return changeType === 'database' ? 'explicit_approval_required' : 'manual_review_required';
        }
        if (changeType === 'comment' || changeType === 'style' || changeType === 'test') {
            return 'review_before_commit';
        }
        return 'manual_review_required';
    }
    if (risk === 'medium') {
        if (changeType === 'comment' || changeType === 'style' || changeType === 'test') {
            return 'safe_to_modify';
        }
        if (changeType === 'config') {
            return 'review_before_commit';
        }
        return 'review_before_commit';
    }
    // low
    if (changeType === 'security' || changeType === 'database') {
        return 'manual_review_required';
    }
    return 'safe_to_modify';
}
function displayScoreFor(risk, changeType, confidence, impact) {
    const base = {
        low: 88,
        medium: 72,
        high: 52,
        critical: 28,
    };
    let score = base[risk];
    if (changeType === 'comment' || changeType === 'style' || changeType === 'test') {
        score += 6;
    }
    if (changeType === 'security' || changeType === 'database') {
        score -= 12;
    }
    if (impact === 'truth') {
        score -= 8;
    }
    else if (impact === 'architecture') {
        score -= 5;
    }
    score = score * (0.85 + confidence * 0.15);
    return Math.max(0, Math.min(100, Math.round(score)));
}
function computeGovernanceRisk(input) {
    const reason_chain = [];
    const change = input.change;
    if (input.forbiddenHit) {
        reason_chain.push('Forbidden pattern detected in change');
        const confidence = (0, changeAnalyzer_js_1.computeChangeConfidence)(change);
        return {
            risk: 'critical',
            impact: 'security',
            confidence,
            recommendation: 'explicit_approval_required',
            reason_chain: [...reason_chain, 'Final risk: CRITICAL'],
            display_score: displayScoreFor('critical', change.change_type, confidence, 'security'),
        };
    }
    if (input.protectedPath) {
        reason_chain.push(input.protectedLevel === 'critical'
            ? 'File inside critical protected path'
            : 'Protected path');
    }
    else {
        reason_chain.push('File outside protected paths');
    }
    if (input.truthImpact) {
        reason_chain.push('Sensitive business constant / truth registry impact');
    }
    else {
        reason_chain.push('No sensitive truth impact');
    }
    for (const s of change.signals) {
        reason_chain.push(s);
    }
    const path = pathTier(input.protectedLevel, input.protectedPath);
    const bucket = changeBucket(change.change_type, change.severity);
    let risk = matrixRisk(path, bucket);
    if (input.truthImpact && risk === 'low') {
        risk = 'medium';
    }
    else if (input.truthImpact && risk === 'medium') {
        risk = 'high';
    }
    const impact = computeGovernanceImpact(change.change_type, input.truthImpact, input.protectedPath);
    if (impact !== 'none') {
        reason_chain.push(`${impact.charAt(0).toUpperCase()}${impact.slice(1)} impact`);
    }
    reason_chain.push(`Final risk: ${risk.toUpperCase()}`);
    const confidence = (0, changeAnalyzer_js_1.computeChangeConfidence)(change);
    const recommendation = recommendationFor(risk, change.change_type);
    return {
        risk,
        impact,
        confidence,
        recommendation,
        reason_chain,
        display_score: displayScoreFor(risk, change.change_type, confidence, impact),
    };
}
