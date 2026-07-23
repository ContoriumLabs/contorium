import {
  askProject,
  buildProjectJourney,
  exploreHistory,
  exploreImpact,
  exploreModuleHistoryFeed,
  getModuleHistory,
  runCognitiveKernel,
  readAllAdrRecords,
  readDecisionLifecycleMeta,
  writeDecisionLifecycleMeta,
  persistKnowledgeLifecycle,
  setGitSubprocessAllowed,
  syncCognitiveInteractionLayer,
  syncWorkspaceState,
  applyLifecycleVerification,
  formatDecisionWhyAnswer,
  findDecisionLifecycle,
  computeKnowledgeLifecycle,
  readKnowledgeLifecycle,
  formatValidityStateLabel,
  formatDecisionTimeline,
  type DecisionLifecycleMeta,
  type HistoryRange,
  type NextActionItem,
} from '@contora/state-core';

export const CIL_USAGE = `Contorium — Project memory & decision health

Core (start here):
  contorium ask "<question>" [path] [--json] [--suggest]
  contorium why <decision-id> [path] [--json]
  contorium health [path] [--json]
  contorium timeline [path] [--json]
  contorium history [path] [--range today|yesterday|last_7_days|last_30_days|all]
  contorium capture decision --selected "…"   (via: contorium capture)

Decision Health:
  contorium review [path] [--json]
  contorium lifecycle [path] [--json]
  contorium lifecycle inspect [path] [--json]
  contorium lifecycle verify <id> [--reason …] [--evidence …]
  contorium lifecycle owner <id> --owner <name>

Advanced:
  contorium decisions · next · journey · impact · essence · dna · replay · entity

Examples:
  contorium ask "Why don't we use PostgreSQL?"
  contorium ask --suggest
  contorium timeline
  contorium why ADR-001
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

function argAfter(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function ensureCil(root: string): Promise<void> {
  setGitSubprocessAllowed(true);
  await syncWorkspaceState(root, 'cli', { refreshGit: true }).catch(() => undefined);
  await syncCognitiveInteractionLayer(root, 'cli');
}

async function printJson(data: unknown): Promise<void> {
  console.log(JSON.stringify(data, null, 2));
}

async function printLines(lines: string[]): Promise<void> {
  for (const line of lines) {
    console.log(line);
  }
}

function lifecycleSubcommand(): { sub?: string; decisionId?: string } {
  const idx = process.argv.indexOf('lifecycle');
  const sub = idx >= 0 ? process.argv[idx + 1] : undefined;
  if (sub === 'inspect') {
    return { sub };
  }
  if (sub === 'owner' || sub === 'verify' || sub === 'expire') {
    return { sub, decisionId: process.argv[idx + 2] };
  }
  return {};
}

async function ensureDecisionExists(root: string, decisionId: string): Promise<void> {
  const adrs = await readAllAdrRecords(root);
  if (!adrs.some((a) => a.id === decisionId)) {
    console.error(`Unknown decision id: ${decisionId}`);
    if (adrs.length) {
      console.error(`Known decisions: ${adrs.map((a) => a.id).join(', ')}`);
    }
    process.exit(1);
  }
}

function parseVerificationType(raw: string | undefined): DecisionLifecycleMeta['verification_type'] {
  if (raw === 'manual' || raw === 'automatic' || raw === 'llm_assisted') {
    return raw;
  }
  return 'manual';
}

async function updateLifecycleMeta(
  root: string,
  decisionId: string,
  patch: DecisionLifecycleMeta,
): Promise<DecisionLifecycleMeta> {
  await ensureDecisionExists(root, decisionId);
  const existing = (await readDecisionLifecycleMeta(root, decisionId)) ?? {};
  const next: DecisionLifecycleMeta = { ...existing, ...patch };
  if (patch.owner?.trim() && existing.owner?.trim() && patch.owner.trim() !== existing.owner.trim()) {
    next.previous_owner = existing.owner;
    next.owner_changed_at = new Date().toISOString();
  }
  await writeDecisionLifecycleMeta(root, decisionId, next);
  await persistKnowledgeLifecycle(root);
  return next;
}

export async function cmdCil(root: string, sub: string): Promise<void> {
  switch (sub) {
    case 'ask': {
      const qIdx = process.argv.indexOf('ask');
      if (hasFlag('--suggest')) {
        await ensureCil(root);
        const { buildSuggestedQuestions } = await import('@contora/state-core');
        const suggested = await buildSuggestedQuestions(root);
        await printLines(suggested.formatted);
        if (hasFlag('--json')) {
          await printJson(suggested);
        }
        return;
      }
      let question = '';
      for (let i = qIdx + 1; i < process.argv.length; i++) {
        const arg = process.argv[i]!;
        if (arg.startsWith('--') || arg === root) {
          break;
        }
        question = question ? `${question} ${arg}` : arg;
      }
      if (!question) {
        console.error('Usage: contorium ask "<question>" [path]  or  contorium ask --suggest');
        process.exit(1);
      }
      await ensureCil(root);
      const result = await askProject(root, question);
      console.log(result.answer);
      if (hasFlag('--json')) {
        await printJson(result);
      }
      return;
    }
    case 'history': {
      const hIdx = process.argv.indexOf('history');
      const nextArg = process.argv[hIdx + 1];
      const rangeValues = new Set(['today', 'yesterday', 'last_7_days', 'last_30_days', 'all']);
      if (
        nextArg &&
        !nextArg.startsWith('--') &&
        nextArg !== root &&
        !rangeValues.has(nextArg)
      ) {
        await ensureCil(root);
        const mod = await exploreModuleHistoryFeed(root, nextArg);
        await printLines(mod.formatted);
        if (hasFlag('--json')) {
          await printJson(mod);
        }
        return;
      }
      const range = flagValue('--range', 'last_7_days') as HistoryRange;
      await ensureCil(root);
      const history = await exploreHistory(root, range);
      await printLines(history.formatted);
      if (hasFlag('--json')) {
        await printJson(history);
      }
      return;
    }
    case 'next': {
      await ensureCil(root);
      const out = await runCognitiveKernel(root, { mode: 'next' });
      const result = out.result as { items?: NextActionItem[]; next_actions?: NextActionItem[] };
      const actions = result.items ?? result.next_actions ?? [];
      for (const item of actions) {
        console.log(`${item.task} — ${item.reason} (confidence ${item.confidence})`);
      }
      if (hasFlag('--json')) {
        await printJson(out.result);
      }
      return;
    }
    case 'decisions': {
      await ensureCil(root);
      const out = await runCognitiveKernel(root, { mode: 'decisions' });
      const center = out.result as { formatted?: string[] };
      if (center.formatted) {
        await printLines(center.formatted);
      }
      if (hasFlag('--json')) {
        await printJson(out.result);
      }
      return;
    }
    case 'journey': {
      await ensureCil(root);
      const journey = await buildProjectJourney(root);
      await printLines(journey.formatted);
      if (hasFlag('--json')) {
        await printJson(journey);
      }
      return;
    }
    case 'impact': {
      const iIdx = process.argv.indexOf('impact');
      const module = process.argv[iIdx + 1];
      if (!module || module.startsWith('--') || module === root) {
        console.error('Usage: contorium impact <module-or-file> [path]');
        process.exit(1);
      }
      await ensureCil(root);
      const { formatted } = await exploreImpact(root, module);
      await printLines(formatted);
      if (hasFlag('--json')) {
        await printJson(await exploreImpact(root, module));
      }
      return;
    }
    case 'story': {
      await ensureCil(root);
      const out = await runCognitiveKernel(root, { mode: 'story' });
      const story = out.result as { formatted_markdown?: string };
      const text = story.formatted_markdown ?? JSON.stringify(out.result, null, 2);
      console.log(text);
      if (hasFlag('--copy')) {
        const { copyToClipboard } = await import('../handoff/clipboard.js');
        await copyToClipboard(text);
        console.error('Copied Project Story to clipboard.');
      }
      if (hasFlag('--json')) {
        await printJson(out.result);
      }
      return;
    }
    case 'health': {
      await ensureCil(root);
      const out = await runCognitiveKernel(root, { mode: 'health' });
      const health = out.result as { formatted?: string[]; score?: number };
      if (health.formatted) {
        await printLines(health.formatted);
      }
      if (hasFlag('--json')) {
        await printJson(out.result);
      }
      return;
    }
    case 'review': {
      await ensureCil(root);
      const out = await runCognitiveKernel(root, { mode: 'review' });
      const result = out.result as { formatted?: string[]; answer?: string };
      if (result.answer) {
        console.log(result.answer);
      } else if (result.formatted) {
        await printLines(result.formatted);
      }
      if (hasFlag('--json')) {
        await printJson(out.result);
      }
      return;
    }
    case 'lifecycle': {
      const lifecycleEdit = lifecycleSubcommand();
      if (lifecycleEdit.sub) {
        if (lifecycleEdit.sub === 'inspect') {
          await ensureCil(root);
          const index = await computeKnowledgeLifecycle(root);
          const lines = ['Decision Health', ''];
          for (const r of index.decisions) {
            lines.push(`${r.decision_id}`, `Validity: ${formatValidityStateLabel(r.validity_state)}`);
            const cause = r.invalidation_reason_chain?.[1]?.event ?? r.validity_signals[0]?.reason;
            if (cause) {
              lines.push(`Cause: ${cause}`);
            }
            const assumption = r.assumptions?.[0]?.statement;
            if (assumption) {
              lines.push(`Affected assumption: ${assumption}`);
            }
            lines.push(`Confidence: ${(r.confidence.overall / 100).toFixed(2)}`, '');
          }
          await printLines(lines);
          if (hasFlag('--json')) {
            await printJson(index);
          }
          return;
        }
        const decisionId = lifecycleEdit.decisionId;
        if (!decisionId || decisionId.startsWith('--')) {
          console.error(`Usage: contorium lifecycle ${lifecycleEdit.sub} <decision-id> ...`);
          process.exit(1);
        }
        if (lifecycleEdit.sub === 'owner') {
          const owner = argAfter('--owner');
          if (!owner) {
            console.error('Usage: contorium lifecycle owner <decision-id> --owner <name>');
            process.exit(1);
          }
          const meta = await updateLifecycleMeta(root, decisionId, { owner });
          await printJson({ workspaceRoot: root, decision_id: decisionId, meta });
          return;
        }
        if (lifecycleEdit.sub === 'verify') {
          const existing = (await readDecisionLifecycleMeta(root, decisionId)) ?? {};
          const meta = await updateLifecycleMeta(
            root,
            decisionId,
            applyLifecycleVerification(existing, {
              by: argAfter('--by') ?? 'cli',
              type: parseVerificationType(argAfter('--type')),
              reason: argAfter('--reason'),
              evidence: argAfter('--evidence'),
            }),
          );
          await printJson({ workspaceRoot: root, decision_id: decisionId, meta });
          return;
        }
        if (lifecycleEdit.sub === 'expire') {
          const rawDays = argAfter('--days');
          const days = Number(rawDays);
          if (!Number.isFinite(days) || days <= 0) {
            console.error('Usage: contorium lifecycle expire <decision-id> --days <positive-number>');
            process.exit(1);
          }
          const meta = await updateLifecycleMeta(root, decisionId, { expire_after_days: Math.round(days) });
          await printJson({ workspaceRoot: root, decision_id: decisionId, meta });
          return;
        }
      }
      await ensureCil(root);
      const out = await runCognitiveKernel(root, { mode: 'lifecycle' });
      const result = out.result as { formatted?: string[]; answer?: string };
      if (result.answer) {
        console.log(result.answer);
      } else if (result.formatted) {
        await printLines(result.formatted);
      }
      if (hasFlag('--json')) {
        await printJson(out.result);
      }
      return;
    }
    case 'entity': {
      const eIdx = process.argv.indexOf('entity');
      const name = process.argv[eIdx + 1];
      if (!name || name.startsWith('--') || name === root) {
        console.error('Usage: contorium entity <name> [path]');
        process.exit(1);
      }
      await ensureCil(root);
      const out = await runCognitiveKernel(root, { mode: 'entity', topic: name });
      const entity = out.result as { formatted?: string[] };
      if (entity.formatted) {
        await printLines(entity.formatted);
      }
      if (hasFlag('--json')) {
        await printJson(out.result);
      }
      return;
    }
    case 'essence': {
      await ensureCil(root);
      const out = await runCognitiveKernel(root, { mode: 'essence' });
      const essence = out.result as { formatted_markdown?: string };
      const text = essence.formatted_markdown ?? JSON.stringify(out.result, null, 2);
      console.log(text);
      if (hasFlag('--copy')) {
        const { copyToClipboard } = await import('../handoff/clipboard.js');
        await copyToClipboard(text);
        console.error('Copied Project Essence to clipboard.');
      }
      if (hasFlag('--json')) {
        await printJson(out.result);
      }
      return;
    }
    case 'replay': {
      await ensureCil(root);
      const out = await runCognitiveKernel(root, { mode: 'replay' });
      const replay = out.result as { formatted?: string[] };
      if (replay.formatted) {
        await printLines(replay.formatted);
      }
      if (hasFlag('--json')) {
        await printJson(out.result);
      }
      return;
    }
    case 'dna': {
      await ensureCil(root);
      const out = await runCognitiveKernel(root, { mode: 'dna' });
      const dna = out.result as { formatted?: string[]; formatted_markdown?: string };
      const text = dna.formatted_markdown ?? dna.formatted?.join('\n') ?? JSON.stringify(out.result, null, 2);
      console.log(text);
      if (hasFlag('--copy')) {
        const { copyToClipboard } = await import('../handoff/clipboard.js');
        await copyToClipboard(text);
        console.error('Copied Project DNA to clipboard.');
      }
      if (hasFlag('--json')) {
        await printJson(out.result);
      }
      return;
    }
    case 'questions': {
      await ensureCil(root);
      const { buildSuggestedQuestions } = await import('@contora/state-core');
      const suggested = await buildSuggestedQuestions(root);
      await printLines(suggested.formatted);
      if (hasFlag('--json')) {
        await printJson(suggested);
      }
      return;
    }
    case 'module-history': {
      const mIdx = process.argv.indexOf('module-history');
      const module = process.argv[mIdx + 1];
      if (!module) {
        console.error('Usage: contorium module-history <module> [path]');
        process.exit(1);
      }
      await ensureCil(root);
      const events = await getModuleHistory(root, module);
      await printJson({ module, events });
      return;
    }
    case 'why': {
      const wIdx = process.argv.indexOf('why');
      const decisionId = process.argv[wIdx + 1];
      if (!decisionId || decisionId.startsWith('--') || decisionId === root) {
        console.error('Usage: contorium why <decision-id> [path]');
        process.exit(1);
      }
      await ensureCil(root);
      const index = await computeKnowledgeLifecycle(root);
      const record = findDecisionLifecycle(index, decisionId);
      if (!record) {
        console.error(`Unknown decision: ${decisionId}`);
        process.exit(1);
      }
      await printLines(formatDecisionWhyAnswer(record));
      if (hasFlag('--json')) {
        await printJson(record);
      }
      return;
    }
    case 'timeline': {
      await ensureCil(root);
      const [adrs, lc] = await Promise.all([
        readAllAdrRecords(root),
        computeKnowledgeLifecycle(root),
      ]);
      await printLines(formatDecisionTimeline(adrs, lc));
      if (hasFlag('--json')) {
        await printJson({ decisions: adrs, lifecycle: lc });
      }
      return;
    }
    default:
      console.log(CIL_USAGE);
  }
}
