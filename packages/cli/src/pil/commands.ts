import {
  readStateJson,
  readWorkspaceStatus,
  readProjectBuiltState,
  readIntentGraphVNext,
  readGovernanceDecision,
  readDecisionProvenanceGraph,
  readProjectEvolutionTimeline,
  readProjectGraph,
  readConfidenceIndex,
  readWhyLayer,
  readProjectIntelligenceHealth,
  deriveProjectIntelligenceHealth,
  readDecisionLog,
  readHandoffArtifact,
  readProjectKnowledgeGraph,
  setGitSubprocessAllowed,
  syncWorkspaceState,
  loadTransferExportInput,
  buildTransferContextSnapshot,
  buildFullIntelligenceMarkdown,
  formatTransferContextMarkdown,
  formatTransferContextJson,
  finalizeTransferContextText,
  getProjectHandoff,
  captureProjectFocus,
  captureProjectNote,
  captureProjectDecision,
  retrieveEvolution,
  retrieveProvenance,
  retrieveImpact,
} from '@contora/state-core';
import { copyToClipboard } from '../handoff/clipboard.js';

export const PIL_USAGE = `Contorium PIL Runtime — AI Project Intelligence Layer (v3.0)

Three capability groups (mirrors IDE / MCP):

  Inspect — read project intelligence
    contorium inspect state [path]
    contorium inspect intent [path]
    contorium inspect decision [path]
    contorium inspect timeline [path]
    contorium inspect graph [path]
    contorium inspect confidence [path]
    contorium inspect impact [path]
    contorium inspect evolution [path]
    contorium inspect provenance [path]
    contorium inspect health [path]
    contorium inspect why [path]
    contorium inspect handoff [path]

  Transfer — export compressed intelligence
    contorium transfer [--mode context|intelligence|story|essence|handoff] [path] [--copy]
    contorium transfer context|intelligence|handoff [path]   (legacy positional)

  Capture — write intelligence records
    contorium capture focus [path] --text "<focus>"
    contorium capture note [path] --text "<note>"
    contorium capture decision [path] --selected "<choice>" [--reason "..."]

Legacy aliases (still supported):
  contorium snapshot copy  →  transfer context
  contorium export intelligence  →  transfer intelligence
  contorium state / handoff / graph / timeline / knowledge  →  inspect *
`;

function flagValue(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) {
    return process.argv[i + 1]!;
  }
  return fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function ensureUnderstanding(root: string): Promise<void> {
  setGitSubprocessAllowed(true);
  await syncWorkspaceState(root, 'cli', { refreshGit: true, forceArtifacts: true });
}

async function printJson(data: unknown): Promise<void> {
  console.log(JSON.stringify(data, null, 2));
}

async function cmdInspectTarget(root: string, target: string): Promise<void> {
  switch (target) {
    case 'state': {
      const [state, status, built] = await Promise.all([
        readStateJson(root),
        readWorkspaceStatus(root),
        readProjectBuiltState(root),
      ]);
      await printJson({ workspaceRoot: root, state, status, built_state: built });
      return;
    }
    case 'intent': {
      const graph = await readIntentGraphVNext(root);
      await printJson({ workspaceRoot: root, found: !!graph?.nodes?.length, intent_graph: graph });
      return;
    }
    case 'decision': {
      const [decision, graph, log] = await Promise.all([
        readGovernanceDecision(root),
        readDecisionProvenanceGraph(root),
        readDecisionLog(root),
      ]);
      await printJson({
        workspaceRoot: root,
        decision,
        decision_graph: graph,
        decision_log: log,
      });
      return;
    }
    case 'timeline': {
      const timeline = await readProjectEvolutionTimeline(root);
      await printJson({ workspaceRoot: root, timeline });
      return;
    }
    case 'graph': {
      let graph = await readProjectGraph(root);
      if (!graph) {
        await ensureUnderstanding(root);
        graph = await readProjectGraph(root);
      }
      await printJson({ workspaceRoot: root, found: !!graph, graph });
      return;
    }
    case 'knowledge': {
      let kg = await readProjectKnowledgeGraph(root);
      if (!kg) {
        await ensureUnderstanding(root);
        kg = await readProjectKnowledgeGraph(root);
      }
      await printJson({ workspaceRoot: root, found: !!kg, knowledge: kg });
      return;
    }
    case 'confidence': {
      const index = await readConfidenceIndex(root);
      await printJson({ workspaceRoot: root, confidence_index: index });
      return;
    }
    case 'health': {
      let health = await readProjectIntelligenceHealth(root);
      if (!health) {
        health = await deriveProjectIntelligenceHealth(root).catch(() => null);
      }
      await printJson({ workspaceRoot: root, health });
      return;
    }
    case 'why': {
      const why = await readWhyLayer(root);
      await printJson({ workspaceRoot: root, why });
      return;
    }
    case 'impact': {
      const anchor = flagValue('--anchor', '') || undefined;
      const { graph, entries } = await retrieveImpact(root, anchor);
      await printJson({ workspaceRoot: root, found: entries.length > 0, impact_graph: graph, entries });
      return;
    }
    case 'evolution': {
      const anchor = flagValue('--anchor', '') || undefined;
      const { graph, chains } = await retrieveEvolution(root, anchor);
      await printJson({ workspaceRoot: root, found: chains.length > 0, evolution_graph: graph, chains });
      return;
    }
    case 'provenance': {
      const anchor = flagValue('--anchor', '') || undefined;
      const { chain, entries } = await retrieveProvenance(root, anchor);
      await printJson({ workspaceRoot: root, found: entries.length > 0, provenance_chain: chain, entries });
      return;
    }
    case 'handoff': {
      let handoff = await readHandoffArtifact(root);
      if (!handoff) {
        await ensureUnderstanding(root);
        handoff = await readHandoffArtifact(root);
      }
      await printJson({ workspaceRoot: root, handoff });
      return;
    }
    default:
      process.stderr.write(PIL_USAGE);
      process.exit(1);
  }
}

async function cmdTransferMode(root: string, mode: string): Promise<void> {
  const copy = hasFlag('--copy') || hasFlag('--copy-to-ai');
  const flagMode = flagValue('--mode', '');
  if (flagMode) {
    mode = flagMode;
  }

  if (mode === 'story' || mode === 'essence') {
    const { syncCognitiveInteractionLayer, runCognitiveKernel, setGitSubprocessAllowed, syncWorkspaceState } =
      await import('@contora/state-core');
    setGitSubprocessAllowed(true);
    await syncWorkspaceState(root, 'cli', { refreshGit: true }).catch(() => undefined);
    await syncCognitiveInteractionLayer(root, 'cli');
    const out = await runCognitiveKernel(root, { mode: mode === 'story' ? 'story' : 'essence' });
    const payload = out.result as { formatted_markdown?: string };
    const text = payload.formatted_markdown ?? JSON.stringify(out.result, null, 2);
    if (copy) {
      if (copyToClipboard(text)) {
        console.error(`Transfer ${mode}: copied to clipboard`);
        return;
      }
    }
    process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
    return;
  }

  if (mode === 'context') {
    await ensureUnderstanding(root);
    const input = await loadTransferExportInput(root);
    const snapshot = await buildTransferContextSnapshot(input);
    const format = flagValue('--format', 'markdown');
    const asJson = format === 'json';
    const raw = asJson ? formatTransferContextJson(snapshot) : formatTransferContextMarkdown(snapshot);
    const text = finalizeTransferContextText(raw, asJson);
    if (copy) {
      if (copyToClipboard(text)) {
        console.error('Transfer Context: copied to clipboard');
        return;
      }
      console.error('Transfer Context: clipboard unavailable — writing to stdout');
    }
    process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
    return;
  }

  if (mode === 'intelligence') {
    await ensureUnderstanding(root);
    const input = await loadTransferExportInput(root);
    const text = await buildFullIntelligenceMarkdown(input);
    if (copy) {
      if (copyToClipboard(text)) {
        console.error('Transfer Intelligence: copied to clipboard');
        return;
      }
      console.error('Transfer Intelligence: clipboard unavailable — writing to stdout');
    }
    process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
    return;
  }

  if (mode === 'handoff' || mode === 'runtime') {
    await ensureUnderstanding(root);
    const handoff = await getProjectHandoff(root, 'markdown');
    const text = handoff.text ?? '';
    if (!text) {
      console.error('contorium transfer handoff: handoff not ready — save changes or run sync');
      process.exit(1);
    }
    if (copy) {
      if (copyToClipboard(text)) {
        console.error('Transfer Handoff: copied to clipboard');
        return;
      }
    }
    process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
    return;
  }

  process.stderr.write(PIL_USAGE);
  process.exit(1);
}

async function cmdCaptureKind(root: string, kind: string): Promise<void> {
  switch (kind) {
    case 'focus': {
      const text = flagValue('--text', '');
      if (!text) {
        console.error('contorium capture focus: --text is required');
        process.exit(1);
      }
      const result = await captureProjectFocus(root, text, 'cli');
      await printJson(result);
      return;
    }
    case 'note': {
      const text = flagValue('--text', '');
      if (!text) {
        console.error('contorium capture note: --text is required');
        process.exit(1);
      }
      const result = await captureProjectNote(root, text, 'cli');
      await printJson(result);
      return;
    }
    case 'decision': {
      const selected = flagValue('--selected', '');
      if (!selected) {
        console.error('contorium capture decision: --selected is required');
        process.exit(1);
      }
      const result = await captureProjectDecision(root, {
        selected,
        reason: flagValue('--reason', '') || undefined,
        intent_id: flagValue('--intent', '') || undefined,
        decision_id: flagValue('--id', '') || undefined,
      });
      await printJson(result);
      return;
    }
    default:
      process.stderr.write(PIL_USAGE);
      process.exit(1);
  }
}

export async function cmdPil(root: string, group: 'inspect' | 'transfer' | 'capture'): Promise<void> {
  let target = process.argv[3];
  if (group === 'transfer' && hasFlag('--mode')) {
    target = flagValue('--mode', 'context');
  }
  if (!target && group === 'transfer') {
    target = 'context';
  }
  if (!target) {
    process.stderr.write(PIL_USAGE);
    process.exit(group ? 1 : 0);
  }
  switch (group) {
    case 'inspect':
      await cmdInspectTarget(root, target);
      return;
    case 'transfer':
      await cmdTransferMode(root, target);
      return;
    case 'capture':
      await cmdCaptureKind(root, target);
      return;
  }
}
