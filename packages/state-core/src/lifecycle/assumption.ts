import { readStateJson } from '../bootstrap/bootstrapState.js';
import { readHandoffArtifact } from '../understanding/store.js';
import type { AdrRecord } from '../cil/types.js';
import type { AdrAssumption, ValiditySignal } from './types.js';

const ASSUMPTION_PATTERNS: Array<{ type: AdrAssumption['type']; pattern: RegExp }> = [
  { type: 'BUSINESS_ASSUMPTION', pattern: /traffic\s+(?:remains?|stays?|is)\s+(?:below|under|<)\s*([\d,]+k?)/i },
  { type: 'BUSINESS_ASSUMPTION', pattern: /(?:scale|load|users?)\s+(?:remains?|stays?)\s+(?:below|under|<)\s*([\d,]+k?)/i },
  { type: 'TECHNICAL_ASSUMPTION', pattern: /assuming\s+([^.!?\n]{12,140})/i },
  { type: 'TECHNICAL_ASSUMPTION', pattern: /(?:because|since)\s+([^.!?\n]{12,140})/i },
];

/** Extract assumptive statements from ADR reason text. */
export function extractAdrAssumptions(adr: AdrRecord): AdrAssumption[] {
  const text = `${adr.title} ${adr.reason}`;
  const out: AdrAssumption[] = [];
  const seen = new Set<string>();

  for (const { type, pattern } of ASSUMPTION_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const statement = (m[1] ?? m[0]).trim().replace(/\s+/g, ' ');
      if (statement.length < 10 || seen.has(statement.toLowerCase())) {
        continue;
      }
      seen.add(statement.toLowerCase());
      out.push({ statement, type });
    }
  }

  return out.slice(0, 6);
}

function contradictsAssumption(statement: string, blob: string): string | undefined {
  const lower = statement.toLowerCase();
  const b = blob.toLowerCase();

  const belowMatch = lower.match(/(?:below|under|<)\s*([\d,]+)\s*(k|m)?/);
  if (belowMatch) {
    const limit = Number(belowMatch[1]!.replace(/,/g, '')) * (belowMatch[2] === 'k' ? 1000 : 1);
    const scaleHit =
      b.match(/(\d{2,}[\d,]*)\s*(?:k|K)?\s*(?:users?|requests?|rps|qps|traffic)/) ??
      b.match(/scaled?\s+to\s+(\d{2,}[\d,]*)/);
    if (scaleHit && limit > 0) {
      const observed = Number(scaleHit[1]!.replace(/,/g, ''));
      if (observed > limit * 1.2) {
        return `Observed scale (${scaleHit[0]}) exceeds assumption "${statement}"`;
      }
    }
    if (/scaled|growth spike|10x|100x|high traffic|traffic surge/.test(b) && limit > 0) {
      return `Activity suggests scale exceeded assumption "${statement}"`;
    }
  }

  if (/monolith|single service/.test(lower) && /microservice|split service|service mesh/.test(b)) {
    return `Architecture drift conflicts with "${statement}"`;
  }
  if (/sqlite|embedded db/.test(lower) && /postgres|mysql|clustered db/.test(b)) {
    return `Storage scale conflicts with "${statement}"`;
  }

  return undefined;
}

/** Heuristic assumption failure from handoff, focus, and recent narrative. */
export async function detectAssumptionFailures(
  workspaceRoot: string,
  adr: AdrRecord,
  assumptions?: AdrAssumption[],
): Promise<ValiditySignal[]> {
  const extracted = assumptions?.length ? assumptions : extractAdrAssumptions(adr);
  if (!extracted.length) {
    return [];
  }

  const [state, handoff] = await Promise.all([
    readStateJson(workspaceRoot).catch(() => null),
    readHandoffArtifact(workspaceRoot).catch(() => null),
  ]);

  const blob = [
    handoff?.goal ?? '',
    handoff?.summary ?? '',
    state?.currentTask ?? '',
    state?.notes ?? '',
  ].join('\n');

  const signals: ValiditySignal[] = [];
  const now = new Date().toISOString();

  for (const a of extracted) {
    const failure = contradictsAssumption(a.statement, blob);
    if (!failure) {
      continue;
    }
    signals.push({
      type: 'ASSUMPTION_FAILURE',
      detected_at: now,
      reason: failure,
      severity: 'high',
      evidence: a.statement,
      detail: `Assumption (${a.type}) may no longer hold`,
    });
  }

  return signals;
}
