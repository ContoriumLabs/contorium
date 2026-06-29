import * as vscode from 'vscode';
import { CONTORA_CONFIG_SECTION, PRODUCT_DISPLAY_NAME } from '../constants';
import type { StateManager } from '../state/stateManager';
import { ContoraKeyManager } from './auth/keyManager';
import { readAiRuntimeSettings } from './auth/providerConfig';
import { syncCilLlmConfigFromIde, testIdeLlmConnection } from './cilLlmBridge';

const LLM_SETTINGS_QUERY = CONTORA_CONFIG_SECTION;

let handlingLlmApiKey = false;
let suppressLlmKeyClear = false;
let handlingLlmTest = false;

async function clearLlmApiKeySetting(): Promise<void> {
  suppressLlmKeyClear = true;
  try {
    const cfg = vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION);
    await cfg.update('llmApiKey', undefined, vscode.ConfigurationTarget.Workspace);
  } finally {
    suppressLlmKeyClear = false;
  }
}

export async function openLlmSettings(): Promise<void> {
  void vscode.commands.executeCommand('workbench.action.openSettings', LLM_SETTINGS_QUERY);
}

export async function runLlmConnectionTest(stateManager: StateManager): Promise<void> {
  const folder = stateManager.getPrimaryFolder();
  if (!folder) {
    void vscode.window.showWarningMessage(`${PRODUCT_DISPLAY_NAME}: Open a folder workspace first.`);
    return;
  }
  const result = await testIdeLlmConnection(folder.uri.fsPath);
  if (result.ok) {
    void vscode.window.showInformationMessage(
      `${PRODUCT_DISPLAY_NAME}: LLM test OK — ${result.provider ?? 'provider'} / ${result.model ?? 'model'} (${result.latency_ms}ms)`,
    );
  } else {
    void vscode.window.showErrorMessage(`${PRODUCT_DISPLAY_NAME}: LLM test failed — ${result.message}`);
  }
}

export async function persistLlmApiKeyFromSettings(
  keys: ContoraKeyManager,
  stateManager: StateManager,
): Promise<void> {
  if (handlingLlmApiKey || suppressLlmKeyClear) {
    return;
  }
  const cfg = vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION);
  const raw = cfg.get<string>('llmApiKey');
  if (raw === undefined || raw === null) {
    return;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return;
  }

  handlingLlmApiKey = true;
  try {
    const ai = readAiRuntimeSettings();
    if (ai.aiProvider === 'off') {
      await clearLlmApiKeySetting();
      void vscode.window.showWarningMessage(
        `${PRODUCT_DISPLAY_NAME}: Set "contora.aiProvider" before saving an API key.`,
      );
      return;
    }

    await keys.setKey(ai.aiProvider, trimmed);
    await clearLlmApiKeySetting();

    const folder = stateManager.getPrimaryFolder();
    if (folder) {
      await syncCilLlmConfigFromIde(folder.uri.fsPath);
    }

    void vscode.window.showInformationMessage(
      `${PRODUCT_DISPLAY_NAME}: Saved API key for ${ai.aiProvider} (SecretStorage).`,
    );

    if (cfg.get<boolean>('autoTestLlmOnKeySave') !== false) {
      await runLlmConnectionTest(stateManager);
    }
  } finally {
    handlingLlmApiKey = false;
  }
}

async function handleLlmTestSettingTrigger(stateManager: StateManager): Promise<void> {
  if (handlingLlmTest) {
    return;
  }
  const cfg = vscode.workspace.getConfiguration(CONTORA_CONFIG_SECTION);
  if (cfg.get<boolean>('llmTestConnection') !== true) {
    return;
  }

  handlingLlmTest = true;
  try {
    await runLlmConnectionTest(stateManager);
  } finally {
    suppressLlmKeyClear = true;
    try {
      await cfg.update('llmTestConnection', false, vscode.ConfigurationTarget.Workspace);
    } finally {
      suppressLlmKeyClear = false;
      handlingLlmTest = false;
    }
  }
}

export function registerLlmSettingsHandlers(
  context: vscode.ExtensionContext,
  keys: ContoraKeyManager,
  stateManager: StateManager,
): void {
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration(`${CONTORA_CONFIG_SECTION}.llmApiKey`)) {
        await persistLlmApiKeyFromSettings(keys, stateManager);
      }
      if (e.affectsConfiguration(`${CONTORA_CONFIG_SECTION}.llmTestConnection`)) {
        await handleLlmTestSettingTrigger(stateManager);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('contora.openLlmSettings', () => openLlmSettings()),
    vscode.commands.registerCommand('contora.configureLlm', () => openLlmSettings()),
    vscode.commands.registerCommand('contora.testLlmConnection', () => runLlmConnectionTest(stateManager)),
  );
}
