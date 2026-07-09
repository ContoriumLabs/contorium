import { askProject, buildProjectJourney, exploreHistory, exploreImpact, exploreModuleHistoryFeed, getModuleHistory, runCognitiveKernel, readAllAdrRecords, readDecisionLifecycleMeta, writeDecisionLifecycleMeta, persistKnowledgeLifecycle, setGitSubprocessAllowed, syncCognitiveInteractionLayer, syncWorkspaceState, } from '@contora/state-core';
export const CIL_USAGE = `Contorium CIL v3 — Cognitive Interaction Layer

User-facing cognition over AI PIL storage. All requests route through Cognitive Kernel.

  contorium ask "<question>" [path] [--json] [--suggest]
  contorium next [path] [--json]
  contorium story [path] [--copy] [--json]
  contorium history [path] [--range today|yesterday|last_7_days|last_30_days|all]
  contorium history <module> [path]
  contorium decisions [path] [--json]
  contorium health [path] [--json]
  contorium review [path] [--json]     Knowledge review queue (Lifecycle)
  contorium lifecycle [path] [--json]  Knowledge Health + decision trust
  contorium lifecycle owner <decision-id> --owner <name>
  contorium lifecycle verify <decision-id> [--type manual|automatic|llm_assisted] [--by <name>]
  contorium lifecycle expire <decision-id> --days <n>
  contorium entity <name> [path] [--json]
  contorium essence [path] [--copy] [--json]
  contorium replay [path] [--json]
  contorium dna [path] [--copy] [--json]
  contorium journey [path] [--json]
  contorium impact <module> [path] [--json]

Examples:
  contorium ask --suggest
  contorium ask "What was the project state on 2024-06-18?"
  contorium transfer --mode=essence --copy
`;
function flagValue(name, fallback) {
    const i = process.argv.indexOf(name);
    if (i >= 0 && process.argv[i + 1]) {
        return process.argv[i + 1];
    }
    return fallback;
}
function hasFlag(name) {
    return process.argv.includes(name);
}
function argAfter(name) {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
}
async function ensureCil(root) {
    setGitSubprocessAllowed(true);
    await syncWorkspaceState(root, 'cli', { refreshGit: true }).catch(() => undefined);
    await syncCognitiveInteractionLayer(root, 'cli');
}
async function printJson(data) {
    console.log(JSON.stringify(data, null, 2));
}
async function printLines(lines) {
    for (const line of lines) {
        console.log(line);
    }
}
function lifecycleSubcommand() {
    const idx = process.argv.indexOf('lifecycle');
    const sub = idx >= 0 ? process.argv[idx + 1] : undefined;
    if (sub === 'owner' || sub === 'verify' || sub === 'expire') {
        return { sub, decisionId: process.argv[idx + 2] };
    }
    return {};
}
async function ensureDecisionExists(root, decisionId) {
    const adrs = await readAllAdrRecords(root);
    if (!adrs.some((a) => a.id === decisionId)) {
        console.error(`Unknown decision id: ${decisionId}`);
        if (adrs.length) {
            console.error(`Known decisions: ${adrs.map((a) => a.id).join(', ')}`);
        }
        process.exit(1);
    }
}
function parseVerificationType(raw) {
    if (raw === 'manual' || raw === 'automatic' || raw === 'llm_assisted') {
        return raw;
    }
    return 'manual';
}
async function updateLifecycleMeta(root, decisionId, patch) {
    await ensureDecisionExists(root, decisionId);
    const existing = (await readDecisionLifecycleMeta(root, decisionId)) ?? {};
    const next = { ...existing, ...patch };
    if (patch.owner?.trim() && existing.owner?.trim() && patch.owner.trim() !== existing.owner.trim()) {
        next.previous_owner = existing.owner;
        next.owner_changed_at = new Date().toISOString();
    }
    await writeDecisionLifecycleMeta(root, decisionId, next);
    await persistKnowledgeLifecycle(root);
    return next;
}
export async function cmdCil(root, sub) {
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
                const arg = process.argv[i];
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
            if (nextArg &&
                !nextArg.startsWith('--') &&
                nextArg !== root &&
                !rangeValues.has(nextArg)) {
                await ensureCil(root);
                const mod = await exploreModuleHistoryFeed(root, nextArg);
                await printLines(mod.formatted);
                if (hasFlag('--json')) {
                    await printJson(mod);
                }
                return;
            }
            const range = flagValue('--range', 'last_7_days');
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
            const result = out.result;
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
            const center = out.result;
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
            const story = out.result;
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
            const health = out.result;
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
            const result = out.result;
            if (result.answer) {
                console.log(result.answer);
            }
            else if (result.formatted) {
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
                    const now = new Date().toISOString();
                    const meta = await updateLifecycleMeta(root, decisionId, {
                        verified_at: now,
                        verified_by: argAfter('--by') ?? 'cli',
                        verification_type: parseVerificationType(argAfter('--type')),
                    });
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
            const result = out.result;
            if (result.answer) {
                console.log(result.answer);
            }
            else if (result.formatted) {
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
            const entity = out.result;
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
            const essence = out.result;
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
            const replay = out.result;
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
            const dna = out.result;
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
        default:
            console.log(CIL_USAGE);
    }
}
