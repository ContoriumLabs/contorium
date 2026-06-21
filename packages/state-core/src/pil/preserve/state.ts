import { writeStateJson } from '../../bootstrap/bootstrapState.js';
import type { AdapterKind, BootstrapStateJson } from '../../types.js';

/** Persist workspace state.json with adapter metadata (Preserve layer). */
export async function preserveStateJson(
  workspaceRoot: string,
  state: BootstrapStateJson,
  writer: AdapterKind,
): Promise<void> {
  await writeStateJson(workspaceRoot, state, { mode: 'event-driven', writer });
}
