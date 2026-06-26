import { detectDecisionContradictions } from './decisionConsistency.js';
import { readAllAdrRecords } from './eventStore.js';
import type { AdrRecord } from './types.js';
import { freshnessLabelText } from './confidenceLabels.js';

export async function getDecisionCenter(workspaceRoot: string): Promise<{
  decisions: AdrRecord[];
  contradictions: ReturnType<typeof detectDecisionContradictions>;
  formatted: string[];
}> {
  const decisions = await readAllAdrRecords(workspaceRoot);
  const contradictions = detectDecisionContradictions(decisions);
  const formatted: string[] = [
    'Decision Center',
    `${decisions.length} ADR record(s)`,
    ...(contradictions.length ? [`⚠ Conflicts: ${contradictions.length}`, ''] : ['']),
  ];

  for (const c of contradictions.slice(0, 4)) {
    formatted.push(`  · ${c.decision} contradicted by ${c.by}`, `    ${c.reason}`, '');
  }

  for (const adr of decisions.slice(0, 16)) {
    formatted.push(
      adr.id,
      '',
      adr.title,
      '',
      `Status: ${adr.status}`,
      ...(adr.superseded_by ? [`Superseded by: ${adr.superseded_by}`] : []),
      '',
      'Reason:',
      adr.reason,
      '',
      'Alternatives:',
      ...adr.alternatives.map((a) => `  · ${a}`),
      '',
      `Risk: ${adr.risk}`,
      `Freshness: ${freshnessLabelText(adr.freshness)}`,
      '',
      '---',
      '',
    );
  }

  return { decisions, contradictions, formatted };
}
