import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  buildCognitiveInsights,
  observationOnlyPayload,
  readCognitiveInsights,
} from './cognitiveOverlay.js';
import { applyCognitiveModeChange, readCognitiveModeSummary } from './modeApply.js';
import { isCognitiveOverlayEnabled, readCognitiveMode } from './modeStore.js';
import type { ContoriumMcpMode } from './types.js';

const workspaceRootSchema = z.object({
  workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
});

const MODE_HELP = `Contorium MCP mode (v2):
  A = Core Runtime DEFAULT (pure observation — project, task, feed)
  B = Cognitive Overlay (A + skill suggestions + model presets + external search)`;

function textResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function registerCognitiveTools(
  server: McpServer,
  resolveRoot: () => Promise<string>,
): void {
  server.registerTool(
    'get_cognitive_mode',
    {
      description: `[Cognitive Overlay] Read MCP mode A/B. ${MODE_HELP}`,
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ? override : await resolveRoot();
      const summary = await readCognitiveModeSummary(root);
      return textResult({
        workspaceRoot: root,
        ...summary,
        hint:
          summary.mode === 'A'
            ? 'Mode A — core runtime. Dashboard: ↓ select B (A+overlay) · Enter apply.'
            : 'Mode B — core (A) + cognitive overlay active (read-only suggestions).',
        panel: {
          primary: 'Contorium Dashboard — ↑↓ select · Enter apply (passive + expanded)',
          fallback_command: 'contorium-mcp mode-panel',
        },
      });
    },
  );

  server.registerTool(
    'set_cognitive_mode',
    {
      description: `[Cognitive Overlay] Switch MCP mode A/B. Does NOT change runtime core behavior — overlay only. ${MODE_HELP}`,
      inputSchema: z.object({
        workspaceRoot: z.string().optional(),
        mode: z.enum(['A', 'B']).describe('A = core runtime (default) · B = enable cognitive overlay (includes A)'),
      }),
    },
    async ({ workspaceRoot: override, mode }) => {
      const root = override ? override : await resolveRoot();
      const result = await applyCognitiveModeChange(root, mode as ContoriumMcpMode, 'agent');
      return textResult({
        ...result,
        insights: mode === 'B' ? result.insights : undefined,
      });
    },
  );

  server.registerTool(
    'get_cognitive_insights',
    {
      description: `[Cognitive Overlay · Mode B only] Full insight bundle: intent, skills, tools, model preset. Read-only — never installs or executes.`,
      inputSchema: z.object({
        workspaceRoot: z.string().optional(),
        refresh: z.boolean().optional().describe('Force rebuild (may query GitHub/NPM)'),
      }),
    },
    async ({ workspaceRoot: override, refresh }) => {
      const root = override ? override : await resolveRoot();
      const modeState = await readCognitiveMode(root);
      if (!isCognitiveOverlayEnabled(modeState.mode)) {
        return textResult({
          workspaceRoot: root,
          found: false,
          hint: 'Mode A active — call set_cognitive_mode { mode: "B" } to enable cognitive overlay.',
          ...observationOnlyPayload('A'),
        });
      }
      const insights =
        refresh === true
          ? await buildCognitiveInsights(root)
          : (await readCognitiveInsights(root)) ?? (await buildCognitiveInsights(root));
      return textResult({ workspaceRoot: root, found: true, insights });
    },
  );

  server.registerTool(
    'get_skill_suggestions',
    {
      description: `[Cognitive Overlay · Mode B only] Skill discovery from local registry + GitHub/NPM search. Display-only links — no auto install.`,
      inputSchema: z.object({
        workspaceRoot: z.string().optional(),
        refresh: z.boolean().optional(),
        limit: z.number().int().min(1).max(20).optional(),
      }),
    },
    async ({ workspaceRoot: override, refresh, limit }) => {
      const root = override ? override : await resolveRoot();
      const modeState = await readCognitiveMode(root);
      if (!isCognitiveOverlayEnabled(modeState.mode)) {
        return textResult({
          workspaceRoot: root,
          found: false,
          mode: modeState.mode,
          suggested_skills: [],
          suggested_tools: [],
          hint: 'Mode A — no skill suggestions. Enable mode B first.',
        });
      }
      const insights =
        refresh === true
          ? await buildCognitiveInsights(root)
          : (await readCognitiveInsights(root)) ?? (await buildCognitiveInsights(root));
      const cap = limit ?? 10;
      return textResult({
        workspaceRoot: root,
        found: true,
        detected_intent: insights.detected_intent,
        suggested_skills: insights.suggested_skills.slice(0, cap),
        suggested_tools: insights.suggested_tools.slice(0, cap),
        keywords: insights.keywords,
        boundaries: insights.boundaries,
      });
    },
  );

  server.registerTool(
    'get_model_preset',
    {
      description: `[Cognitive Overlay · Mode B only] Task mode preset (SMART/FAST/REASON/CODE/LOCAL) — strategy hint only, NOT a model recommendation system.`,
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ? override : await resolveRoot();
      const modeState = await readCognitiveMode(root);
      if (!isCognitiveOverlayEnabled(modeState.mode)) {
        return textResult({
          workspaceRoot: root,
          found: false,
          mode: modeState.mode,
          hint: 'Mode A — no model preset. Enable mode B via set_cognitive_mode.',
        });
      }
      const insights = (await readCognitiveInsights(root)) ?? (await buildCognitiveInsights(root));
      const preset = insights.suggested_models[0];
      return textResult({
        workspaceRoot: root,
        found: !!preset,
        preset,
        detected_intent: insights.detected_intent,
        boundaries: insights.boundaries,
      });
    },
  );
}
