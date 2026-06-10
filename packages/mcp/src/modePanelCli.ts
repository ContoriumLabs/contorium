import { findWorkspaceRoot, initWorkspaceFromArgv, resolveWorkspaceRoot } from './paths.js';
import { runCognitiveModePanel } from './cognitive/cognitivePanel.js';

export async function runMcpModePanelCli(argv: string[]): Promise<void> {
  initWorkspaceFromArgv(argv);
  const hint = resolveWorkspaceRoot();
  const root = await findWorkspaceRoot(hint);
  await runCognitiveModePanel(root, { interactive: true });
}
