import {
  DEFAULT_LLM_CONFIG,
  getAiStatus,
  readLlmConfig,
  testAiConnection,
  writeLlmConfig,
  type AiProviderId,
  type IntentRouterMode,
} from '@contora/state-core';

export const AI_USAGE = `Contorium AI Layer — explanation layer only (facts stay rule-based)

  contorium ai setup [path] [--provider openai|anthropic|open_router|gemini|deepseek|ollama] [--model MODEL] [--enable]
  contorium ai status [path] [--json]
  contorium ai test [path] [--json]

Config file: .contora/config/llm.json
API keys: set via api_key_env (default OPENAI_API_KEY) — never stored in repo.

Default: LLM disabled — PIL/CIL runs 100% without AI.
`;

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function flagValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) {
    return process.argv[i + 1];
  }
  return undefined;
}

const PROVIDER_ENV: Record<AiProviderId, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
  open_router: 'OPENROUTER_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  ollama: '',
};

export async function cmdAi(root: string, sub: string): Promise<void> {
  switch (sub) {
    case 'setup': {
      const provider = (flagValue('--provider') ?? DEFAULT_LLM_CONFIG.provider) as AiProviderId;
      const model = flagValue('--model') ?? DEFAULT_LLM_CONFIG.model;
      const enable = hasFlag('--enable');
      const routerMode = (flagValue('--router') ?? 'hybrid') as IntentRouterMode;
      const apiKeyEnv = PROVIDER_ENV[provider] || 'OPENAI_API_KEY';
      const config = await writeLlmConfig(root, {
        enabled: enable,
        provider,
        model,
        api_key_env: apiKeyEnv,
        intent_router: { enabled: enable, mode: routerMode },
        enabled_modules: DEFAULT_LLM_CONFIG.enabled_modules,
      });
      console.log('AI config written:', `${root}/.contora/config/llm.json`);
      console.log(`  enabled: ${config.enabled}`);
      console.log(`  provider: ${config.provider}`);
      console.log(`  model: ${config.model}`);
      console.log(`  api_key_env: ${config.api_key_env}`);
      console.log(`  intent_router: ${config.intent_router?.mode ?? 'rule'}`);
      if (enable && apiKeyEnv) {
        console.log(`\nSet ${apiKeyEnv} in your environment, then run: contorium ai test`);
      } else if (!enable) {
        console.log('\nLLM remains disabled. Re-run with --enable after setting API key env.');
      }
      return;
    }
    case 'status': {
      const status = await getAiStatus(root);
      const config = await readLlmConfig(root);
      if (hasFlag('--json')) {
        console.log(JSON.stringify({ ...status, config_path: '.contora/config/llm.json' }, null, 2));
        return;
      }
      console.log('Contorium AI status');
      console.log(`  enabled: ${status.enabled}`);
      console.log(`  provider: ${status.provider}`);
      console.log(`  model: ${status.model}`);
      console.log(`  intent_router: ${status.intent_router}`);
      console.log('  modules:');
      for (const [mod, on] of Object.entries(status.modules)) {
        console.log(`    ${mod}: ${on ? 'on' : 'off'}`);
      }
      console.log(`  config: ${root}/.contora/config/llm.json`);
      console.log(`  api_key_env: ${config.api_key_env ?? '(not set)'}`);
      return;
    }
    case 'test': {
      const result = await testAiConnection(root);
      if (hasFlag('--json')) {
        console.log(JSON.stringify(result, null, 2));
        if (!result.ok) {
          process.exit(1);
        }
        return;
      }
      if (result.ok) {
        console.log(`OK — ${result.provider ?? 'provider'} / ${result.model ?? 'model'} (${result.latency_ms}ms)`);
        if (result.message) {
          console.log(result.message);
        }
        return;
      }
      console.error(`FAIL — ${result.message}`);
      process.exit(1);
    }
    default:
      console.log(AI_USAGE);
  }
}
