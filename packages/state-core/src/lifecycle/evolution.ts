import type { AdrRecord } from '../cil/types.js';

/** Walk superseded_by chain into an evolution timeline (oldest -> newest). */
export function buildDecisionEvolutionChain(adrs: AdrRecord[], startId: string): string[] {
  const byId = new Map(adrs.map((a) => [a.id, a]));
  const chain: string[] = [];
  const seen = new Set<string>();

  let current = byId.get(startId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current.id);
    const predecessor = adrs.find((a) => a.superseded_by === current!.id);
    current = predecessor;
  }

  let forward = byId.get(startId);
  while (forward?.superseded_by && !seen.has(forward.superseded_by)) {
    const next = byId.get(forward.superseded_by);
    if (!next) {
      break;
    }
    seen.add(next.id);
    chain.push(next.id);
    forward = next;
  }

  return chain;
}

/** Build superseded context for validity layer (优化.md §三.5). */
export function buildSupersededContext(
  adr: AdrRecord,
  adrs: AdrRecord[],
): import('./types.js').SupersededContext | undefined {
  if (adr.status !== 'superseded') {
    return undefined;
  }
  const replacement = adr.superseded_by
    ? adrs.find((a) => a.id === adr.superseded_by)
    : undefined;
  return {
    replacement: adr.superseded_by,
    reason: replacement
      ? `Superseded by ${replacement.title}`
      : adr.superseded_by
        ? 'Replaced by a newer decision'
        : 'Architecture or policy evolution',
  };
}

export function mapAdrToLifecycleStatus(status: AdrRecord['status']): import('./types.js').LifecycleDecisionStatus {
  switch (status) {
    case 'accepted':
    case 'implemented':
    case 'proposed':
      return 'ACTIVE';
    case 'superseded':
      return 'SUPERSEDED';
    case 'deprecated':
    case 'rejected':
      return 'DEPRECATED';
    default:
      return 'UNKNOWN';
  }
}
