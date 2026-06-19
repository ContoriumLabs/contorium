import { loadGovernanceDashboardSnapshot, } from '@contora/state-core';
/** Dashboard reads governance state only via state-core bundle. */
export async function loadGovernanceSnapshot(workspaceRoot) {
    return loadGovernanceDashboardSnapshot(workspaceRoot);
}
