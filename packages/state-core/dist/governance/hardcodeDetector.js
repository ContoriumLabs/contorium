"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectHardcodingInSnippet = detectHardcodingInSnippet;
const SKIP_LINE = /^\s*(import|export|from|\/\/|\/\*|\*|#|@|console\.|\/\/ eslint|\/\/ @ts)/;
/** Level-2 only — business/security sensitive patterns (not MAX_RETRY=3). */
const SENSITIVE_PATTERNS = [
    {
        re: /\b(?:COMMISSION|PRICE|TAX|RATE|FEE)_[A-Z0-9_]+\s*=\s*0\.\d+/i,
        type: 'hardcoded_value',
        severity: 'high',
        detail: 'Sensitive business rate constant',
    },
    {
        re: /\b(?:api[_-]?key|secret|password|private[_-]?key|access[_-]?token)\s*=\s*['"][^'"]{8,}['"]/i,
        type: 'hardcoded_value',
        severity: 'high',
        detail: 'Possible hardcoded credential string',
    },
    {
        re: /\bbearer\s+[a-z0-9._-]{20,}/i,
        type: 'hardcoded_value',
        severity: 'high',
        detail: 'Bearer token literal in source',
    },
];
function detectHardcodingInSnippet(code, filePath) {
    const detections = [];
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (SKIP_LINE.test(line)) {
            continue;
        }
        for (const pat of SENSITIVE_PATTERNS) {
            if (pat.re.test(line)) {
                detections.push({
                    type: 'hardcode_snippet',
                    detail: `${pat.detail}${filePath ? ` (${filePath}:${i + 1})` : ` (line ${i + 1})`}: ${line.trim().slice(0, 120)}`,
                    severity: pat.severity,
                });
            }
        }
    }
    return dedupeDetections(detections).slice(0, 6);
}
function dedupeDetections(items) {
    const seen = new Set();
    const out = [];
    for (const d of items) {
        const key = `${d.type}:${d.detail.slice(0, 80)}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        out.push(d);
    }
    return out;
}
