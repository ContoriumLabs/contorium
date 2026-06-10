import type { DashboardState } from './types.js';

export type ColorFn = (text: string) => string;

export interface ProjectMetrics {
  health: string;
  risk: string;
  riskLevel: 'low' | 'medium' | 'high';
  fileCount: number;
  velocity: 'HIGH' | 'MEDIUM' | 'LOW';
  velocityRatio: number;
  eventCount: number;
}

export function projectMetrics(state: DashboardState): ProjectMetrics {
  const risk = state.handoff?.impact_summary.risk ?? 'low';
  const fileCount = state.change?.changed_files?.length ?? 0;
  const velocity: ProjectMetrics['velocity'] =
    fileCount >= 5 ? 'HIGH' : fileCount >= 2 ? 'MEDIUM' : 'LOW';
  const velocityRatio = velocity === 'HIGH' ? 0.8 : velocity === 'MEDIUM' ? 0.5 : 0.2;
  const health = risk === 'high' ? 'CAUTION' : risk === 'medium' ? 'OK' : 'GOOD';

  return {
    health,
    risk: risk.toUpperCase(),
    riskLevel: risk,
    fileCount,
    velocity,
    velocityRatio,
    eventCount: state.status.eventCount,
  };
}

export function projectLabel(workspaceRoot: string): string {
  const norm = workspaceRoot.replace(/\\/g, '/').replace(/\/$/, '');
  const parts = norm.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1]! : workspaceRoot;
}

export function lastChangedFile(state: DashboardState): string {
  const files = state.change?.changed_files ?? [];
  if (files.length) {
    const f = files[files.length - 1]!.replace(/\\/g, '/');
    const parts = f.split('/');
    return parts[parts.length - 1] ?? f;
  }
  const kc = state.handoff?.key_changes?.[0]?.symbol;
  if (kc) {
    const parts = kc.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] ?? kc;
  }
  return '—';
}

export function progressBar(ratio: number, width = 10): string {
  const clamped = Math.max(0, Math.min(1, ratio));
  const filled = Math.round(clamped * width);
  return `[${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}]`;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

export function padVisible(text: string, width: number): string {
  const visible = text.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '').length;
  const pad = Math.max(0, width - visible);
  return `${text}${' '.repeat(pad)}`;
}

/** Box frame — terminal-friendly Unicode lines. */
export function renderBox(lines: string[], width: number): string[] {
  const inner = Math.max(20, width - 4);
  const top = `┌${'─'.repeat(inner)}┐`;
  const sep = `├${'─'.repeat(inner)}┤`;
  const bottom = `└${'─'.repeat(inner)}┘`;
  const body = lines.map((line) => {
    const clipped = truncate(line, inner);
    return `│ ${padVisible(clipped, inner)} │`;
  });
  return [top, ...body, bottom];
}

export function sectionDivider(width: number): string {
  return '─'.repeat(Math.max(16, width - 4));
}

export function sectionHeader(title: string, c: Record<string, ColorFn>): string {
  return `${c.bold('●')} ${c.bold(title)}`;
}
