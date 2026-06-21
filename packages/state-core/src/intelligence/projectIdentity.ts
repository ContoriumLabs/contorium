import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AdapterKind } from '../types.js';
import { readHandoffArtifact } from '../understanding/store.js';
import { readStateJson } from '../bootstrap/bootstrapState.js';
import { readGovernanceDecision } from '../governance/governanceArtifacts.js';
import { readDecisionProvenanceGraph } from './decisionProvenance.js';
import { readIntentNodesVNext } from './intentVNext.js';
import { identityPath, IDENTITY_DIR, contoraRoot } from './paths.js';
import type { ProjectIdentity } from './types.js';
import { PROJECT_INTELLIGENCE_SCHEMA } from './types.js';
import { getContoriumPackageVersion } from '../version.js';

function hashPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}

export async function readProjectIdentity(workspaceRoot: string): Promise<ProjectIdentity | null> {
  try {
    const text = await fs.readFile(identityPath(workspaceRoot), 'utf8');
    const raw = JSON.parse(text) as ProjectIdentity;
    if (raw?.schema === PROJECT_INTELLIGENCE_SCHEMA) {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export async function syncProjectIdentity(
  workspaceRoot: string,
  writer: AdapterKind,
  syncMode: ProjectIdentity['sync_mode'] = 'merged',
): Promise<ProjectIdentity> {
  const root = path.resolve(workspaceRoot);
  const [state, handoff, decision, intentNodes, decisionGraph] = await Promise.all([
    readStateJson(root),
    readHandoffArtifact(root),
    readGovernanceDecision(root),
    readIntentNodesVNext(root),
    readDecisionProvenanceGraph(root),
  ]);

  const projectId =
    path.basename(root).replace(/[^\w.-]+/g, '_') || 'project';
  const hashSource = {
    task: state?.currentTask ?? '',
    focus: handoff?.current_focus ?? '',
    goal: handoff?.goal ?? '',
    gitStaged: state?.gitStaged?.length ?? 0,
    gitWorking: state?.gitWorking?.length ?? 0,
    decision: decision?.decision ?? null,
  };

  const activeIntents = intentNodes
    .filter((n) => n.intent_id)
    .slice(0, 12)
    .map((n) => n.intent_id);

  const activeDecisions = (decisionGraph?.nodes ?? [])
    .slice(-8)
    .map((n) => n.decision_id);

  if (decision && !activeDecisions.length) {
    activeDecisions.push(`gov_${decision.created_at}`);
  }

  const prev = await readProjectIdentity(root);
  const toolSources = [...(prev?.tool_sources ?? [])];
  const idx = toolSources.findIndex((t) => t.tool === writer);
  const seen = { tool: writer, last_seen: new Date().toISOString() };
  if (idx >= 0) {
    toolSources[idx] = seen;
  } else {
    toolSources.push(seen);
  }

  const identity: ProjectIdentity = {
    schema: PROJECT_INTELLIGENCE_SCHEMA,
    project_id: projectId,
    current_state_hash: hashPayload(hashSource),
    active_intents: activeIntents,
    active_decisions: activeDecisions,
    last_tool_source: writer,
    runtime_version: getContoriumPackageVersion(),
    sync_mode: syncMode,
    updated_at: new Date().toISOString(),
    tool_sources: toolSources.slice(-8),
  };

  await fs.mkdir(path.join(contoraRoot(root), IDENTITY_DIR), { recursive: true });
  await fs.writeFile(identityPath(root), `${JSON.stringify(identity, null, 2)}\n`, 'utf8');
  return identity;
}
