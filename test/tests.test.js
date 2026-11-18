import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areaFor, groupResults, mergeTesting } from '../lib/tests.js';
import { computeTesting } from '../lib/compute.js';

const AREAS = [
  { area: 'AI agent', match: ['agent-*', 'live-openrouter'], note: 'Needs a model key' },
  { area: 'Finance', match: ['payments'] },
  { area: 'Web', match: ['web/*'] },
];

const RESULTS = {
  generated_at: '2026-11-18T10:00:00Z',
  repo: 'o/r',
  branch: 'admin-design',
  sha: 'abcdef1234',
  run_url: 'https://github.com/o/r/actions/runs/1',
  totals: { files: 5, tests: 20 },
  files: [
    { workspace: 'server', file: 'server/src/__tests__/agent-core.test.ts', tests: 10, passed: 9, failed: 1, skipped: 0 },
    { workspace: 'server', file: 'server/src/__tests__/live-openrouter.test.ts', tests: 3, passed: 0, failed: 0, skipped: 3 },
    { workspace: 'server', file: 'server/src/__tests__/payments.test.ts', tests: 4, passed: 4, failed: 0, skipped: 0 },
    { workspace: 'web', file: 'web/src/components/ui.test.tsx', tests: 2, passed: 2, failed: 0, skipped: 0 },
    { workspace: 'server', file: 'server/src/__tests__/brand-new.test.ts', tests: 1, passed: 1, failed: 0, skipped: 0 },
  ],
};

test('area patterns: stem globs, path globs, and Other for anything unmatched', () => {
  assert.equal(areaFor('server/src/__tests__/agent-core.test.ts', AREAS), 'AI agent');
  assert.equal(areaFor('server/src/__tests__/payments.test.ts', AREAS), 'Finance');
  assert.equal(areaFor('server/src/__tests__/payments-extra.test.ts', AREAS), 'Other', 'a stem must match whole, not a prefix');
  assert.equal(areaFor('web/src/components/ui.test.tsx', AREAS), 'Web');
  assert.equal(areaFor('server/src/__tests__/brand-new.test.ts', AREAS), 'Other');
});

test('grouping sums per area: skipped is written but not executed, failed is executed but not passed', () => {
  const suites = groupResults(RESULTS, AREAS);
  assert.deepEqual(suites.map((s) => s.area), ['AI agent', 'Finance', 'Web', 'Other']);
  const ai = suites[0];
  assert.deepEqual([ai.written, ai.executed, ai.passed], [13, 10, 9]);
  assert.match(ai.note, /3 skipped/);
  assert.match(ai.note, /Needs a model key/);
  assert.equal(ai.evidence, 'https://github.com/o/r/actions/runs/1');
  assert.equal(ai.updated_on, '2026-11-18');
  assert.match(suites[3].note, /testing\.areas/);
});

test('merged testing keeps bugs and feeds the same totals the page shows', () => {
  const merged = mergeTesting({ areas: AREAS, suites: [{ area: 'old', written: 1, executed: 1, passed: 1 }], bugs: [{ id: 'B1', status: 'open', severity: 'high' }] }, RESULTS);
  assert.equal(merged.bugs.length, 1);
  assert.match(merged.note, /^Live: automated run on wigo-admin admin-design at abcdef1/);
  const t = computeTesting(merged).totals;
  assert.deepEqual([t.written, t.executed, t.passed, t.failed, t.notRun], [20, 17, 16, 1, 3]);
});

test('no results leaves the saved testing untouched', () => {
  const saved = { suites: [] };
  assert.equal(mergeTesting(saved, null), saved);
  assert.equal(mergeTesting(saved, { files: [] }), saved);
});
