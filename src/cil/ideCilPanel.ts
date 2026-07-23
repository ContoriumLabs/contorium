import * as vscode from 'vscode';
import type { CilOverlay } from '../ui/sidebarCilPanel.js';

async function workspaceRoot(): Promise<string | undefined> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder?.uri.fsPath;
}

export async function fetchCilHistory(root: string): Promise<CilOverlay> {
  const { exploreHistory, syncCognitiveInteractionLayer } = await import('@contora/state-core');
  await syncCognitiveInteractionLayer(root, 'ide');
  const result = await exploreHistory(root, 'last_7_days');
  return {
    kind: 'cil',
    title: 'Project History',
    subtitle: `${result.count} events · ${result.range.replace(/_/g, ' ')}`,
    lines: result.formatted.length ? result.formatted : ['(no events in range — run Sync state)'],
  };
}

export async function fetchCilDecisions(root: string): Promise<CilOverlay> {
  const { runCognitiveKernel, syncCognitiveInteractionLayer, readKnowledgeLifecycle, formatValidityStateLabel } =
    await import('@contora/state-core');
  await syncCognitiveInteractionLayer(root, 'ide');
  const out = await runCognitiveKernel(root, { mode: 'decisions' });
  const center = out.result as { formatted?: string[] };
  const lines = center.formatted?.length ? [...center.formatted] : ['(no decisions recorded)'];

  const lc = await readKnowledgeLifecycle(root).catch(() => null);
  if (lc?.decisions.length) {
    lines.push('', '---', 'Knowledge Lifecycle (validity overlay)', '');
    const flagged = lc.decisions.filter(
      (r) =>
        r.needs_review ||
        r.formatted_warnings.length ||
        r.lifecycle_status !== 'ACTIVE' ||
        (r.validity_state && r.validity_state !== 'VALID'),
    );
    for (const r of (flagged.length ? flagged : lc.decisions).slice(0, 10)) {
      const warn =
        r.validity_state !== 'VALID' ||
        r.needs_review ||
        r.conflict_refs.length > 0;
      const topSignal = [...(r.validity_signals ?? [])].sort((a, b) => {
        const rank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        return (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0);
      })[0];
      lines.push(
        `${warn ? '⚠' : '·'} ${r.title}`,
        `  Validity ${formatValidityStateLabel(r.validity_state)} · Trust ${r.confidence.overall}% · Freshness ${r.freshness_score}%`,
      );
      if (topSignal && r.validity_state !== 'VALID') {
        lines.push(`  Why (${topSignal.type}): ${topSignal.reason}`);
      }
      for (const w of r.formatted_warnings.slice(0, 1)) {
        if (!topSignal || !w.includes(topSignal.reason)) {
          lines.push(`  ${w}`);
        }
      }
      if (r.evolution_chain.length > 1) {
        lines.push(`  Evolution chain: ${r.evolution_chain.join(' → ')}`);
      }
      lines.push('');
    }
    if (lc.review_queue.length) {
      lines.push(`Review queue: ${lc.review_queue.length} item(s) — Ask "What needs review?" or run contorium review`);
    }
  }

  return {
    kind: 'cil',
    title: 'Decision Center',
    subtitle: lc
      ? `ADR records · Knowledge Health ${lc.health.score}%`
      : 'ADR records · Why · Risk',
    lines,
  };
}

export async function fetchCilReviewQueue(root: string): Promise<CilOverlay> {
  const { runCognitiveKernel, syncCognitiveInteractionLayer } = await import('@contora/state-core');
  await syncCognitiveInteractionLayer(root, 'ide');
  const out = await runCognitiveKernel(root, { mode: 'review' });
  const result = out.result as { formatted?: string[]; answer?: string };
  return {
    kind: 'cil',
    title: 'Knowledge Review Queue',
    subtitle: 'Stale · Expired · Conflict · Invalidation triggers',
    lines: result.formatted?.length
      ? result.formatted
      : [result.answer ?? '(review queue clear)'],
  };
}

export async function fetchCilKnowledgeLifecycle(root: string): Promise<CilOverlay> {
  const { runCognitiveKernel, syncCognitiveInteractionLayer } = await import('@contora/state-core');
  await syncCognitiveInteractionLayer(root, 'ide');
  const out = await runCognitiveKernel(root, { mode: 'lifecycle' });
  const result = out.result as { formatted?: string[]; answer?: string };
  return {
    kind: 'cil',
    title: 'Knowledge Health',
    subtitle: 'Lifecycle · Freshness · Verification · Conflict',
    lines: result.formatted?.length
      ? result.formatted
      : [result.answer ?? '(run Sync state)'],
  };
}

export async function runCilHistoryPanel(): Promise<CilOverlay | undefined> {
  const root = await workspaceRoot();
  if (!root) {
    void vscode.window.showWarningMessage('Open a folder workspace to view project history.');
    return undefined;
  }
  try {
    return await fetchCilHistory(root);
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Project History failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return undefined;
  }
}

export async function runCilDecisionsPanel(): Promise<CilOverlay | undefined> {
  const root = await workspaceRoot();
  if (!root) {
    void vscode.window.showWarningMessage('Open a folder workspace to view decisions.');
    return undefined;
  }
  try {
    return await fetchCilDecisions(root);
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Decision Center failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return undefined;
  }
}

export async function fetchCilDecisionTimeline(root: string): Promise<CilOverlay> {
  const {
    syncCognitiveInteractionLayer,
    readAllAdrRecords,
    readKnowledgeLifecycle,
    formatDecisionTimeline,
  } = await import('@contora/state-core');
  await syncCognitiveInteractionLayer(root, 'ide');
  const [adrs, lc] = await Promise.all([
    readAllAdrRecords(root),
    readKnowledgeLifecycle(root).catch(() => null),
  ]);
  return {
    kind: 'cil',
    title: 'Decision Timeline',
    subtitle: 'Project evolution as a series of choices',
    lines: formatDecisionTimeline(adrs, lc),
  };
}

export const runCilTimelinePanel = () =>
  runCilOverlayPanel('Decision Timeline', fetchCilDecisionTimeline, 'Open a folder workspace first.');

async function runCilOverlayPanel(
  title: string,
  loader: (root: string) => Promise<CilOverlay>,
  emptyMsg: string,
): Promise<CilOverlay | undefined> {
  const root = await workspaceRoot();
  if (!root) {
    void vscode.window.showWarningMessage(emptyMsg);
    return undefined;
  }
  try {
    return await loader(root);
  } catch (err) {
    void vscode.window.showErrorMessage(
      `${title} failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return undefined;
  }
}

export async function fetchCilHealth(root: string): Promise<CilOverlay> {
  const { runCognitiveKernel, syncCognitiveInteractionLayer } = await import('@contora/state-core');
  await syncCognitiveInteractionLayer(root, 'ide');
  const out = await runCognitiveKernel(root, { mode: 'health' });
  const health = out.result as {
    formatted?: string[];
    score?: number;
    lifecycle_score?: number;
    knowledge_health?: { score?: number };
  };
  const subtitle =
    health.lifecycle_score != null
      ? `Cognitive ${health.score ?? '—'}% · Knowledge ${health.lifecycle_score}%`
      : health.score != null
        ? `Score ${health.score}%`
        : undefined;
  return {
    kind: 'cil',
    title: 'Project & Knowledge Health',
    subtitle,
    lines: health.formatted?.length ? health.formatted : ['(run Sync state)'],
  };
}

export async function fetchCilDna(root: string): Promise<CilOverlay> {
  const { runCognitiveKernel, syncCognitiveInteractionLayer } = await import('@contora/state-core');
  await syncCognitiveInteractionLayer(root, 'ide');
  const out = await runCognitiveKernel(root, { mode: 'dna' });
  const dna = out.result as { formatted?: string[] };
  return {
    kind: 'cil',
    title: 'Project DNA',
    subtitle: 'Identity fingerprint',
    lines: dna.formatted?.length ? dna.formatted : ['(run Sync state)'],
  };
}

export async function fetchCilReplay(root: string): Promise<CilOverlay> {
  const { runCognitiveKernel, syncCognitiveInteractionLayer } = await import('@contora/state-core');
  await syncCognitiveInteractionLayer(root, 'ide');
  const out = await runCognitiveKernel(root, { mode: 'replay' });
  const replay = out.result as { formatted?: string[] };
  return {
    kind: 'cil',
    title: 'Handoff Replay',
    subtitle: 'Cognitive evolution',
    lines: replay.formatted?.length ? replay.formatted : ['(run Sync state)'],
  };
}

export async function fetchCilImpact(root: string, module: string): Promise<CilOverlay> {
  const { exploreImpact, syncCognitiveInteractionLayer } = await import('@contora/state-core');
  await syncCognitiveInteractionLayer(root, 'ide');
  const impact = await exploreImpact(root, module);
  return {
    kind: 'cil',
    title: `Impact: ${module}`,
    subtitle: 'Blast radius',
    lines: impact.formatted,
  };
}

export const runCilHealthPanel = () =>
  runCilOverlayPanel('Cognitive Health', fetchCilHealth, 'Open a folder workspace first.');
export const runCilReviewPanel = () =>
  runCilOverlayPanel('Review Queue', fetchCilReviewQueue, 'Open a folder workspace first.');
export const runCilLifecyclePanel = () =>
  runCilOverlayPanel('Knowledge Health', fetchCilKnowledgeLifecycle, 'Open a folder workspace first.');

async function pickLifecycleDecision(root: string): Promise<string | undefined> {
  const { listLifecycleDecisionsForPicker, formatValidityStateLabel } = await import('@contora/state-core');
  const picks = await listLifecycleDecisionsForPicker(root);
  if (!picks.length) {
    void vscode.window.showInformationMessage('No decisions found — run Sync state first.');
    return undefined;
  }
  type LifecyclePick = vscode.QuickPickItem & { decisionId: string };
  const selected = await vscode.window.showQuickPick<LifecyclePick>(
    picks.map((p) => ({
      label: p.label,
      description: `${formatValidityStateLabel(p.record.validity_state)} · trust ${p.record.confidence.overall}%`,
      decisionId: p.id,
    })),
    { title: 'Select decision', placeHolder: 'ADR / decision record' },
  );
  return selected?.decisionId;
}

/** IDE shortcut — assign decision owner (mirrors `contorium lifecycle owner`). */
export async function runCilLifecycleOwnerPanel(): Promise<void> {
  const root = await workspaceRoot();
  if (!root) {
    void vscode.window.showWarningMessage('Open a folder workspace first.');
    return;
  }
  const decisionId = await pickLifecycleDecision(root);
  if (!decisionId) {
    return;
  }
  const owner = await vscode.window.showInputBox({
    title: 'Decision owner',
    prompt: 'Who owns verification and refresh for this decision?',
    placeHolder: 'team or person',
  });
  if (!owner?.trim()) {
    return;
  }
  try {
    const {
      readDecisionLifecycleMeta,
      writeDecisionLifecycleMeta,
      persistKnowledgeLifecycle,
    } = await import('@contora/state-core');
    const existing = (await readDecisionLifecycleMeta(root, decisionId)) ?? {};
    const ownerPatch: import('@contora/state-core').DecisionLifecycleMeta = { owner: owner.trim() };
    if (existing.owner?.trim() && existing.owner.trim() !== owner.trim()) {
      ownerPatch.previous_owner = existing.owner;
      ownerPatch.owner_changed_at = new Date().toISOString();
    }
    await writeDecisionLifecycleMeta(root, decisionId, { ...existing, ...ownerPatch });
    await persistKnowledgeLifecycle(root);
    void vscode.window.showInformationMessage(`Owner set for ${decisionId}: ${owner.trim()}`);
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Set owner failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** IDE shortcut — mark decision verified (mirrors `contorium lifecycle verify`). */
export async function runCilLifecycleVerifyForDecision(
  decisionId: string,
  opts?: {
    reason?: string;
    evidence?: string;
    verifiedBy?: string;
    verificationType?: 'manual' | 'automatic' | 'llm_assisted';
  },
): Promise<boolean> {
  const root = await workspaceRoot();
  if (!root) {
    void vscode.window.showWarningMessage('Open a folder workspace first.');
    return false;
  }
  try {
    const {
      readDecisionLifecycleMeta,
      writeDecisionLifecycleMeta,
      persistKnowledgeLifecycle,
      applyLifecycleVerification,
    } = await import('@contora/state-core');
    const existing = (await readDecisionLifecycleMeta(root, decisionId)) ?? {};
    await writeDecisionLifecycleMeta(
      root,
      decisionId,
      applyLifecycleVerification(existing, {
        by: opts?.verifiedBy?.trim() || 'ide',
        type: opts?.verificationType ?? 'manual',
        reason: opts?.reason,
        evidence: opts?.evidence,
      }),
    );
    await persistKnowledgeLifecycle(root);
    void vscode.window.showInformationMessage(`Verified ${decisionId} — assumptions confirmed`);
    return true;
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Verify failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

export async function runCilGovernanceAlertReview(decisionId: string): Promise<CilOverlay | undefined> {
  const root = await workspaceRoot();
  if (!root) {
    void vscode.window.showWarningMessage('Open a folder workspace first.');
    return undefined;
  }
  try {
    return await fetchCilDecisionReview(root, decisionId);
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Review failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return undefined;
  }
}

export async function fetchCilDecisionReview(root: string, decisionId: string): Promise<CilOverlay> {
  const {
    syncCognitiveInteractionLayer,
    computeKnowledgeLifecycle,
    findDecisionLifecycle,
    formatDecisionLifecycleAnswer,
    formatDecisionWhyAnswer,
    readAllAdrRecords,
  } = await import('@contora/state-core');
  await syncCognitiveInteractionLayer(root, 'ide');
  const index = await computeKnowledgeLifecycle(root);
  const record = findDecisionLifecycle(index, decisionId);
  if (!record) {
    return {
      kind: 'cil',
      title: `Decision: ${decisionId}`,
      subtitle: 'Not found',
      lines: ['Unknown decision id — run Sync state'],
    };
  }
  const adrs = await readAllAdrRecords(root);
  const lines = [
    ...formatDecisionLifecycleAnswer(record, adrs).split('\n'),
    '',
    '---',
    ...formatDecisionWhyAnswer(record),
  ];
  return {
    kind: 'cil',
    title: 'Decision impact review',
    subtitle: `${record.decision_id} · ${record.title}`,
    lines,
  };
}

/** IDE shortcut — mark decision verified (mirrors `contorium lifecycle verify`). */
export async function runCilLifecycleVerifyPanel(): Promise<void> {
  const root = await workspaceRoot();
  if (!root) {
    void vscode.window.showWarningMessage('Open a folder workspace first.');
    return;
  }
  const decisionId = await pickLifecycleDecision(root);
  if (!decisionId) {
    return;
  }
  const verifyType = await vscode.window.showQuickPick(
    [
      { label: 'Manual review', value: 'manual' as const },
      { label: 'Automatic (code scan)', value: 'automatic' as const },
      { label: 'LLM assisted', value: 'llm_assisted' as const },
    ],
    { title: 'Verification type' },
  );
  if (!verifyType) {
    return;
  }
  const verifiedBy = await vscode.window.showInputBox({
    title: 'Verified by',
    prompt: 'Optional — defaults to IDE user',
    value: 'ide',
  });
  try {
    const reason = await vscode.window.showInputBox({
      title: 'Why is this decision still valid?',
      prompt: 'Optional — recorded as verification evidence (优化.md §10)',
      placeHolder: 'e.g. Redis replaced by compatible cache layer',
    });
    const evidence = await vscode.window.showInputBox({
      title: 'Evidence',
      prompt: 'Optional supporting note',
      placeHolder: 'e.g. cache abstraction preserved in cache.service.ts',
    });
    await runCilLifecycleVerifyForDecision(decisionId, {
      reason: reason?.trim() || undefined,
      evidence: evidence?.trim() || undefined,
      verifiedBy: verifiedBy?.trim() || 'ide',
      verificationType: verifyType.value,
    });
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Verify failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export const runCilDnaPanel = () =>
  runCilOverlayPanel('Project DNA', fetchCilDna, 'Open a folder workspace first.');
export const runCilReplayPanel = () =>
  runCilOverlayPanel('Handoff Replay', fetchCilReplay, 'Open a folder workspace first.');
export async function runCilImpactPanel(): Promise<CilOverlay | undefined> {
  const mod = await vscode.window.showInputBox({
    title: 'Explore Impact',
    prompt: 'Module or file path',
    placeHolder: 'auth.ts',
  });
  if (!mod?.trim()) {
    return undefined;
  }
  const root = await workspaceRoot();
  if (!root) {
    void vscode.window.showWarningMessage('Open a folder workspace first.');
    return undefined;
  }
  try {
    return await fetchCilImpact(root, mod.trim());
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Impact failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return undefined;
  }
}
