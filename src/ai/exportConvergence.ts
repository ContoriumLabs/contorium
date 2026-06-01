import type { StateSummary } from '../intelligence/types';
import {
  refineVagueGoalLine,
  refineVagueStageLine,
} from '../state-engine/gapAnalysis';
import { stripSourceSuffix } from '../state-engine/sourcing';

/** Remove v2 source tags and audit blocks — export-only purity (stored artifacts unchanged). */
export function purifySnapshotMarkdown(raw: string, summary?: StateSummary): string {
  const domains = summary?.active_domains ?? [];
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inConflicts = false;
  let pendingField: 'goal' | 'stage' | undefined;

  for (const line of lines) {
    const t = line.trim();
    if (/^⚠\s*State Conflicts/i.test(t)) {
      inConflicts = true;
      continue;
    }
    if (inConflicts) {
      if (t === '' && out.length && out[out.length - 1]?.trim() === '') {
        inConflicts = false;
      }
      continue;
    }
    if (/^PROJECT SNAPSHOT\s*$/i.test(t)) {
      continue;
    }
    if (/^\(L\d|^# PROJECT SNAPSHOT/i.test(t)) {
      continue;
    }
    if (/^Goal:?\s*$/i.test(t)) {
      out.push('Goal:');
      pendingField = 'goal';
      continue;
    }
    if (/^Current Stage:?\s*$/i.test(t)) {
      out.push('Current Stage:');
      pendingField = 'stage';
      continue;
    }
    if (pendingField === 'goal' && t && !t.startsWith('-')) {
      out.push(refineVagueGoalLine(stripSourceSuffix(t), domains));
      pendingField = undefined;
      continue;
    }
    if (pendingField === 'stage' && t && !t.startsWith('-')) {
      out.push(refineVagueStageLine(stripSourceSuffix(t), domains));
      pendingField = undefined;
      continue;
    }
    if (t.startsWith('- ')) {
      pendingField = undefined;
      const item = stripSourceSuffix(t.slice(2).trim());
      if (/^continue work in project/i.test(item)) {
        continue;
      }
      out.push(`- ${item}`);
      continue;
    }
    pendingField = undefined;
    out.push(line);
  }

  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normKey(s: string): string {
  return s.trim().toLowerCase();
}

function echoesTask(text: string, taskAnchor: string): boolean {
  const a = normKey(taskAnchor);
  if (a.length < 4) {
    return false;
  }
  const t = normKey(text);
  return t === a || t.includes(a) || a.includes(t);
}

/** Weak detection phrasing — no conclusive "focused on" tone. */
export function buildLightInsights(summary?: StateSummary, taskAnchor = ''): string[] {
  if (!summary) {
    return [];
  }
  const out: string[] = [];
  const domains = summary.active_domains;

  if (domains.includes('docs')) {
    out.push('documentation activity detected in recent work');
  }

  if (domains.includes('auth')) {
    out.push('authentication-related files recently modified');
  } else if (domains.includes('ui')) {
    out.push('UI-related files recently modified');
  } else if (domains.includes('mcp')) {
    out.push('MCP-related files recently modified');
  }

  const clusterFiles = summary.activity_clusters[0]?.files ?? [];
  const configTouches = clusterFiles.filter((f) =>
    /(^|\/)(\.env|config|manifest|settings|tsconfig|package\.json)/i.test(f.replace(/\\/g, '/')),
  );
  if (configTouches.length >= 2) {
    out.push('config file edits detected in recent activity');
  } else if (domains.includes('tests')) {
    out.push('test-related file activity detected');
  } else if (domains.includes('build')) {
    out.push('build tooling files recently touched');
  }

  const seen = new Set<string>();
  const filtered: string[] = [];
  for (const line of out) {
    if (echoesTask(line, taskAnchor)) {
      continue;
    }
    const k = normKey(line);
    if (seen.has(k)) {
      continue;
    }
    seen.add(k);
    filtered.push(line);
    if (filtered.length >= 3) {
      break;
    }
  }
  return filtered;
}

export function formatWorkingContextMarkdown(activeFiles: string[], recentWork: string[]): string {
  const lines: string[] = ['Active Files:'];
  if (activeFiles.length) {
    for (const f of activeFiles) {
      lines.push(`- ${f}`);
    }
  } else {
    lines.push('- (none above threshold)');
  }
  lines.push('');
  lines.push('Recent Work:');
  if (recentWork.length) {
    for (const r of recentWork) {
      lines.push(`- ${r}`);
    }
  } else {
    lines.push('- (no recent edits in buffer)');
  }
  return lines.join('\n');
}
