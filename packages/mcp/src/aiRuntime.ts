import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getAiStatus, readLlmConfig, testAiConnection } from '@contora/state-core';

function textResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

const workspaceRootSchema = z.object({
  workspaceRoot: z.string().optional().describe('Override workspace root'),
});

/**
 * CIL AI Layer — read-only status tools (explanation layer; facts stay rule-based).
 */
export function registerAiRuntimeTools(
  server: McpServer,
  resolveRoot: () => Promise<string>,
): void {
  server.registerTool(
    'get_ai_status',
    {
      description:
        '[CIL · AI Layer] LLM explanation-layer status — enabled flag, provider, model, module switches, intent router mode. Does not expose API keys.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      const [status, config] = await Promise.all([getAiStatus(root), readLlmConfig(root)]);
      return textResult({
        ...status,
        config_path: '.contora/config/llm.json',
        api_key_env: config.api_key_env ?? null,
        cache_enabled: config.cache?.enabled ?? true,
        note: 'Facts engines never use LLM; only explanation modules when enabled.',
      });
    },
  );

  server.registerTool(
    'test_ai_connection',
    {
      description:
        '[CIL · AI Layer] Test LLM provider connectivity using workspace llm.json + api_key_env. Returns ok/latency/message.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ?? (await resolveRoot());
      return textResult(await testAiConnection(root));
    },
  );
}
