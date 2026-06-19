import type { GuardDetection, RiskSeverity } from './types.js';

const SKIP_LINE =
  /^\s*(import|export|from|\/\/|\/\*|\*|#|@|console\.|\/\/ eslint|\/\/ @ts)/;

/** Level-2 only — business/security sensitive patterns (not MAX_RETRY=3). */
const SENSITIVE_PATTERNS: Array<{ re: RegExp; type: string; severity: RiskSeverity; detail: string }> = [
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

export function detectHardcodingInSnippet(code: string, filePath?: string): GuardDetection[] {
  const detections: GuardDetection[] = [];
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

function dedupeDetections(items: GuardDetection[]): GuardDetection[] {
  const seen = new Set<string>();
  const out: GuardDetection[] = [];
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
