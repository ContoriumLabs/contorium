import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  contoraRoot,
  decisionGraphPath,
  legacyDecisionGraphPath,
  legacyStatePath,
  stateCanonicalPath,
  confidenceIndexPath,
  legacyStabilityIndexPath,
  legacyKnowledgeGraphPath,
  knowledgeGraphCanonicalPath,
} from '../paths.js';
import { readJsonFile } from '../dimensions/io.js';

async function copyIfMissing(source: string, target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return false;
  } catch {
    /* migrate */
  }
  try {
    const raw = await fs.readFile(source, 'utf8');
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, raw, 'utf8');
    return true;
  } catch {
    return false;
  }
}

/** v1.1.3 — migrate flat .contora layout to repository structure (non-destructive). */
export async function migrateProjectIntelligenceLayout(workspaceRoot: string): Promise<{
  migrated: string[];
}> {
  const migrated: string[] = [];

  if (await copyIfMissing(legacyStatePath(workspaceRoot), stateCanonicalPath(workspaceRoot))) {
    migrated.push('state/state.json');
  }

  if (await copyIfMissing(legacyDecisionGraphPath(workspaceRoot), decisionGraphPath(workspaceRoot))) {
    migrated.push('decision/decision_graph.json');
  }

  const legacyConf = await readJsonFile<Record<string, unknown>>(legacyStabilityIndexPath(workspaceRoot));
  if (legacyConf && !(await readJsonFile(confidenceIndexPath(workspaceRoot)))) {
    await fs.mkdir(path.join(contoraRoot(workspaceRoot), 'confidence'), { recursive: true });
    await fs.writeFile(confidenceIndexPath(workspaceRoot), `${JSON.stringify(legacyConf, null, 2)}\n`, 'utf8');
    migrated.push('confidence/confidence_index.json');
  }

  if (await copyIfMissing(legacyKnowledgeGraphPath(workspaceRoot), knowledgeGraphCanonicalPath(workspaceRoot))) {
    migrated.push('graph/knowledge_graph.json');
  }

  return { migrated };
}
