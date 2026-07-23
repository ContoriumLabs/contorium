#!/usr/bin/env node
/**
 * Smoke-test every Contorium MCP tool: listTools + callTool with minimal valid args.
 *
 * Usage:
 *   node scripts/verify-mcp-tools.mjs
 *   node scripts/verify-mcp-tools.mjs --workspace e:/sessionrecall
 *   node scripts/verify-mcp-tools.mjs --prefer-only
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const mcpPkg = path.join(root, 'packages/mcp');
const mcpBin = path.join(mcpPkg, 'bin/contorium-mcp.js');
const require = createRequire(path.join(mcpPkg, 'package.json'));

const { Client } = await import(
  pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')).href
);
const { StdioClientTransport } = await import(
  pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/stdio.js')).href
);

const PREFERRED = new Set([
  'ask_project',
  'transfer_project',
  'capture_focus',
  'capture_note',
  'capture_decision',
  'inspect_state',
  'inspect_intent',
  'inspect_decision',
  'inspect_why',
  'inspect_health',
  'get_knowledge_health',
  'get_review_queue',
  'set_decision_lifecycle_meta',
  'get_next_actions',
  'get_decisions',
  'get_recent_events',
  'get_project_history',
  'get_handoff_injection_status',
  'confirm_handoff_injection',
  'skip_handoff_injection',
]);

const ARG_OVERRIDES = {
  ask_project: { question: 'What is the current project focus?' },
  get_module_history: { module: 'packages/mcp/src/server.ts' },
  get_blast_radius: { module: 'packages/mcp/src/server.ts' },
  get_entity_knowledge: { entity: 'mcp' },
  capture_focus: { focus: '[verify-mcp-tools] focus smoke' },
  capture_note: { text: '[verify-mcp-tools] note smoke' },
  capture_decision: {
    selected: '[verify-mcp-tools] decision smoke',
    reason: 'automated mcp tool smoke test',
  },
  store_memory: { key: 'verify-mcp-tools', value: 'ok', type: 'note' },
  search_memory: { query: 'verify-mcp-tools' },
  get_memory: { key: 'verify-mcp-tools' },
  set_decision_lifecycle_meta: {
    decision_id: 'verify-mcp-tools-smoke',
    owner: 'verify-mcp-tools',
  },
  record_project_intent: { user_input: '[verify-mcp-tools] intent smoke' },
  update_project_intent: { user_input: '[verify-mcp-tools] intent smoke' },
  set_cognitive_mode: { mode: 'A' },
  get_recent_events: { limit: 3 },
  get_project_history: { range: 'last_7_days', limit: 3 },
  transfer_project: { mode: 'context' },
  get_skill_suggestions: { limit: 3 },
  get_change_log: { limit: 3 },
  get_active_intents: { max: 3 },
  get_project_knowledge_graph: { minConfidence: 0 },
  resolve_scope_context: { mode: 'auto', active_file: 'README.md' },
  derive_decision_provenance: {
    persist: false,
    audit: false,
    mode: 'advisory',
    active_file: 'README.md',
  },
  derive_decision_trace: {
    persist: false,
    audit: false,
    mode: 'advisory',
    active_file: 'README.md',
  },
  decision_snapshot: {
    persist: false,
    audit: false,
    mode: 'advisory',
    active_file: 'README.md',
  },
  build_decision_provenance: {
    persist: false,
    audit: false,
    mode: 'advisory',
    active_file: 'README.md',
  },
  run_governance_cycle: {
    persist: false,
    audit: false,
    mode: 'advisory',
    active_file: 'README.md',
  },
  trace_governance_cycle: {
    persist: false,
    audit: false,
    mode: 'advisory',
    active_file: 'README.md',
  },
  synthesize_context_payload: { refresh_cycle: false },
  generate_inject_payload: { refresh_cycle: false },
  export_decision_provenance: { refresh_cycle: false },
  export_governance_context: { refresh_cycle: false },
  confirm_handoff_injection: { format: 'compact' },
};

/** Tools that routinely exceed 60s on large workspaces. */
const SLOW_TIMEOUT_MS = new Set([
  'derive_decision_provenance',
  'derive_decision_trace',
  'decision_snapshot',
  'build_decision_provenance',
  'run_governance_cycle',
  'trace_governance_cycle',
  'inspect_cognition_ready',
  'inspect_system_ready',
  'inspect_control_ready',
  'ensure_control_ready',
  'get_knowledge_health',
  'get_review_queue',
  'set_decision_lifecycle_meta',
  'ask_project',
  'get_project_history',
  'get_recent_events',
  'get_decisions',
  'transfer_project',
]);

function valueForProp(key, def) {
  if (def.default !== undefined) return def.default;
  if (Array.isArray(def.enum) && def.enum.length) return def.enum[0];
  const t = Array.isArray(def.type) ? def.type[0] : def.type;
  if (t === 'string') {
    return key.includes('path') || key.includes('file') ? 'README.md' : `smoke-${key}`;
  }
  if (t === 'number' || t === 'integer') return def.minimum ?? 1;
  if (t === 'boolean') return false;
  if (t === 'array') return [];
  if (t === 'object') return {};
  return `smoke-${key}`;
}

function sampleFromSchema(schema) {
  if (!schema || typeof schema !== 'object') return {};
  const props = schema.properties || {};
  const required = new Set(schema.required || []);
  const out = {};
  for (const [key, def] of Object.entries(props)) {
    if (key === 'workspaceRoot') continue;
    if (!required.has(key) && def.default === undefined) continue;
    out[key] = valueForProp(key, def);
  }
  return out;
}

function buildArgs(tool, workspace) {
  const base = sampleFromSchema(tool.inputSchema);
  const override = ARG_OVERRIDES[tool.name] || {};
  return { ...base, ...override, workspaceRoot: workspace };
}

function summarizeResult(result) {
  const texts = (result?.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text || '');
  const joined = texts.join('\n');
  let parsed = null;
  try {
    parsed = JSON.parse(joined);
  } catch {
    /* plain / markdown */
  }
  return {
    isError: !!result?.isError,
    preview: joined.slice(0, 160).replace(/\s+/g, ' '),
    keys: parsed && typeof parsed === 'object' ? Object.keys(parsed).slice(0, 8) : null,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const preferOnly = argv.includes('--prefer-only');
  const wsIdx = argv.indexOf('--workspace');
  const workspace =
    (wsIdx >= 0 && argv[wsIdx + 1]) || process.env.CONTORIUM_WORKSPACE || root;

  const cleanEnv = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === 'string') cleanEnv[k] = v;
  }
  cleanEnv.CONTORIUM_WORKSPACE = workspace;
  cleanEnv.CONTORIUM_ALLOW_GIT = '0';

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [mcpBin, '--workspace', workspace],
    cwd: workspace,
    env: cleanEnv,
    // inherit avoids Windows pipe-buffer deadlocks during long bootstrap
    stderr: 'inherit',
  });

  const errChunks = [];

  const client = new Client({ name: 'verify-mcp-tools', version: '1.0.0' }, { capabilities: {} });

  console.log(`[verify-mcp-tools] workspace=${workspace}`);
  console.log(`[verify-mcp-tools] spawning ${mcpBin}`);

  await client.connect(transport, { timeout: 180_000 });

  const instructions = client.getInstructions?.() || '';
  if (instructions) {
    console.log(
      `[verify-mcp-tools] instructions: ${instructions.split('\n')[0]}… (${instructions.length} chars)`,
    );
  }

  const listed = await client.listTools();
  let tools = listed.tools || [];
  console.log(`[verify-mcp-tools] listed ${tools.length} tools`);

  const missingPreferred = [...PREFERRED].filter((n) => !tools.some((t) => t.name === n));
  if (missingPreferred.length) {
    console.error('[verify-mcp-tools] MISSING preferred tools:', missingPreferred.join(', '));
  }

  if (preferOnly) {
    tools = tools.filter((t) => PREFERRED.has(t.name));
    console.log(`[verify-mcp-tools] --prefer-only → ${tools.length} tools`);
  }

  const onlyIdx = argv.indexOf('--only');
  if (onlyIdx >= 0 && argv[onlyIdx + 1]) {
    const only = new Set(argv[onlyIdx + 1].split(',').map((s) => s.trim()).filter(Boolean));
    tools = tools.filter((t) => only.has(t.name));
    console.log(`[verify-mcp-tools] --only → ${tools.length} tools`);
  }

  const qualityIssues = [];
  for (const t of tools) {
    if (!t.description || t.description.trim().length < 20) {
      qualityIssues.push(`${t.name}: description too short`);
    }
  }

  const results = [];
  for (const tool of tools) {
    const callArgs = buildArgs(tool, workspace);
    const started = Date.now();
    const timeout = SLOW_TIMEOUT_MS.has(tool.name) ? 180_000 : 90_000;
    try {
      const result = await client.callTool(
        { name: tool.name, arguments: callArgs },
        undefined,
        { timeout },
      );
      const summary = summarizeResult(result);
      const ok = !summary.isError;
      results.push({ name: tool.name, ok, ms: Date.now() - started, ...summary });
      console.log(
        `  [${ok ? 'OK' : 'ERR'}] ${tool.name} (${Date.now() - started}ms)` +
          (summary.keys ? ` keys=${summary.keys.join(',')}` : '') +
          (summary.isError ? ` :: ${summary.preview}` : ''),
      );
    } catch (err) {
      results.push({
        name: tool.name,
        ok: false,
        ms: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      });
      console.log(`  [FAIL] ${tool.name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  await client.close().catch(() => undefined);

  const passed = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  console.log('\n── summary ──');
  console.log(`tools listed: ${listed.tools?.length ?? 0}`);
  console.log(`called:       ${results.length}`);
  console.log(`passed:       ${passed.length}`);
  console.log(`failed:       ${failed.length}`);
  if (missingPreferred.length) console.log(`missing preferred: ${missingPreferred.length}`);
  if (qualityIssues.length) {
    console.log(`description quality warnings: ${qualityIssues.length}`);
    for (const q of qualityIssues.slice(0, 12)) console.log(`  · ${q}`);
  }
  if (failed.length) {
    console.log('\nfailures:');
    for (const f of failed) {
      console.log(`  · ${f.name}: ${f.error || f.preview || 'isError'}`);
    }
  }

  const stderrTail = errChunks.join('').trim().split(/\n/).slice(-12).join('\n');
  if (stderrTail && (failed.length || process.env.VERIFY_MCP_VERBOSE)) {
    console.log('\nserver stderr (tail):\n' + stderrTail);
  }

  process.exit(failed.length > 0 || missingPreferred.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[verify-mcp-tools] fatal:', err);
  process.exit(1);
});
