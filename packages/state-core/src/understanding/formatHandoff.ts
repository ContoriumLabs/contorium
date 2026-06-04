import type { HandoffArtifact, HandoffNextAction, ProjectTimeline } from './types.js';
import type { KnowledgeSnapshot } from './knowledgeGraph/types.js';
import { formatAiHandoffExecutionBlock } from './formatCanonicalExport.js';

function normalizeNextText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Single Next bullet — drops redundant "target: reason" when they repeat or overlap. */
export function formatNextActionBullet(a: HandoffNextAction): string {
  const action = a.action;
  const target = (a.target || '').trim();
  const reason = (a.reason || '').trim();
  const nt = normalizeNextText(target);
  const nr = normalizeNextText(reason);

  if (!target && !reason) {
    return `- [${action}] (unspecified)`;
  }
  if (!reason || nr === nt) {
    return `- [${action}] ${target || reason}`;
  }
  if (nr.startsWith(nt) || nt.startsWith(nr)) {
    const text = reason.length >= target.length ? reason : target;
    return `- [${action}] ${text}`;
  }
  if (reason.toLowerCase().startsWith(target.toLowerCase())) {
    return `- [${action}] ${reason}`;
  }
  return `- [${action}] ${target}: ${reason}`;
}

/** CLI handoff markdown — execution block + optional timeline. */
export function formatHandoffMarkdown(
  handoff: HandoffArtifact,
  timeline?: ProjectTimeline,
): string {
  const lines: string[] = [formatAiHandoffExecutionBlock(handoff)];

  const recent = timeline?.recent ?? [];
  if (recent.length) {
    lines.push('');
    lines.push('# CODE EVOLUTION');
    for (const e of recent.slice(0, 5)) {
      const syms = e.changes.map((c) => c.symbol).join(', ') || e.type;
      const file = e.file.replace(/\\/g, '/').split('/').pop() ?? e.file;
      lines.push(`- ${e.commit} · ${file} · ${syms} (${e.impact_level})`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/** Compact JSON export bundle for CLI `contorium export --format json`. */
export function buildUnderstandingExportJson(args: {
  handoff: HandoffArtifact;
  timeline?: ProjectTimeline;
  projectSnapshot?: string;
  knowledgeSnapshot?: KnowledgeSnapshot;
}) {
  return {
    version: 'v3.1',
    projectSnapshot: args.projectSnapshot,
    cognitiveSnapshot: args.knowledgeSnapshot,
    handoff: args.handoff,
    timeline: args.timeline?.recent?.slice(0, 5),
  };
}
