import { readAllAdrRecords, readAllCognitiveEvents } from './eventStore.js';
import type { HandoffReplayResult, HandoffReplayStage } from './types.js';

/** P2 — cognitive replay timeline (GitHub Replay for project intelligence). */
export async function buildHandoffReplay(workspaceRoot: string): Promise<HandoffReplayResult> {
  const [events, adrs] = await Promise.all([
    readAllCognitiveEvents(workspaceRoot),
    readAllAdrRecords(workspaceRoot),
  ]);

  const stages: HandoffReplayStage[] = [];

  const sortedEvents = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  for (const evt of sortedEvents.slice(-24)) {
    stages.push({
      date: evt.timestamp.slice(0, 10),
      label: evt.title,
      detail: evt.why || evt.summary || evt.decision || '',
    });
  }

  for (const adr of adrs.slice(-12)) {
    stages.push({
      date: adr.date.slice(0, 10),
      label: `Decision: ${adr.title}`,
      detail: adr.reason,
    });
  }

  stages.sort((a, b) => a.date.localeCompare(b.date));

  const formatted: string[] = ['Handoff Replay — cognitive evolution', ''];
  for (const s of stages) {
    formatted.push(s.date, '', s.label, s.detail ? `  ${s.detail}` : '', '↓', '');
  }
  if (formatted[formatted.length - 1] === '↓') {
    formatted.pop();
  }

  return { stages, formatted };
}
