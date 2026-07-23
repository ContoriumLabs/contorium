"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanDependencyValiditySignals = scanDependencyValiditySignals;
const dependencyInventory_js_1 = require("./dependencyInventory.js");
/** Detect dependency drift vs ADR technology choices (manifest-backed). */
async function scanDependencyValiditySignals(workspaceRoot, adr) {
    if (adr.status === 'superseded' || adr.status === 'deprecated' || adr.status === 'rejected') {
        return [];
    }
    const adrText = `${adr.title} ${adr.reason}`;
    const terms = (0, dependencyInventory_js_1.extractTechTerms)(adrText);
    if (!terms.length) {
        return [];
    }
    const installed = await (0, dependencyInventory_js_1.collectWorkspaceDependencyNames)(workspaceRoot);
    if (!installed.size) {
        return [];
    }
    const signals = [];
    const now = new Date().toISOString();
    const adrLower = adrText.toLowerCase();
    // Only emit DEPENDENCY_REMOVAL when ADR strongly claims the tech is required
    const strongClaim = (term) => new RegExp(`(?:use|adopt|require|depend(?:s)?\\s+on|based\\s+on)\\s+${term}|\\b${term}\\b\\s+(?:as|for|cache|database|db|store)`, 'i').test(adrText);
    for (const term of terms) {
        const packages = dependencyInventory_js_1.TECH_TERM_TO_PACKAGES[term] ?? [];
        const hasPkg = packages.some((p) => installed.has(p.toLowerCase()));
        if (hasPkg) {
            continue;
        }
        const altInstalled = Object.entries(dependencyInventory_js_1.TECH_TERM_TO_PACKAGES)
            .filter(([other]) => other !== term)
            .filter(([, pkgs]) => pkgs.some((p) => installed.has(p.toLowerCase())))
            .map(([other]) => other)
            .filter((other) => !adrLower.includes(other));
        // Same family alternatives (sqlite↔postgres etc.) count as CHANGE not noisy REMOVAL
        const storageFamily = new Set(['sqlite', 'postgres', 'mysql', 'mongodb']);
        const authFamily = new Set(['jwt', 'oauth']);
        const familyAlts = altInstalled.filter((other) => {
            if (storageFamily.has(term) && storageFamily.has(other)) {
                return true;
            }
            if (authFamily.has(term) && authFamily.has(other)) {
                return true;
            }
            return false;
        });
        if (familyAlts.length || altInstalled.length) {
            signals.push({
                type: 'DEPENDENCY_CHANGE',
                detected_at: now,
                reason: `Decision emphasizes "${term}" but workspace manifests include ${(familyAlts.length ? familyAlts : altInstalled).slice(0, 2).join(', ')} without ${term}`,
                severity: strongClaim(term) ? 'high' : 'medium',
                evidence: term,
                detail: `Referenced stack may have migrated away from ${term}`,
            });
        }
        else if (strongClaim(term)) {
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
