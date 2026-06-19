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

/** Auxiliary control tools — not part of V4 governance cycle (see governanceV4.ts). */
export function registerGovernanceAuxTools(
  server: McpServer,
  resolveRoot: () => Promise<string>,
): void {
  server.registerTool(
    'update_project_intent',
    {
      description:
        '[Control Surface] Record user request overlay → rebuild derived cognitive projection.',
      inputSchema: z.object({
        workspaceRoot: z.string().optional(),
        user_input: z.string().min(1),
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
      description: '[Control Surface] Governance + cognitive + handoff snapshot.',
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
      description: '[Control Surface] Read derived cognitive projection.',
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
      description: '[Control Surface] Recent guard checks from change-log.json.',
      inputSchema: z.object({
        workspaceRoot: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
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
