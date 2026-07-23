import * as path from 'node:path';

const GOVERNANCE_DIR = '.contora/governance';

export function assumptionGraphPath(workspaceRoot: string): string {
  return path.join(path.resolve(workspaceRoot), GOVERNANCE_DIR, 'assumption_graph.json');
}

export function decisionDependencyGraphPath(workspaceRoot: string): string {
  return path.join(path.resolve(workspaceRoot), GOVERNANCE_DIR, 'decision_dependency_graph.json');
}
