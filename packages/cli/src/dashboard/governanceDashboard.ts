import {
  loadGovernanceDashboardSnapshot,
  type GovernanceDashboardSnapshot,
  type GovernanceScopeMap,
} from '@contora/state-core';

export type {
  GovernanceDashboardSnapshot as DashboardGovernanceSnapshot,
  GovernanceScopeMap as DashboardScopeMap,
} from '@contora/state-core';

/** Dashboard reads governance state only via state-core bundle. */
export async function loadGovernanceSnapshot(
  workspaceRoot: string,
): Promise<GovernanceDashboardSnapshot> {
  return loadGovernanceDashboardSnapshot(workspaceRoot);
}
