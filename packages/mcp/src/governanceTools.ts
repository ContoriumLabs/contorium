import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createControlSurface, listRecentChanges } from '@contora/state-core';

function textResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

const workspaceRootSchema = z.object({
  workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
});

/** Auxiliary inspection tools — Decision Provenance Layer (not execution). */
export function registerGovernanceAuxTools(
  server: McpServer,
  resolveRoot: () => Promise<string>,
): void {
  server.registerTool(
    'update_project_intent',
    {
      description:
        '[Legacy alias · prefer record_project_intent] Record user direction overlay for cognition. Requires user_input. Does not execute work.',
      inputSchema: z.object({
        workspaceRoot: z.string().optional(),
        user_input: z.string().min(1).describe('User direction / intent text to record'),
      }),
    },
    async ({ workspaceRoot: override, user_input }) => {
      const root = override ? override : await resolveRoot();
      const control = createControlSurface(root, 'mcp');
      return textResult(await control.updateIntent(user_input));
    },
  );

  server.registerTool(
    'record_project_intent',
    {
      description:
        '[Write · Intent] Record project direction for intent/why layers (human → system). Requires user_input. Prefer capture_focus for simple current-task updates.',
      inputSchema: z.object({
        workspaceRoot: z.string().optional(),
        user_input: z.string().min(1).describe('Project direction / intent to persist'),
      }),
    },
    async ({ workspaceRoot: override, user_input }) => {
      const root = override ? override : await resolveRoot();
      const control = createControlSurface(root, 'mcp');
      return textResult(await control.updateIntent(user_input));
    },
  );

  server.registerTool(
    'analyze_project',
    {
      description:
        '[Inspect · Composite] One-shot cognition snapshot (governance + handoff + state). Prefer ask_project or inspect_* for targeted reads; use this for a broad diagnostic dump.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ? override : await resolveRoot();
      const control = createControlSurface(root, 'mcp');
      return textResult(await control.analyze());
    },
  );

  server.registerTool(
    'get_cognitive_state',
    {
      description:
        '[Inspect] Derived cognitive projection (.contora/cognitive/). Prefer inspect_state / inspect_intent for PIL facts.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ? override : await resolveRoot();
      const control = createControlSurface(root, 'mcp');
      const state = await control.getState();
      return textResult({
        workspaceRoot: root,
        found: !!(state.cognitive || state.intent),
        cognitive_state: state.cognitive,
        cognitive_intent: state.intent,
        via: 'control-core',
        paths: {
          governance: '.contora/governance/',
          cognitive: '.contora/cognitive/',
          runtime_logs: '.contora/runtime/execution_logs/',
        },
      });
    },
  );

  server.registerTool(
    'get_change_log',
    {
      description:
        '[Inspect] Recent guard / change-log records. Optional limit (1–50, default 20). Prefer get_recent_events for cognitive timeline.',
      inputSchema: z.object({
        workspaceRoot: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional().describe('Max records (default 20)'),
      }),
    },
    async ({ workspaceRoot: override, limit }) => {
      const root = override ? override : await resolveRoot();
      const records = await listRecentChanges(root, limit ?? 20);
      return textResult({ workspaceRoot: root, count: records.length, records, via: 'control-core' });
    },
  );
}

/** @deprecated Use registerGovernanceAuxTools + registerGovernanceV4Tools */
export function registerGovernanceTools(
  server: McpServer,
  resolveRoot: () => Promise<string>,
): void {
  registerGovernanceAuxTools(server, resolveRoot);
}
