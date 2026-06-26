/** CIL overlay payload for sidebar webview. */
export interface CilOverlay {
  kind: 'cil';
  title: string;
  subtitle?: string;
  lines: string[];
}

export type SidebarOverlay = import('./sidebarGovernancePanel.js').GovernanceOverviewOverlay
  | import('./sidebarGovernancePanel.js').ChangeReviewOverlay
  | CilOverlay;
