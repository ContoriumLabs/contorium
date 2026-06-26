import { readStateJson } from '../bootstrap/bootstrapState.js';
import { readIntentGraphVNext } from '../intelligence/intentVNext.js';
import { readHandoffArtifact } from '../understanding/store.js';
import { readImpactGraph } from '../intelligence/dimensions/impactGraph.js';
import { freshnessFromAge, freshnessLabelText } from './confidenceLabels.js';
import { computeCognitiveHealth } from './cognitiveHealth.js';
import { exploreEntityKnowledge } from './knowledgeGraph.js';
import { readAllAdrRecords, readAllCognitiveEvents } from './eventStore.js';
import type { ActionConstraints, NextActionItem } from './types.js';

function confidenceScore(level: 'high' | 'medium' | 'low'): number {
  if (level === 'high') {
    return 0.9;
  }
  if (level === 'medium') {
    return 0.65;
  }
  return 0.4;
}

function actionConstraints(risk: 'low' | 'medium' | 'high'): ActionConstraints {
  return {
    risk,
    requires_confirmation: risk !== 'low',
    is_executable: false,
  };
}

/** Derive next actions — reads Event/Decision/State/Knowledge/Health, suggestions only. */
export async function deriveNextActions(workspaceRoot: string): Promise<NextActionItem[]> {
  const [state, handoff, intents, events, adrs, impact, health] = await Promise.all([
    readStateJson(workspaceRoot),
    readHandoffArtifact(workspaceRoot),
    readIntentGraphVNext(workspaceRoot),
    readAllCognitiveEvents(workspaceRoot),
    readAllAdrRecords(workspaceRoot),
    readImpactGraph(workspaceRoot),
    computeCognitiveHealth(workspaceRoot).catch(() => null),
  ]);

  const actions: NextActionItem[] = [];
  const seen = new Set<string>();

  const push = (item: NextActionItem): void => {
    const key = item.task.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    actions.push(item);
  };

  const focus = state?.currentTask?.trim() || handoff?.current_focus?.trim();
  if (focus) {
    push({
      task: focus,
      reason: 'Current project focus',
      confidence: confidenceScore('high'),
      source: 'focus',
      constraints: actionConstraints('low'),
    });
  }

  for (const na of handoff?.next_actions?.slice(0, 4) ?? []) {
    push({
      task: `${na.action}: ${na.target}`,
      reason: na.reason,
      confidence: confidenceScore('high'),
      source: 'handoff',
      constraints: actionConstraints('low'),
    });
  }

  for (const node of intents?.nodes ?? []) {
    const incomplete =
      !focus || !node.name.toLowerCase().includes(focus.slice(0, 12).toLowerCase());
    if (incomplete && node.name) {
      push({
        task: `Advance intent: ${node.name}`,
        reason: node.why?.trim() || 'Intent not fully reflected in current focus',
        confidence: confidenceScore(focus ? 'medium' : 'high'),
        source: 'intent',
        constraints: actionConstraints('medium'),
      });
    }
  }

  for (const adr of adrs) {
    if (adr.status === 'proposed') {
      push({
        task: `Review decision: ${adr.title}`,
        reason: 'Decision pending acceptance',
        confidence: confidenceScore('medium'),
        source: 'decision',
        constraints: actionConstraints('medium'),
      });
    }
    if (adr.freshness === 'stale' || adr.freshness === 'unknown') {
      push({
        task: `Verify decision: ${adr.title}`,
        reason: `Status ${freshnessLabelText(adr.freshness)} — last verified ${adr.last_verified?.slice(0, 10) ?? 'unknown'}`,
        confidence: confidenceScore('medium'),
        source: 'decision',
        constraints: actionConstraints('medium'),
      });
    }
  }

  const latestImpact = impact?.entries[impact.entries.length - 1];
  if (latestImpact && (latestImpact.blast_radius ?? 0) >= 0.6) {
    push({
      task: `Review high-impact change: ${latestImpact.source_entity}`,
      reason: `Blast radius ${(latestImpact.blast_radius ?? latestImpact.impact_radius ?? 0).toFixed(2)}`,
      confidence: confidenceScore('high'),
      source: 'impact',
      constraints: actionConstraints('high'),
    });
  }

  const recentDecision = events.find((e) => e.decision && freshnessFromAge(e.timestamp) === 'fresh');
  if (recentDecision?.decision) {
    push({
      task: `Follow through: ${recentDecision.decision}`,
      reason: recentDecision.why || 'Recent decision recorded',
      confidence: confidenceScore('medium'),
      source: 'decision',
      constraints: actionConstraints('medium'),
    });
  }

  for (const w of health?.warnings.filter((x) => x.severity !== 'low').slice(0, 3) ?? []) {
    push({
      task: `Address cognition gap: ${w.message}`,
      reason: `Cognitive health ${health?.score ?? 0}% — ${w.code}`,
      confidence: confidenceScore(w.severity === 'high' ? 'high' : 'medium'),
      source: 'decision',
      constraints: actionConstraints(w.severity === 'high' ? 'high' : 'medium'),
    });
  }

  const focusEntity = focus?.split(/\s+/).find((w) => w.length >= 3);
  if (focusEntity) {
    const kg = await exploreEntityKnowledge(workspaceRoot, focusEntity).catch(() => null);
    if (kg?.record && kg.record.events.length === 0 && kg.record.decisions.length === 0) {
      push({
        task: `Link focus "${focusEntity}" to decisions or events`,
        reason: 'Knowledge graph has no entity links for current focus',
        confidence: confidenceScore('low'),
        source: 'intent',
        constraints: actionConstraints('low'),
      });
    }
  }

  if (actions.length === 0) {
    push({
      task: 'Set current focus',
      reason: 'No focus or intent signal — run capture focus or IDE Current Focus',
      confidence: confidenceScore('low'),
      source: 'focus',
      constraints: actionConstraints('low'),
    });
  }

  return actions.slice(0, 8);
}

export async function getNextActions(workspaceRoot: string): Promise<string[]> {
  const items = await deriveNextActions(workspaceRoot);
  return items.map((a) => `${a.task} — ${a.reason} (${a.confidence})`);
}
