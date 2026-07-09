#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  filterUserFacingPaths,
  sanitizeCognitiveEventForDisplay,
} from '../packages/state-core/dist/cil/pathFilters.js';

const mixed = [
  'src/index.html',
  '.contora/change.json',
  'packages/mcp/src/server.ts',
  '.contora/cognitive/state.json',
];
assert.deepEqual(filterUserFacingPaths(mixed), [
  'src/index.html',
  'packages/mcp/src/server.ts',
]);

const evt = sanitizeCognitiveEventForDisplay({
  schema: 'cognitive_event.v1',
  id: '2026-07-07_evt_workspace_change',
  timestamp: '2026-07-07T12:00:00.000Z',
  title: 'Modified 8 file(s)',
  summary: 'changes',
  files: mixed,
  impact: mixed,
  freshness: 'fresh',
  source: ['git'],
  provenance: ['git'],
});
assert.equal(evt.files.length, 2);
assert.equal(evt.impact.length, 2);
assert.ok(!evt.files.some((f) => f.startsWith('.contora/')));
assert.ok(!evt.impact.some((f) => f.startsWith('.contora/')));

console.log('Ask path filter OK');
