#!/usr/bin/env node
/**
 * Smoke test — lifecycle exports, ask hints, dashboard panel helpers.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const {
  formatLifecycleTrustWarnings,
  appendLifecycleTrustWarnings,
} = await import('../packages/state-core/dist/lifecycle/index.js');

const warn = formatLifecycleTrustWarnings(
  {
    schema: 'contorium.lifecycle.v2',
    updated_at: '',
    projection_of: 'cognitive_events',
    derived_from: [],
    decisions: [
      {
        decision_id: 'adr-1',
        title: 'Use JWT for auth',
        adr_status: 'accepted',
        lifecycle_status: 'ACTIVE',
        created_at: '2024-01-01',
        freshness_score: 30,
        expired: true,
        needs_review: true,
        meta: {},
        confidence: {
          source: 80,
          freshness: 30,
          conflict: 90,
          ownership: 50,
          verification: 40,
          consistency: 70,
          usage: 60,
          overall: 45,
        },
        evolution_chain: ['adr-1'],
        conflict_refs: [],
        evidence: [],
        formatted_warnings: ['Stale verification'],
        validity_state: 'NEEDS_REVALIDATION',
        validity_signals: [],
        invalidation_score: 0,
        decay_penalty: 0,
      },
    ],
    health: {
      schema: 'contorium.knowledge_health.v1',
      updated_at: '',
      projection_of: 'cognitive_events',
      derived_from: [],
      score: 62,
      dimensions: {
        completeness: 80,
        freshness: 40,
        ownership: 50,
        verification: 45,
        conflict: 90,
        drift: 70,
        review_debt: 55,
        overall: 62,
      },
      expired_decisions: 1,
      stale_decisions: 1,
      conflict_count: 0,
      missing_owner_count: 1,
      unverified_count: 1,
      formatted: [],
    },
    review_queue: [
      {
        decision_id: 'adr-1',
        title: 'Use JWT for auth',
        reason: 'stale',
        detail: 'Not verified recently',
        severity: 'medium',
      },
    ],
  },
  'History mentions Use JWT for auth in recent events.',
  'history',
);
assert.ok(warn?.includes('Lifecycle trust warnings'), 'history mention triggers trust warning');

const noWarn = formatLifecycleTrustWarnings(null, 'plain answer', 'history');
assert.equal(noWarn, undefined, 'no lifecycle index → no warning block');

const merged = await appendLifecycleTrustWarnings('/tmp/none', 'base answer', 'entity');
assert.equal(merged, 'base answer', 'missing workspace → unchanged answer');

function runScript(rel) {
  const r = spawnSync(process.execPath, [path.join(root, rel)], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (r.status !== 0) {
    throw new Error(`${rel} failed:\n${r.stderr || r.stdout}`);
  }
}

runScript('scripts/verify-lifecycle-ask-filter.mjs');

console.log('Lifecycle integration OK');
