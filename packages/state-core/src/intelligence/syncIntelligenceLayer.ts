import type { AdapterKind, StateEngineMode } from '../types.js';
import { deriveIntentGraphVNext } from './intentVNext.js';
import { readProjectIdentity, syncProjectIdentity } from './projectIdentity.js';
import { syncWhyLayer } from './whyLayer.js';
import { syncProjectIntelligenceRepository } from './projectIntelligenceSync.js';

export async function syncIntelligenceLayer(
  workspaceRoot: string,
  writer: AdapterKind,
  mode: StateEngineMode = 'merged',
): Promise<void> {
  const syncMode: 'strong' | 'merged' | 'scan-driven' =
    mode === 'scan-driven' ? 'scan-driven' : mode === 'merged' ? 'merged' : 'strong';

  const prevIdentity = await readProjectIdentity(workspaceRoot).catch(() => null);

  await deriveIntentGraphVNext(workspaceRoot).catch(() => undefined);
  await syncWhyLayer(workspaceRoot).catch(() => undefined);
  await syncProjectIdentity(workspaceRoot, writer, syncMode).catch(() => undefined);
  await syncProjectIntelligenceRepository(workspaceRoot, writer, mode, prevIdentity).catch(
    () => undefined,
  );
}
