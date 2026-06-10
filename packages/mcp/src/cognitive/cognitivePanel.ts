import type { ContoriumMcpMode } from './types.js';
import { applyCognitiveModeChange } from './modeApply.js';
import { readCognitiveModeSummary } from './modeApply.js';
import { readCognitiveHotkeyConfig } from './hotkeyConfig.js';

export function renderModePanelFrame(args: {
  selection: ContoriumMcpMode;
  current: ContoriumMcpMode;
  hotkeyHint?: string;
}): string {
  const sel = args.selection;
  const lines = [
    '=== Contorium Cognitive Mode ===',
    '',
    `${sel === 'A' ? '>' : ' '} A — Core Runtime (default · observation, project, task)`,
    `${sel === 'B' ? '>' : ' '} B — Cognitive Overlay (A + skills + model presets)`,
    '',
    `Current: Mode ${args.current}`,
    '',
    'Up/Down select · Enter confirm · Esc cancel',
  ];
  if (args.hotkeyHint) {
    lines.push(args.hotkeyHint);
  }
  return lines.join('\n');
}

export async function runCognitiveModePanel(
  workspaceRoot: string,
  opts?: { interactive?: boolean },
): Promise<{ applied: boolean; mode?: ContoriumMcpMode }> {
  const summary = await readCognitiveModeSummary(workspaceRoot);
  const hotkey = await readCognitiveHotkeyConfig(workspaceRoot);
  let selection: ContoriumMcpMode = summary.mode;

  if (opts?.interactive === false || !process.stdin.isTTY) {
    return { applied: false };
  }

  const hint = `Shortcut: ${hotkey.panel_accelerator} or key "${hotkey.panel_key}" in dashboard`;
  const input = process.stdin;
  const output = process.stdout;

  const render = (): void => {
    output.write(`\x1b[2J\x1b[H${renderModePanelFrame({ selection, current: summary.mode, hotkeyHint: hint })}\n`);
  };

  render();

  return new Promise((resolve) => {
    const wasRaw = input.isRaw;
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');

    const cleanup = (): void => {
      input.off('data', onData);
      if (!wasRaw) {
        input.setRawMode(false);
      }
      input.pause();
    };

    const onData = (chunk: string): void => {
      if (chunk === '\u001b[A' || chunk === 'k') {
        selection = 'A';
        render();
        return;
      }
      if (chunk === '\u001b[B' || chunk === 'j') {
        selection = 'B';
        render();
        return;
      }
      if (chunk === '\r' || chunk === '\n') {
        cleanup();
        void applyCognitiveModeChange(workspaceRoot, selection, 'panel').then(() => {
          output.write(`\nApplied Mode ${selection}.\n`);
          resolve({ applied: true, mode: selection });
        });
        return;
      }
      if (chunk === '\u001b' || chunk === 'q' || chunk === '\u0003') {
        cleanup();
        output.write('\nCancelled.\n');
        resolve({ applied: false });
      }
    };

    input.on('data', onData);
  });
}
