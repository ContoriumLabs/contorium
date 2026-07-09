import assert from 'node:assert/strict';
import { extractDecisionRefsFromAskResult } from '../packages/state-core/dist/lifecycle/askBridge.js';

const historyRefs = extractDecisionRefsFromAskResult('history', {
  events: [
    { linked_decision_id: 'adr-001', decision: 'Use JWT', title: 'x', summary: '', files: [], impact: [], freshness: 'fresh', source: [], id: 'e1', timestamp: '2024-01-01T00:00:00Z' },
  ],
});
assert.ok(historyRefs.includes('adr-001'), 'history linked decision');
assert.ok(historyRefs.includes('Use JWT'), 'history decision title');

const actionRefs = extractDecisionRefsFromAskResult('action', {
  items: [
    { task: 'Review decision: OAuth2 migration', reason: 'pending', confidence: 0.5, source: 'decision', decision_ref: 'adr-002', constraints: { risk: 'medium', requires_confirmation: true, is_executable: false } },
  ],
});
assert.ok(actionRefs.includes('adr-002'), 'action decision_ref');

const entityRefs = extractDecisionRefsFromAskResult('entity', {
  record: { entity: 'mcp', events: [], decisions: ['adr-mcp'], modules: [], snapshots: [], schema: 'knowledge_entity.v1', updated_at: '', projection_of: 'cognitive_events', derived_from: [] },
});
assert.ok(entityRefs.includes('adr-mcp'), 'entity decisions');

const stateRefs = extractDecisionRefsFromAskResult('state', {
  review_queue: [{ decision_id: 'adr-r1', title: 'State layer', reason: 'stale', detail: 'x', severity: 'medium' }],
});
assert.ok(stateRefs.includes('adr-r1'), 'state review queue');

console.log('Lifecycle ask filter extraction OK');
