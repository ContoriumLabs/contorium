/**
 * Contorium MCP Governance V4 — single-decision pipeline API.
 * @see 优化.md § V4 MCP 接口层
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  buildGovernanceReviewArtifact,
  compileGovernanceInjectPrompt,
  createControlSurface,
  buildGovernanceExportAppendixFull,
  formatGovernanceExportSection,
  formatReviewForInject,
  getGovernanceSummary,
  matchProtectedPath,
  mergeReviewArtifacts,
  readGovernanceReview,
  readStateJson,
  readUserRequestOverlay,
  reviewGitCommitChanges,
  reviewGitStagedChanges,
  reviewOpenFilesChanges,
  writeGovernanceReview,
  listGitStagedRelativePaths,
  persistGovernanceCycleArtifacts,
  type GovernanceReviewArtifact,
  type ReviewScopePreference,
  type ScopedFileReviewInput,
} from '@contora/state-core';
import { loadWorkspaceSnapshot } from './workspace.js';

function textResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

const workspaceRootSchema = z.object({
  workspaceRoot: z.string().optional().describe('Override workspace root; default auto-detect'),
});

const scopedFileSchema = z.object({
  relativePath: z.string().min(1),
  diff_text: z.string().optional(),
  lines_added: z.number().int().min(0).optional(),
  lines_removed: z.number().int().min(0).optional(),
});

const cycleModeSchema = z.enum(['strict', 'soft', 'advisory']);
const scopeModeSchema = z.enum(['auto', 'strict', 'minimal']);
const injectStyleSchema = z.enum(['minimal', 'full', 'explain']);

function normPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

function uniqPaths(paths: string[]): string[] {
  return [...new Set(paths.map(normPath).filter(Boolean))];
}

// ─── Internal review pipeline (single decision path) ───────────────────────

async function reviewCurrentFile(
  root: string,
  targetPath: string,
  diffText?: string,
  linesAdded?: number,
  linesRemoved?: number,
): Promise<GovernanceReviewArtifact | null> {
  const control = createControlSurface(root, 'mcp');
  const result = await control.checkAction({
    type: 'file_write',
    target_path: targetPath,
    description: `Governance cycle: ${targetPath}`,
    diff_text: diffText,
    lines_added: linesAdded,
    lines_removed: linesRemoved,
  });
  if (result.loop !== 'check') {
    return null;
  }
  return buildGovernanceReviewArtifact(result, normPath(targetPath), {
    reviewSource: diffText ? 'editor_diff' : 'static_file',
    reviewScope: 'current_file',
  });
}

async function executeGovernanceReview(
  root: string,
  opts: {
    scope?: ReviewScopePreference;
    target_path?: string;
    diff_text?: string;
    lines_added?: number;
    lines_removed?: number;
    scoped_files?: ScopedFileReviewInput[];
    persist?: boolean;
  },
): Promise<GovernanceReviewArtifact | null> {
  const scope = opts.scope ?? 'auto';
  const artifacts: Array<GovernanceReviewArtifact | null> = [];

  const pushCurrent = async (): Promise<void> => {
    if (!opts.target_path) {
      return;
    }
    artifacts.push(
      await reviewCurrentFile(
        root,
        opts.target_path,
        opts.diff_text,
        opts.lines_added,
        opts.lines_removed,
      ),
    );
  };

  const pushOpen = async (): Promise<void> => {
    if (!opts.scoped_files?.length) {
      return;
    }
    artifacts.push(await reviewOpenFilesChanges(root, opts.scoped_files));
  };

  if (scope === 'auto') {
    await pushCurrent();
    await pushOpen();
    artifacts.push(await reviewGitStagedChanges(root));
    artifacts.push(await reviewGitCommitChanges(root));
  } else if (scope === 'current_file') {
    await pushCurrent();
  } else if (scope === 'open_files') {
    await pushOpen();
  } else if (scope === 'git_staged') {
    artifacts.push(await reviewGitStagedChanges(root));
  } else if (scope === 'git_commit') {
    artifacts.push(await reviewGitCommitChanges(root));
  }

  let final = mergeReviewArtifacts(artifacts);
  if (!final) {
    final = await readGovernanceReview(root);
  } else if (opts.persist !== false) {
    await writeGovernanceReview(root, final);
  }
  return final;
}

// ─── V4 API implementations ───────────────────────────────────────────────

export async function getControlContext(root: string) {
  const control = createControlSurface(root, 'mcp');
  const [controlState, govResult, snapshot, review, overlay, summary] = await Promise.all([
    control.getState(),
    control.getGovernance(),
    loadWorkspaceSnapshot(root),
    readGovernanceReview(root),
    readUserRequestOverlay(root),
    getGovernanceSummary(root),
  ]);

  let staged = snapshot?.gitStaged ?? [];
  try {
    const live = await listGitStagedRelativePaths(root);
    if (live.length) {
      staged = live;
    }
  } catch {
    /* use snapshot */
  }

  return {
    version: 'v4',
    workspaceRoot: root,
    project_state: {
      current_task: snapshot?.currentTask ?? '',
      notes: snapshot?.notes ?? '',
      session_id: snapshot?.sessionId,
      open_files: snapshot?.openFiles ?? [],
      recent_files: snapshot?.recentFiles ?? [],
      last_updated: snapshot?.lastUpdated ?? 0,
    },
    active_files: snapshot?.openFiles ?? [],
    git: {
      branch: '',
      staged,
      working: snapshot?.gitWorking ?? [],
      commit_head: 'HEAD',
    },
    governance: {
      enabled: summary.found,
      policy_version: 'v3.2',
      constitution_loaded: Boolean(summary.constitution),
      truth_loaded: Boolean(summary.truth),
      identity_loaded: Boolean(summary.identity),
      protected_path_count: summary.protected_path_count,
      project_goal: overlay?.goal?.trim() ?? '',
      summary: govResult.governance,
    },
    review_snapshot: review
      ? {
          risk: review.risk,
          impact: review.impact,
          recommendation: review.recommendation,
          review_source: review.review_source,
          review_scope: review.review_scope,
          file: review.file,
        }
      : null,
    control_state: controlState,
  };
}

export async function resolveScopeContext(
  root: string,
  input: {
    diff_text?: string;
    active_file?: string;
    mode?: 'auto' | 'strict' | 'minimal';
    scoped_files?: ScopedFileReviewInput[];
    scope_preference?: ReviewScopePreference;
  },
) {
  const mode = input.mode ?? 'auto';
  const snapshot = await loadWorkspaceSnapshot(root);
  const summary = await getGovernanceSummary(root);

  const primary: string[] = [];
  const related: string[] = [];
  const risk: string[] = [];
  const dependency: string[] = [];

  if (input.active_file) {
    primary.push(normPath(input.active_file));
  }

  for (const f of input.scoped_files ?? []) {
    const p = normPath(f.relativePath);
    if (!primary.includes(p)) {
      related.push(p);
    }
  }

  if (mode !== 'minimal') {
    for (const f of snapshot?.openFiles ?? []) {
      const p = normPath(f);
      if (!primary.includes(p) && !related.includes(p)) {
        related.push(p);
      }
    }
  }

  if (mode === 'auto') {
    let staged: string[] = snapshot?.gitStaged ?? [];
    try {
      staged = await listGitStagedRelativePaths(root);
    } catch {
      /* snapshot fallback */
    }
    for (const f of staged) {
      const p = normPath(f);
      if (!primary.includes(p) && !related.includes(p)) {
        related.push(p);
      }
    }
  }

  const candidates = uniqPaths([...primary, ...related]);
  if (summary.constitution) {
    for (const file of candidates) {
      if (matchProtectedPath(file, summary.constitution) && !risk.includes(file)) {
        risk.push(file);
      }
    }
  }

  if (mode === 'strict' && primary.length === 0 && related.length === 0 && input.active_file) {
    primary.push(normPath(input.active_file));
  }

  return {
    version: 'v4',
    primary_files: uniqPaths(primary),
    related_files: uniqPaths(related.filter((f) => !primary.includes(f))),
    risk_files: uniqPaths(risk),
    dependency_files: uniqPaths(dependency),
    scope_preference: input.scope_preference ?? 'auto',
    mode,
  };
}

function mapDecisionAction(
  review: GovernanceReviewArtifact | null,
  mode: 'strict' | 'soft' | 'advisory',
): 'allow' | 'warn' | 'block' | 'inject_fix' {
  if (!review) {
    return 'allow';
  }
  if (mode === 'advisory') {
    if (review.risk === 'critical' || review.risk === 'high') {
      return 'inject_fix';
    }
    if (review.risk === 'medium') {
      return 'warn';
    }
    return 'allow';
  }
  if (!review.allow || review.status === 'block') {
    return 'block';
  }
  if (review.risk === 'critical' || review.risk === 'high') {
    return mode === 'strict' ? 'block' : 'inject_fix';
  }
  if (review.risk === 'medium' || review.status === 'warn') {
    return 'warn';
  }
  return 'allow';
}

function suggestNextAction(
  review: GovernanceReviewArtifact | null,
  decision: 'allow' | 'warn' | 'block' | 'inject_fix',
): string {
  if (!review) {
    return 'No review artifact — call run_governance_cycle with active_file and diff';
  }
  switch (decision) {
    case 'block':
      return 'Stop — governance block. Ask user before proceeding.';
    case 'inject_fix':
      return 'Call generate_inject_payload then proceed with user acknowledgment.';
    case 'warn':
      return 'Proceed with caution — include governance context in next model turn.';
    default:
      return 'Safe to proceed under current governance policy.';
  }
}

function buildScopedFilesFromScope(
  scope: Awaited<ReturnType<typeof resolveScopeContext>>,
  diff?: { text?: string; lines_added?: number; lines_removed?: number },
): ScopedFileReviewInput[] {
  const files = uniqPaths([...scope.primary_files, ...scope.related_files, ...scope.risk_files]);
  return files.map((relativePath, i) => ({
    relativePath,
    diff_text: i === 0 ? diff?.text : undefined,
    lines_added: i === 0 ? diff?.lines_added : undefined,
    lines_removed: i === 0 ? diff?.lines_removed : undefined,
  }));
}

export async function runGovernanceCycle(
  root: string,
  input: {
    active_file?: string;
    diff?: { text?: string; lines_added?: number; lines_removed?: number };
    scope?: {
      primary_files?: string[];
      related_files?: string[];
    };
    scope_mode?: 'auto' | 'strict' | 'minimal';
    scope_preference?: ReviewScopePreference;
    scoped_files?: ScopedFileReviewInput[];
    mode?: 'strict' | 'soft' | 'advisory';
    user_confirmed?: boolean;
    persist?: boolean;
    audit?: boolean;
  },
) {
  const cycleMode = input.mode ?? 'soft';
  const cycleStarted = Date.now();
  const resolvedScope = await resolveScopeContext(root, {
    active_file: input.active_file,
    diff_text: input.diff?.text,
    mode: input.scope_mode ?? 'auto',
    scoped_files: input.scoped_files,
    scope_preference: input.scope_preference,
  });
  const scopeContext = input.scope
    ? {
        ...resolvedScope,
        primary_files: input.scope.primary_files?.length
          ? uniqPaths(input.scope.primary_files)
          : resolvedScope.primary_files,
        related_files: input.scope.related_files?.length
          ? uniqPaths(input.scope.related_files)
          : resolvedScope.related_files,
      }
    : resolvedScope;

  const scopePref = input.scope_preference ?? 'auto';
  const primaryTarget =
    input.active_file ??
    scopeContext.primary_files[0] ??
    scopeContext.related_files[0] ??
    scopeContext.risk_files[0];

  const scopedFiles =
    input.scoped_files ??
    buildScopedFilesFromScope(
      {
        primary_files: scopeContext.primary_files ?? [],
        related_files: scopeContext.related_files ?? [],
        risk_files: scopeContext.risk_files ?? [],
        dependency_files: scopeContext.dependency_files ?? [],
        version: 'v4',
        scope_preference: scopePref,
        mode: input.scope_mode ?? 'auto',
      },
      input.diff,
    );

  const review = await executeGovernanceReview(root, {
    scope: scopePref,
    target_path: primaryTarget,
    diff_text: input.diff?.text,
    lines_added: input.diff?.lines_added,
    lines_removed: input.diff?.lines_removed,
    scoped_files: scopedFiles.length ? scopedFiles : undefined,
    persist: input.persist !== false,
  });

  let auditResult: unknown = null;
  if (input.audit && primaryTarget && cycleMode === 'strict') {
    const control = createControlSurface(root, 'mcp');
    auditResult = await control.executeAction({
      type: 'file_write',
      target_path: primaryTarget,
      description: `Governance cycle audit: ${primaryTarget}`,
      diff_text: input.diff?.text,
      lines_added: input.diff?.lines_added,
      lines_removed: input.diff?.lines_removed,
      user_confirmed: input.user_confirmed,
      strict: cycleMode === 'strict',
      audit: true,
    });
  }

  const violations = (review?.reason_chain ?? []).map((line) => ({
    rule: line,
    severity: review?.severity ?? 'low',
    file: review?.file ?? primaryTarget ?? '',
    line: '',
  }));

  const decisionAction = mapDecisionAction(review, cycleMode);

  const result = {
    version: 'v4',
    scope: scopeContext,
    review: {
      summary: review?.reason ?? 'No governance violations detected',
      issues: review?.reason_chain ?? [],
      artifact: review,
      path: '.contora/governance/review.json',
    },
    diff_analysis: review
      ? {
          change_type: review.change_type,
          severity: review.severity,
          impact: review.impact,
          confidence: review.confidence,
          lines_added: review.lines_added,
          lines_removed: review.lines_removed,
        }
      : null,
    violations,
    decision: {
      action: decisionAction,
      reason: review?.reason ?? '',
      recommendation: review?.recommendation,
      allow: review?.allow ?? true,
      guard_action: review?.status,
    },
    inject: {
      required: decisionAction === 'inject_fix' || decisionAction === 'warn',
      payload: review ? formatReviewForInject(review) : '',
    },
    metrics: {
      risk: review?.risk ?? 'low',
      display_score: review?.display_score ?? 0,
      confidence: review?.confidence ?? 0,
    },
    audit: auditResult,
    next_action: suggestNextAction(review, decisionAction),
  };

  if (input.persist !== false) {
    try {
      await persistGovernanceCycleArtifacts(root, {
        source: 'mcp',
        review,
        scope: {
          primary_files: scopeContext.primary_files ?? [],
          related_files: scopeContext.related_files ?? [],
          risk_files: scopeContext.risk_files ?? [],
          dependency_files: scopeContext.dependency_files ?? [],
        },
        decision_action: decisionAction,
        cycle_mode: cycleMode,
        started_at: cycleStarted,
        v4_payload: result,
      });
    } catch {
      // non-fatal
    }
  }

  return result;
}

export async function generateInjectPayload(
  root: string,
  input: {
    active_file?: string;
    user_task?: string;
    project_goal?: string;
    style?: 'minimal' | 'full' | 'explain';
    decision?: { artifact?: GovernanceReviewArtifact | null };
    refresh_cycle?: boolean;
    cycle_mode?: 'strict' | 'soft' | 'advisory';
  },
) {
  let review = input.decision?.artifact ?? (await readGovernanceReview(root));
  if (!review || input.refresh_cycle !== false) {
    const cycle = await runGovernanceCycle(root, {
      active_file: input.active_file,
      mode: input.cycle_mode ?? 'soft',
      persist: true,
    });
    review = cycle.review.artifact;
  }

  const [overlay, state] = await Promise.all([
    readUserRequestOverlay(root),
    readStateJson(root).catch(() => null),
  ]);

  const promptMode: 'smart' | 'diff' =
    input.style === 'explain' ? 'diff' : input.style === 'minimal' ? 'smart' : 'smart';

  const inject_prompt = await compileGovernanceInjectPrompt(
    {
      workspaceRoot: root,
      projectGoal: input.project_goal ?? (overlay?.goal?.trim() || undefined),
      userTask: input.user_task ?? (typeof state?.currentTask === 'string' ? state.currentTask : ''),
      activeFile: input.active_file ?? review?.file,
    },
    promptMode,
  );

  return {
    version: 'v4',
    inject_prompt,
    metadata: {
      why_chain: review?.reason_chain ?? [],
      risk_notes: [
        review?.recommendation,
        review?.impact ? `Impact: ${review.impact}` : '',
        review?.risk ? `Risk: ${review.risk}` : '',
      ].filter(Boolean),
      style: input.style ?? 'full',
      mode: promptMode,
    },
    review_summary: review
      ? {
          risk: review.risk,
          recommendation: review.recommendation,
          review_source: review.review_source,
        }
      : null,
  };
}

export async function exportGovernanceContext(
  root: string,
  input: {
    active_file?: string;
    include?: Array<'governance' | 'diff' | 'inject' | 'state'>;
    refresh_cycle?: boolean;
  },
) {
  const include = input.include ?? ['governance', 'state'];
  const sections: Record<string, string> = {};

  if (input.refresh_cycle) {
    await runGovernanceCycle(root, { active_file: input.active_file, persist: true });
  }

  const review = await readGovernanceReview(root);

  if (include.includes('governance')) {
    sections.governance = await buildGovernanceExportAppendixFull(root, review);
  }
  if (include.includes('state')) {
    const ctx = await getControlContext(root);
    sections.state = JSON.stringify(ctx.project_state, null, 2);
  }
  if (include.includes('inject')) {
    const inj = await generateInjectPayload(root, {
      active_file: input.active_file,
      refresh_cycle: false,
      style: 'full',
    });
    sections.inject = inj.inject_prompt;
  }
  if (include.includes('diff') && review) {
    sections.diff = JSON.stringify(
      {
        file: review.file,
        change_type: review.change_type,
        lines_added: review.lines_added,
        lines_removed: review.lines_removed,
        reason_chain: review.reason_chain,
      },
      null,
      2,
    );
  }

  const export_text = Object.values(sections).filter(Boolean).join('\n\n---\n\n');
  return {
    version: 'v4',
    export_text,
    sections,
    review_path: '.contora/governance/review.json',
  };
}

export async function ensureControlReadyV4(root: string) {
  const control = createControlSurface(root, 'mcp');
  const ready = await control.ensureReady();
  const summary = await getGovernanceSummary(root);
  return {
    ready: true,
    version: 'v4',
    policy_loaded: summary.found,
    workspaceRoot: root,
    ...ready,
  };
}

// ─── MCP tool registration ─────────────────────────────────────────────────

export function registerGovernanceV4Tools(
  server: McpServer,
  resolveRoot: () => Promise<string>,
): void {
  server.registerTool(
    'get_control_context',
    {
      description:
        '[Governance V4] Unified MCP context: project state, git, governance summary, review snapshot.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ? override : await resolveRoot();
      return textResult(await getControlContext(root));
    },
  );

  server.registerTool(
    'resolve_scope_context',
    {
      description:
        '[Governance V4] Resolve diff/file/project into primary, related, risk, and dependency file scopes.',
      inputSchema: z.object({
        workspaceRoot: z.string().optional(),
        diff_text: z.string().optional(),
        active_file: z.string().optional(),
        mode: scopeModeSchema.optional(),
        scope_preference: z
          .enum(['auto', 'current_file', 'open_files', 'git_staged', 'git_commit'])
          .optional(),
        scoped_files: z.array(scopedFileSchema).optional(),
      }),
    },
    async (args) => {
      const root = args.workspaceRoot ? args.workspaceRoot : await resolveRoot();
      return textResult(
        await resolveScopeContext(root, {
          diff_text: args.diff_text,
          active_file: args.active_file,
          mode: args.mode,
          scoped_files: args.scoped_files,
          scope_preference: args.scope_preference,
        }),
      );
    },
  );

  server.registerTool(
    'run_governance_cycle',
    {
      description:
        '[Governance V4 · CORE] Single governance decision pipeline — review + violations + decision + inject hint. Replaces check_action / validate_governance / run_governance_review.',
      inputSchema: z.object({
        workspaceRoot: z.string().optional(),
        active_file: z.string().optional(),
        diff: z
          .object({
            text: z.string().optional(),
            lines_added: z.number().int().min(0).optional(),
            lines_removed: z.number().int().min(0).optional(),
          })
          .optional(),
        scope_mode: scopeModeSchema.optional(),
        scope_preference: z
          .enum(['auto', 'current_file', 'open_files', 'git_staged', 'git_commit'])
          .optional(),
        scoped_files: z.array(scopedFileSchema).optional(),
        mode: cycleModeSchema.optional().describe('strict | soft | advisory'),
        user_confirmed: z.boolean().optional(),
        persist: z.boolean().optional(),
        audit: z.boolean().optional().describe('Write change-log on strict execute'),
      }),
    },
    async (args) => {
      const root = args.workspaceRoot ? args.workspaceRoot : await resolveRoot();
      return textResult(
        await runGovernanceCycle(root, {
          active_file: args.active_file,
          diff: args.diff,
          scope_mode: args.scope_mode,
          scope_preference: args.scope_preference,
          scoped_files: args.scoped_files,
          mode: args.mode,
          user_confirmed: args.user_confirmed,
          persist: args.persist,
          audit: args.audit,
        }),
      );
    },
  );

  server.registerTool(
    'generate_inject_payload',
    {
      description:
        '[Governance V4] Build inject prompt from governance decision (replaces compile_governance_inject).',
      inputSchema: z.object({
        workspaceRoot: z.string().optional(),
        active_file: z.string().optional(),
        user_task: z.string().optional(),
        project_goal: z.string().optional(),
        style: injectStyleSchema.optional(),
        refresh_cycle: z.boolean().optional(),
        cycle_mode: cycleModeSchema.optional(),
      }),
    },
    async (args) => {
      const root = args.workspaceRoot ? args.workspaceRoot : await resolveRoot();
      return textResult(await generateInjectPayload(root, args));
    },
  );

  server.registerTool(
    'export_governance_context',
    {
      description:
        '[Governance V4] Unified governance export (replaces get_governance_export_section).',
      inputSchema: z.object({
        workspaceRoot: z.string().optional(),
        active_file: z.string().optional(),
        include: z.array(z.enum(['governance', 'diff', 'inject', 'state'])).optional(),
        refresh_cycle: z.boolean().optional(),
      }),
    },
    async (args) => {
      const root = args.workspaceRoot ? args.workspaceRoot : await resolveRoot();
      return textResult(await exportGovernanceContext(root, args));
    },
  );

  server.registerTool(
    'ensure_control_ready',
    {
      description: '[Governance V4] Bootstrap governance layer and verify policy loaded.',
      inputSchema: workspaceRootSchema,
    },
    async ({ workspaceRoot: override }) => {
      const root = override ? override : await resolveRoot();
      return textResult(await ensureControlReadyV4(root));
    },
  );
}
