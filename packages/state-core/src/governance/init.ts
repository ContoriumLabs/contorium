import { defaultConstitution, defaultIdentity, defaultTruthLayer } from './defaults.js';
import {
  governanceExists,
  readIdentity,
  writeConstitution,
  writeIdentity,
  writeTruthLayer,
} from './store.js';

export interface EnsureGovernanceResult {
  initialized: boolean;
  created: boolean;
}

/**
 * Seed `.contora/governance/` on first workspace bootstrap.
 * Never overwrites existing user-edited files.
 */
export async function ensureGovernanceLayer(workspaceRoot: string): Promise<EnsureGovernanceResult> {
  const exists = await governanceExists(workspaceRoot);
  if (exists) {
    return { initialized: true, created: false };
  }

  await writeConstitution(workspaceRoot, defaultConstitution());
  await writeTruthLayer(workspaceRoot, defaultTruthLayer());
  await writeIdentity(workspaceRoot, await defaultIdentity(workspaceRoot));

  return { initialized: true, created: true };
}

/** Refresh identity.current_focus from handoff without overwriting user fields. */
export async function syncIdentityFocus(
  workspaceRoot: string,
  focus: string[],
): Promise<void> {
  const identity = await readIdentity(workspaceRoot);
  if (!identity || focus.length === 0) {
    return;
  }
  const merged = [...new Set([...identity.current_focus, ...focus])].slice(0, 8);
  if (JSON.stringify(merged) === JSON.stringify(identity.current_focus)) {
    return;
  }
  await writeIdentity(workspaceRoot, { ...identity, current_focus: merged });
}
