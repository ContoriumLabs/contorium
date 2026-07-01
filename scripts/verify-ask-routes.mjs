import assert from 'node:assert/strict';
import { routeQuery } from '../packages/state-core/dist/cil/queryRouter.js';

const cases = [
  ['What happened?', 'history'],
  ['Why was this done?', 'decision'],
  ['What should I do next?', 'action'],
  ['What is this project?', 'story'],
  ['What was state on 2024-06-01?', 'time_travel'],
  ['What was state at a time?', 'time_travel'],
  ['What is MCP?', 'entity', 'MCP'],
  ['Tell me everything about MCP', 'entity'],
  ['Is the project healthy?', 'state', 'health'],
  ['What is cognitive health score?', 'state', 'health'],
  ['What is the core direction?', 'direction'],
];

let failed = 0;
for (const [q, intent, topic] of cases) {
  const r = routeQuery(q);
  const ok = r.intent === intent && (topic === undefined || r.topic === topic);
  if (!ok) {
    failed += 1;
    console.error(`FAIL: "${q}" -> ${r.intent}/${r.topic ?? ''} expected ${intent}/${topic ?? ''}`);
  } else {
    console.log(`OK: "${q}" -> ${r.intent}${r.topic ? ` (${r.topic})` : ''}`);
  }
}

if (failed) {
  process.exit(1);
}
console.log('All route checks passed.');
