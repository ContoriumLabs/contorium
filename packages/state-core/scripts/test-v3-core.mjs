/**
 * V3 Core feature tests — run: node scripts/test-v3-core.mjs [workspaceRoot]
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..'));
const m = await import('../dist/index.js');

const results = [];
function ok(name, cond, detail = '') {
  results.push({ name, pass: !!cond, detail });
  console.log(cond ? `  ✓ ${name}` : `  ✗ ${name}${detail ? ': ' + detail : ''}`);
}

console.log(`\nV3 Core tests — workspace: ${root}\n`);

// --- P1 Governance ---
console.log('## P1 Governance Core');
const govInit = await m.ensureGovernanceLayer(root);
ok('ensureGovernanceLayer returns initialized', govInit.initialized);

const summary = await m.getGovernanceSummary(root);
ok('getGovernanceSummary found', summary.found);
ok('constitution has principles', (summary.constitution?.principles?.length ?? 0) > 0);
ok('truth has mock patterns', (summary.truth?.mock_data?.length ?? 0) > 0);
ok('identity has name', !!summary.identity?.name);

const bundle = await m.loadGovernanceBundle(root);
ok('loadGovernanceBundle', !!bundle);

// --- P2 Cognitive ---
console.log('\n## P2 Cognitive MVP');
await m.syncCognitiveLayer(root, await m.readStateJson(root));
const cogState = await m.readCognitiveState(root);
ok('syncCognitiveLayer writes state', !!cogState?.version);

const cogUpdate = await m.updateCognitiveFromInput(root, 'fix MCP bootstrap in packages/mcp without breaking tests');
ok('updateCognitiveFromInput', cogUpdate.updated && !!cogUpdate.user_request?.goal);
ok('user-request overlay', cogUpdate.user_request?.goal.includes('MCP'));

const overlay = await m.readUserRequestOverlay(root);
ok('readUserRequestOverlay', !!overlay?.goal);

const intent = await m.readCognitiveIntent(root);
ok('readCognitiveIntent', !!intent?.goal);

const graph = await m.readCognitiveGraph(root);
ok('readCognitiveGraph', Array.isArray(graph?.nodes));

// --- P3 Lightweight Guard ---
console.log('\n## P3 Lightweight Guard');
const allow = await m.preActionCheck(root, { type: 'file_write', target_path: 'docs/README.md', description: 'update docs' });
ok('allow safe path', allow.allow && allow.action === 'allow');

const confirm = await m.preActionCheck(root, {
  type: 'file_write',
  target_path: 'packages/state-core/src/understanding/knowledgeGraph/test.ts',
});
ok('confirm protected path', confirm.action === 'confirm' && !confirm.allow);

const confirmed = await m.preActionCheck(root, {
  type: 'file_write',
  target_path: 'packages/state-core/src/understanding/knowledgeGraph/test.ts',
  user_confirmed: true,
});
ok('warn after user_confirmed on protected', confirmed.allow && confirmed.action === 'warn');

const block = await m.preActionCheck(root, {
  type: 'file_write',
  description: 'overwrite_core_logic in production',
});
ok('block forbidden action', block.action === 'block' && !block.allow);

const hardcode = await m.preActionCheck(root, {
  type: 'file_write',
  target_path: 'src/scorer.ts',
  code_snippet: 'const score = 0.8;\nreturn score;',
});
ok('confirm hardcode snippet', hardcode.action === 'confirm' && hardcode.detections.some((d) => d.type === 'hardcode_snippet'));

const detections = m.detectHardcodingInSnippet('const api_key = "sk-test123";');
ok('detectHardcodingInSnippet credentials', detections.length > 0);

// --- P4 Internal API ---
console.log('\n## P4 Internal API');
const analyzed = await m.analyzeProject(root);
ok('analyzeProject governance', analyzed.governance.found);
ok('analyzeProject handoff fields', typeof analyzed.handoff === 'object');

const projectState = await m.getProjectState(root);
ok('getProjectState governance_ready', projectState.governance_ready);

const validateChange = await m.validateChange(root, { type: 'file_write', target_path: 'docs/x.md' });
ok('validateChange allow', validateChange.allow);

// --- Change tracker ---
console.log('\n## Change Tracker');
const tracked = await m.validateAndTrackChange(
  root,
  { type: 'file_write', target_path: 'docs/test-guard.md', description: 'test audit' },
  'test-script',
);
ok('validateAndTrackChange recorded', tracked.recorded && !!tracked.change_id);
ok('validateAndTrackChange has guard', !!tracked.guard?.action);

const changes = await m.listRecentChanges(root, 5);
ok('listRecentChanges', changes.length > 0);

// --- Adapter hook ---
console.log('\n## Adapter Hook');
const hook = await m.adapterPreWriteHook(root, { type: 'file_write', target_path: 'docs/README.md' }, { source: 'test' });
ok('adapterPreWriteHook allow', hook.allowed);
const session = await m.readGuardSession(root);
ok('recordGuardSession via hook', !!session?.lastCheckAt);
const reminder = await m.getGuardReminder(root);
ok('getGuardReminder after check', reminder === undefined);

// --- Adapter Hook ---
console.log('\n## Control Surface (control-core)');
const surface = m.createControlSurface(root, 'cli');
const gov = await surface.getGovernance();
ok('control getGovernance', gov.loop === 'governance' && gov.governance.found);
const check = await surface.checkAction({ type: 'file_write', target_path: 'docs/README.md' });
ok('control checkAction', check.loop === 'check' && check.guard.allow);
const intentUpdate = await surface.updateIntent('control-core validation task');
ok('control updateIntent', intentUpdate.loop === 'intent' && intentUpdate.update.updated);
const exec = await surface.executeAction({ type: 'file_write', target_path: 'docs/control-test.md', audit: false });
ok('control executeAction', exec.loop === 'execute' && exec.feedback.cognitive_synced);

// --- Summary ---
const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n--- ${passed}/${results.length} passed ---`);
if (failed.length) {
  console.log('Failed:', failed.map((f) => f.name).join(', '));
  process.exit(1);
}
