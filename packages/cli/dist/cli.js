#!/usr/bin/env node
import * as path from 'node:path';
import { buildUnderstandingExportJson, confirmHandoffInjection, filterMappingsByConfidence, getProjectHandoff, prepareHandoffInjection, readChangeArtifact, readHandoffArtifact, readKnowledgeSnapshot, readProjectGraph, readProjectKnowledgeGraph, readProjectSnapshotMarkdown, readProjectTimeline, readStateJson, readWorkspaceStatus, setGitSubprocessAllowed, skipHandoffInjection, syncWorkspaceState, } from '@contora/state-core';
import { isDashboardWorkerRunning, readDashboardStatus, runAttach, wakeDashboardOnActivity, writeDashboardSignal, } from './dashboard/index.js';
import { loadDashboardState } from './dashboard/artifacts.js';
import { buildDashboardExportText } from './dashboard/exportContext.js';
import { releaseDashboardSpawnLock } from './dashboard/spawnLock.js';
import { spawnDashboardTerminal } from './dashboard/spawn.js';
import { stopDashboardWorker } from './dashboard/daemon.js';
import { bootstrapContoriumRuntime } from './runtime/bootstrap.js';
import { copyToClipboard } from './handoff/clipboard.js';
import { cmdGovernance } from './governance/commands.js';
import { cmdCheckAction, cmdControl, cmdGetGovernance, cmdUpdateProjectIntent, } from './control/commands.js';
const USAGE = `Contorium CLI — runtime adapter (same state-core as IDE / MCP)

Usage:
  contorium init [workspaceRoot]       Bootstrap or merge .contora/state.json
  contorium sync [workspaceRoot]       Rescan workspace and refresh state (one-shot)
  contorium snapshot [workspaceRoot]   Print PROJECT SNAPSHOT markdown
  contorium status [workspaceRoot]     JSON summary (mode, source, git counts)
  contorium state [workspaceRoot]      Print state.json (pretty JSON)

V3.1 understanding (mirrors MCP get_project_*):
  contorium handoff [path] [--format compact|markdown|json]   get_handoff (default: compact)
  contorium handoff --show | --hide | --copy-to-ai | --filter  Dashboard signals (debug)
  contorium handoff --prompt-new-chat              Debug: force inject prompt (TTY)
  contorium change [path]                             change.json
  contorium graph [path]                              graph.json (change neighborhood)
  contorium timeline [path]                           timeline.json
  contorium knowledge [path] [--min-confidence N]     knowledge graph (default filter 0.7)
  contorium graph-snapshot [path]                     cognitive snapshot (compact)
  contorium export [path] [--format json|markdown]    unified export (handoff + governance)

Governance (unified .contora/governance/* artifacts):
  contorium governance review [path] --target <file>
  contorium governance cycle [path] [--target <file>]
  contorium governance export [path] [--copy]

Control surface (control-core):
  contorium control governance [path]               get_governance
  contorium control check [path] --target <file>    check_action
  contorium control intent [path] "<text>"          update_project_intent
  contorium control analyze [path]                  analyze_project
  contorium control execute [path] --target <file>  validate_governance loop
  contorium control ready [path]                    bootstrap governance + sync

Runtime (CRBP — auto attach via IDE / MCP initialize / workspace activity):
  contorium bootstrap [path] [--source ide|mcp|cli]   Runtime attach (MCP calls on init)

Default workspaceRoot: current directory
`;
function isPathLike(value) {
    return (value === '.' ||
        value === '..' ||
        value.startsWith('/') ||
        value.includes('\\') ||
        /^[A-Za-z]:[/\\]/.test(value));
}
function workspaceArg() {
    const argv = process.argv.slice(2).filter((a) => !a.startsWith('--'));
    const cmd = argv[0];
    let rest = argv.slice(1);
    if (cmd === 'dashboard') {
        const sub = rest[0];
        if (sub === 'show' || sub === 'hide' || sub === 'line' || sub === 'wake' || sub === 'open') {
            rest = rest.slice(1);
        }
        else if (sub === 'filter') {
            rest = rest.slice(1);
            if (rest[0] && isPathLike(rest[0])) {
                rest = rest.slice(1);
            }
        }
    }
    const candidate = rest.find((a) => isPathLike(a));
    return path.resolve(candidate || process.cwd());
}
function dashboardFilterSymbol() {
    const argv = process.argv.slice(2).filter((a) => !a.startsWith('--'));
    if (argv[0] !== 'dashboard' || argv[1] !== 'filter') {
        return undefined;
    }
    let rest = argv.slice(2);
    if (rest[0] && isPathLike(rest[0])) {
        rest = rest.slice(1);
    }
    return rest[0];
}
function flagValue(name, fallback) {
    const i = process.argv.indexOf(name);
    if (i >= 0 && process.argv[i + 1]) {
        return process.argv[i + 1];
    }
    return fallback;
}
function flagNumber(name) {
    const raw = flagValue(name, '');
    if (!raw) {
        return undefined;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
}
function basenameOf(rel) {
    const parts = rel.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : rel;
}
async function ensureUnderstanding(root) {
    setGitSubprocessAllowed(true);
    await syncWorkspaceState(root, 'cli', { refreshGit: true, forceArtifacts: true });
}
async function printJson(data) {
    console.log(JSON.stringify(data, null, 2));
}
async function cmdInit(root) {
    setGitSubprocessAllowed(true);
    const result = await syncWorkspaceState(root, 'cli', { refreshGit: true, forceArtifacts: true });
    const boot = await bootstrapContoriumRuntime(root, 'cli');
    console.log(JSON.stringify({ workspaceRoot: root, ...result, runtime: boot }, null, 2));
}
async function cmdSync(root) {
    setGitSubprocessAllowed(true);
    const result = await syncWorkspaceState(root, 'cli', { refreshGit: true });
    if (result.updated) {
        await wakeDashboardOnActivity(root, 'cli', { kind: 'sync', detail: 'sync' });
    }
    console.log(JSON.stringify({ workspaceRoot: root, ...result }, null, 2));
}
function bootstrapSourceFlag() {
    const raw = flagValue('--source', 'cli');
    if (raw === 'ide' || raw === 'mcp' || raw === 'cli') {
        return raw;
    }
    return 'cli';
}
async function cmdBootstrap(root) {
    const source = bootstrapSourceFlag();
    const reopen = process.argv.includes('--reopen-dashboard');
    const skipSync = process.argv.includes('--skip-sync');
    const quiet = process.argv.includes('--quiet') || source === 'mcp' || skipSync;
    const result = await bootstrapContoriumRuntime(root, source, {
        reopenDashboard: reopen,
        skipInitialSync: skipSync || source === 'mcp',
    });
    if (!quiet && result.mode === 'already_running') {
        console.error('[contorium] dashboard worker already running — reopen: contorium bootstrap --reopen-dashboard · or run .contora/dashboard.cmd');
    }
    if (!quiet && process.stdout.isTTY) {
        await printJson(result);
    }
}
async function cmdSnapshot(root) {
    const existing = await readProjectSnapshotMarkdown(root);
    if (existing) {
        process.stdout.write(existing.endsWith('\n') ? existing : `${existing}\n`);
        return;
    }
    await ensureUnderstanding(root);
    const md = await readProjectSnapshotMarkdown(root);
    process.stdout.write(md ?? '');
}
async function cmdStatus(root) {
    const status = await readWorkspaceStatus(root);
    console.log(JSON.stringify(status, null, 2));
}
async function cmdState(root) {
    const state = await readStateJson(root);
    if (!state) {
        console.error('contorium state: no .contora/state.json — run: contorium init');
        process.exit(1);
    }
    console.log(JSON.stringify(state, null, 2));
}
function handoffFilterSymbol() {
    const i = process.argv.indexOf('--filter');
    if (i < 0 || !process.argv[i + 1]) {
        return undefined;
    }
    const raw = process.argv[i + 1];
    if (raw.startsWith('function=')) {
        return raw.slice('function='.length);
    }
    if (raw.startsWith('file=')) {
        return raw.slice('file='.length);
    }
    return raw;
}
function hasHandoffFlag(name) {
    return process.argv.includes(name);
}
function hasCopyToAiFlag() {
    return hasHandoffFlag('--copy') || hasHandoffFlag('--copy-to-ai');
}
function hasPromptNewChatFlag() {
    return hasHandoffFlag('--prompt-new-chat');
}
async function cmdPromptNewChatHandoff(root) {
    const prep = await prepareHandoffInjection(root, { newChat: true });
    if (prep.alreadyInjected) {
        console.log('[Contorium] Runtime context already injected for this session.');
        const confirmed = await confirmHandoffInjection(root, 'markdown');
        if (confirmed.ok && confirmed.text && copyToClipboard(confirmed.text)) {
            console.error('Copy To AI: clipboard refreshed from injected context');
        }
        return;
    }
    if (!prep.shouldPrompt || !prep.prompt) {
        console.error('contorium handoff: no active runtime — save changes or run contorium bootstrap');
        process.exit(1);
    }
    console.log(prep.prompt);
    if (!process.stdin.isTTY) {
        console.error('contorium handoff: --prompt-new-chat requires an interactive TTY');
        process.exit(1);
    }
    const readline = await import('node:readline/promises');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question('Inject runtime to new AI chat? (Y/n): ')).trim().toLowerCase();
    rl.close();
    if (answer === 'n' || answer === 'no') {
        await skipHandoffInjection(root);
        console.log('Skipped — start chat without injected context.');
        return;
    }
    const result = await confirmHandoffInjection(root, 'markdown');
    if (!result.ok || !result.text) {
        console.error(result.hint ?? 'Injection failed');
        process.exit(1);
    }
    if (copyToClipboard(result.text)) {
        console.log('Injected — clipboard ready for new chat');
        return;
    }
    console.log(`Injected → ${result.filePath}`);
    process.stdout.write(result.text.endsWith('\n') ? result.text : `${result.text}\n`);
}
async function cmdHandoff(root) {
    const filter = handoffFilterSymbol();
    if (hasPromptNewChatFlag()) {
        await cmdPromptNewChatHandoff(root);
        return;
    }
    if (hasHandoffFlag('--show')) {
        const running = await isDashboardWorkerRunning(root);
        if (running) {
            await writeDashboardSignal(root, 'expand');
            if (filter) {
                await writeDashboardSignal(root, 'filter', filter);
            }
        }
        else {
            await bootstrapContoriumRuntime(root, 'cli');
            await writeDashboardSignal(root, 'expand');
        }
        if (!hasHandoffFlag('--format') && !hasCopyToAiFlag()) {
            const line = await getProjectHandoff(root, 'compact', filter);
            console.log(line.text ?? '[Contorium] task: (starting) | last: — | agent: cli');
            return;
        }
    }
    if (hasHandoffFlag('--hide')) {
        await writeDashboardSignal(root, 'minimize');
        console.log('handoff: minimized (passive mode)');
        return;
    }
    if (filter && !hasHandoffFlag('--show')) {
        await writeDashboardSignal(root, 'filter', filter);
    }
    let result = await getProjectHandoff(root, 'compact', filter);
    if (!result.found) {
        await ensureUnderstanding(root);
        result = await getProjectHandoff(root, 'compact', filter);
    }
    const formatRaw = flagValue('--format', hasCopyToAiFlag() ? 'markdown' : 'compact');
    const format = formatRaw === 'md'
        ? 'markdown'
        : formatRaw === 'json' || formatRaw === 'markdown' || formatRaw === 'compact'
            ? formatRaw
            : 'compact';
    result = await getProjectHandoff(root, format, filter);
    if (!result.found || !result.text) {
        console.error('contorium handoff: not generated — no recent code changes detected');
        process.exit(1);
    }
    if (hasCopyToAiFlag()) {
        const dashState = await loadDashboardState(root);
        const exportText = await buildDashboardExportText(root, dashState, filter);
        if (!exportText) {
            console.error('contorium handoff: not generated — no recent code changes detected');
            process.exit(1);
        }
        const copied = copyToClipboard(exportText);
        if (copied) {
            console.error('Copy To AI: ready — paste in your next chat');
            return;
        }
        process.stderr.write('Copy To AI: clipboard unavailable — output below\n');
        process.stdout.write(exportText.endsWith('\n') ? exportText : `${exportText}\n`);
        return;
    }
    process.stdout.write(result.text.endsWith('\n') ? result.text : `${result.text}\n`);
}
async function cmdChange(root) {
    let change = await readChangeArtifact(root);
    if (!change) {
        await ensureUnderstanding(root);
        change = await readChangeArtifact(root);
    }
    if (!change) {
        console.error('contorium change: not generated');
        process.exit(1);
    }
    await printJson({ workspaceRoot: root, found: true, change });
}
async function cmdGraph(root) {
    let graph = await readProjectGraph(root);
    if (!graph) {
        await ensureUnderstanding(root);
        graph = await readProjectGraph(root);
    }
    if (!graph) {
        console.error('contorium graph: not generated');
        process.exit(1);
    }
    await printJson({ workspaceRoot: root, found: true, graph });
}
async function cmdTimeline(root) {
    let timeline = await readProjectTimeline(root);
    if (!timeline) {
        await ensureUnderstanding(root);
        timeline = await readProjectTimeline(root);
    }
    if (!timeline) {
        console.error('contorium timeline: not generated — requires git history');
        process.exit(1);
    }
    await printJson({ workspaceRoot: root, found: true, timeline });
}
async function cmdKnowledge(root) {
    let knowledge = await readProjectKnowledgeGraph(root);
    if (!knowledge) {
        await ensureUnderstanding(root);
        knowledge = await readProjectKnowledgeGraph(root);
    }
    if (!knowledge) {
        console.error('contorium knowledge: not generated — save code changes or run sync');
        process.exit(1);
    }
    const threshold = flagNumber('--min-confidence') ?? 0.7;
    const { inferenceMappings, ...canonical } = knowledge;
    const payload = {
        ...canonical,
        intentMappings: filterMappingsByConfidence(knowledge.intentMappings, threshold),
    };
    await printJson({ workspaceRoot: root, found: true, knowledge: payload });
}
async function cmdGraphSnapshot(root) {
    let snapshot = await readKnowledgeSnapshot(root);
    if (!snapshot) {
        await ensureUnderstanding(root);
        snapshot = await readKnowledgeSnapshot(root);
    }
    if (!snapshot) {
        console.error('contorium graph-snapshot: not generated');
        process.exit(1);
    }
    await printJson({ workspaceRoot: root, found: true, snapshot });
}
async function cmdAttach(root) {
    const intervalRaw = flagValue('--interval', '500');
    const timeoutRaw = flagValue('--timeout', '0');
    const intervalMs = Math.max(200, Number(intervalRaw) || 500);
    const timeoutMs = Math.max(0, Number(timeoutRaw) || 0);
    const useColor = !process.argv.includes('--no-color') && !!process.stdout.isTTY;
    const once = process.argv.includes('--once');
    const startExpanded = process.argv.includes('--expanded');
    const autoAttach = process.argv.includes('--auto');
    const headless = process.argv.includes('--headless');
    await runAttach({
        workspaceRoot: root,
        intervalMs,
        timeoutMs,
        useColor,
        once,
        startExpanded,
        autoAttach,
        headless,
    });
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function waitForDashboardFrame(root, timeoutMs = 2500) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const status = await readDashboardStatus(root);
        if (status?.frame) {
            return status.frame;
        }
        await sleep(150);
    }
    return undefined;
}
const DASHBOARD_HELP = `Contorium Runtime Dashboard — no CLI commands required.

1. Edit/save code → worker auto-starts (IDE / MCP / CLI adapters)
2. Passive line appears automatically (IDE status bar + Contorium Dashboard terminal)
3. Expand: status bar click · Ctrl+Shift+C · v in dashboard terminal
4. Minimize: Ctrl+Shift+M · m in dashboard terminal

Subcommands here are internal/debug only.
  contorium dashboard open [path]   Reopen Contorium Dashboard terminal (Windows: .contora/dashboard.cmd)
`;
function dashboardWakeSource() {
    const i = process.argv.indexOf('--source');
    const raw = i >= 0 ? process.argv[i + 1] : 'cli';
    if (raw === 'ide' || raw === 'mcp' || raw === 'cli') {
        return raw;
    }
    return 'cli';
}
function dashboardWakeDetail() {
    const i = process.argv.indexOf('--detail');
    return i >= 0 ? process.argv[i + 1] : undefined;
}
async function cmdDashboardWake(root) {
    const source = dashboardWakeSource();
    const detail = dashboardWakeDetail();
    await wakeDashboardOnActivity(root, source, {
        kind: 'event',
        detail,
        echoPassive: source !== 'ide',
    });
}
async function cmdDashboardControl(root, action) {
    const running = await isDashboardWorkerRunning(root);
    switch (action) {
        case 'open':
            await stopDashboardWorker(root);
            await releaseDashboardSpawnLock(root);
            spawnDashboardTerminal(root);
            process.stderr.write('[contorium] dashboard terminal opened\n');
            return;
        case 'wake':
            await cmdDashboardWake(root);
            return;
        case 'line': {
            const status = await readDashboardStatus(root);
            if (status?.line) {
                console.log(status.line);
                return;
            }
            console.log('[○] Contorium idle — waiting for file/function activity…');
            return;
        }
        case 'show':
            if (!running) {
                return;
            }
            await writeDashboardSignal(root, 'expand');
            return;
        case 'hide':
            await writeDashboardSignal(root, 'minimize');
            console.log(running ? 'dashboard: minimized' : 'dashboard: minimize signal sent');
            return;
        case 'filter': {
            const symbol = dashboardFilterSymbol();
            if (!symbol) {
                await writeDashboardSignal(root, 'clear-filter');
                console.log('dashboard: filter cleared');
                return;
            }
            await writeDashboardSignal(root, 'filter', symbol);
            console.log(`dashboard: filter → "${symbol}"`);
            return;
        }
        default:
            process.stdout.write(DASHBOARD_HELP);
    }
}
async function cmdExport(root) {
    const format = flagValue('--format', 'markdown');
    if (format === 'json') {
        await ensureUnderstanding(root);
        const [snapshot, handoff, timeline, state, knowledgeSnapshot] = await Promise.all([
            readProjectSnapshotMarkdown(root),
            readHandoffArtifact(root),
            readProjectTimeline(root),
            readStateJson(root),
            readKnowledgeSnapshot(root),
        ]);
        const taskAnchor = state?.currentTask?.trim() || '';
        if (!handoff) {
            console.error('contorium export: handoff not generated');
            process.exit(1);
        }
        const dashState = await loadDashboardState(root);
        const governanceText = await buildDashboardExportText(root, dashState);
        await printJson({
            taskAnchor: taskAnchor || '(not set)',
            ...buildUnderstandingExportJson({
                handoff,
                timeline,
                projectSnapshot: snapshot,
                knowledgeSnapshot: knowledgeSnapshot ?? undefined,
            }),
            governance_export: governanceText ?? undefined,
        });
        return;
    }
    const dashState = await loadDashboardState(root);
    const text = await buildDashboardExportText(root, dashState);
    if (!text) {
        console.error('contorium export: not ready — run sync or governance review');
        process.exit(1);
    }
    process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
}
async function main() {
    const cmd = process.argv[2];
    const root = workspaceArg();
    switch (cmd) {
        case 'init':
            await cmdInit(root);
            return;
        case 'bootstrap':
            await cmdBootstrap(root);
            return;
        case 'sync':
            await cmdSync(root);
            return;
        case 'snapshot':
            await cmdSnapshot(root);
            return;
        case 'status':
            await cmdStatus(root);
            return;
        case 'state':
            await cmdState(root);
            return;
        case 'handoff':
            await cmdHandoff(root);
            return;
        case 'change':
            await cmdChange(root);
            return;
        case 'graph':
            await cmdGraph(root);
            return;
        case 'timeline':
            await cmdTimeline(root);
            return;
        case 'knowledge':
            await cmdKnowledge(root);
            return;
        case 'graph-snapshot':
            await cmdGraphSnapshot(root);
            return;
        case 'export':
            await cmdExport(root);
            return;
        case 'attach':
            await cmdAttach(root);
            return;
        case 'governance':
            await cmdGovernance(root);
            return;
        case 'get-governance':
        case 'get_governance':
            await cmdGetGovernance(root);
            return;
        case 'check-action':
        case 'check_action':
            await cmdCheckAction(root);
            return;
        case 'update-project-intent':
        case 'update_project_intent':
            await cmdUpdateProjectIntent(root);
            return;
        case 'control': {
            const sub = process.argv[3];
            await cmdControl(root, sub);
            return;
        }
        case 'dashboard': {
            const sub = process.argv[3];
            await cmdDashboardControl(root, sub ?? 'help');
            return;
        }
        default:
            process.stderr.write(USAGE);
            process.exit(cmd ? 1 : 0);
    }
}
main().catch((err) => {
    console.error('contorium:', err);
    process.exit(1);
});
