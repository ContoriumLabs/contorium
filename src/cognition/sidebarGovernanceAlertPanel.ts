import type * as vscode from 'vscode';
import {
  buildGovernanceAlertPanel,
  persistKnowledgeLifecycle,
  readDismissedGovernanceAlerts,
  readKnowledgeLifecycle,
  type GovernanceAlertPanel,
  type GovernanceImpactAlert,
} from '@contora/state-core';

export type { GovernanceImpactAlert, GovernanceAlertPanel };

/** Sidebar-native governance impact banner (优化.md §11 — top of plugin view). */
export interface SidebarGovernanceAlertPanel {
  alerts: GovernanceImpactAlert[];
  topAlert: GovernanceImpactAlert | null;
  totalCount: number;
  dismissedCount: number;
  empty: boolean;
}

const EMPTY: SidebarGovernanceAlertPanel = {
  alerts: [],
  topAlert: null,
  totalCount: 0,
  dismissedCount: 0,
  empty: true,
};

export async function buildSidebarGovernanceAlertPanel(
  folder: vscode.WorkspaceFolder,
): Promise<SidebarGovernanceAlertPanel> {
  const root = folder.uri.fsPath;
  try {
    const dismissed = await readDismissedGovernanceAlerts(root);
    let index = await readKnowledgeLifecycle(root);
    if (!index?.decisions.length) {
      index = await persistKnowledgeLifecycle(root).catch(() => index);
    }
    const panel = buildGovernanceAlertPanel(index, dismissed);
    return {
      alerts: panel.alerts,
      topAlert: panel.top_alert,
      totalCount: panel.total_count,
      dismissedCount: panel.dismissed_count,
      empty: !panel.top_alert,
    };
  } catch {
    return { ...EMPTY };
  }
}
