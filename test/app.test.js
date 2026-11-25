import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkflows, parseAdapters, parseOpen, parseReadme, adapterStatus, mergeApp, recentCommits } from '../lib/app.js';
import { compute, computeApp, computeCombined, validate } from '../lib/compute.js';

const README = `# WIGO Rider App — Full Build Status

## Headline numbers

- **WF 01 Onboarding (Buy + Rent): 23 / 23 screens, fully real** — unchanged.
- **WF 02 Daily App: 20 / 31 screens, mostly real** — eleven to go.
- **Beyond WF 01/02:** not a count line.

## Section 4 — Vendor adapter status

| Adapter | Status | Detail |
|---|---|---|
| **OTP** | Conditionally real | Switches to real delivery when a token is set. |
| **Payments — generic checkout** (wallet top-up) | **Still fake, by design** | Hard-blocked on n1co, the current, in-progress architecture work. |
| **Payments — financing (N1CO Lending)** | Real | Separate from the above. |
| **Document storage** | Still fake | No cloud adapter exists yet. |
| **Notifications — WhatsApp/SMS** | Still fake | Blocked on an approved template. |

## Section 5 — What's still genuinely open

1. **Real card processing** — current focus.
2. **Cloud document storage** — local-disk only.

## Footer
1. **Not part of the open list**
`;

test('parseWorkflows reads screen counts and marks partial workflows in progress', () => {
  const w = parseWorkflows(README);
  assert.deepEqual(w.map((x) => [x.id, x.done, x.total, x.status]), [
    ['WF 01', 23, 23, 'built'],
    ['WF 02', 20, 31, 'in_progress'],
  ]);
  assert.equal(w[0].title, 'WF 01 Onboarding (Buy + Rent)');
});

test('adapterStatus maps real, conditional, in-progress, blocked and fake', () => {
  assert.equal(adapterStatus('Real'), 'built');
  assert.equal(adapterStatus('Upgraded'), 'built');
  assert.equal(adapterStatus('Conditionally real'), 'in_progress');
  assert.equal(adapterStatus('Still fake, by design', 'the current, in-progress work'), 'in_progress');
  assert.equal(adapterStatus('Still fake', 'Blocked on an approved template'), 'blocked');
  assert.equal(adapterStatus('Still fake', 'no cloud adapter yet'), 'not_started');
});

test('parseAdapters reads one unit per row and trims the title', () => {
  const a = parseAdapters(README);
  assert.deepEqual(a.map((x) => [x.id, x.title, x.status]), [
    ['A1', 'OTP', 'in_progress'],
    ['A2', 'Payments — generic checkout', 'in_progress'],
    ['A3', 'Payments — financing', 'built'],
    ['A4', 'Document storage', 'not_started'],
    ['A5', 'Notifications — WhatsApp/SMS', 'blocked'],
  ]);
});

test('parseOpen stops at the next heading', () => {
  assert.deepEqual(parseOpen(README), ['Real card processing', 'Cloud document storage']);
});

test('parseReadme returns nothing for an unrelated document', () => {
  assert.deepEqual(parseReadme('# Hello\n\nNothing here.'), { units: [], open: [] });
});

const live = (units) => ({
  source: { repo: 'o/r', branch: 'main', file: 'README.md', sha: 'abc1234def', date: '2026-11-20T10:00:00Z' },
  units,
  open: ['One'],
  recent: [{ short: 'abc1234', subject: 'x' }],
});

test('mergeApp replaces saved units with live ones linked to the README at that commit', () => {
  const data = { app: { owner: 'Shiva', note: 'saved', units: [{ id: 'old', title: 'Old', status: 'built' }] } };
  const out = mergeApp(data, live(parseReadme(README).units));
  assert.equal(out.app.owner, 'Shiva');
  assert.equal(out.app.units.length, 7);
  assert.equal(out.app.units[0].evidence, 'https://github.com/o/r/blob/abc1234def/README.md');
  assert.equal(out.app.units[0].updated_on, '2026-11-20');
  assert.ok(out.app.live);
  assert.deepEqual(out.app.open, ['One']);
});

test('mergeApp keeps the saved copy when the live read failed or is empty', () => {
  const data = { app: { units: [{ id: 'a' }] } };
  assert.equal(mergeApp(data, null), data);
  assert.equal(mergeApp(data, { error: 'x' }), data);
  assert.equal(mergeApp(data, live([])), data);
});

test('computeApp counts units and screens, and built without evidence shows as in progress', () => {
  const a = computeApp({
    units: [
      { id: 'WF 01', title: 'a', kind: 'workflow', status: 'built', evidence: 'https://x.test/1', done: 23, total: 23 },
      { id: 'A1', title: 'b', kind: 'adapter', status: 'built' },
      { id: 'A2', title: 'c', kind: 'adapter', status: 'blocked' },
      { id: 'A3', title: 'd', kind: 'adapter', status: 'not_started' },
    ],
  });
  assert.equal(a.totals.total, 4);
  assert.equal(a.totals.built, 1);
  assert.equal(a.totals.inProgress, 1);
  assert.equal(a.totals.blocked, 1);
  assert.equal(a.totals.pct, 25);
  assert.equal(a.totals.screensDone, 23);
});

test('computeApp copes with no app section', () => {
  const a = computeApp(undefined);
  assert.equal(a.totals.total, 0);
  assert.equal(a.totals.pct, 0);
});

test('computeCombined adds both people together', () => {
  const c = computeCombined(
    { name: 'Kunal', title: 'Admin console', built: 10, inProgress: 2, total: 16, unit: 'milestones' },
    { owner: 'Shiva', title: 'Rider app', units: [
      { id: 'a', title: 'a', status: 'built', evidence: 'https://x.test/1' },
      { id: 'b', title: 'b', status: 'not_started' },
    ] }
  );
  assert.equal(c.built, 11);
  assert.equal(c.total, 18);
  assert.equal(c.pct, 61);
  assert.deepEqual(c.parts.map((p) => [p.name, p.pct]), [['Kunal', 63], ['Shiva', 50]]);
});

test('compute exposes app and combined, and validate checks app units', () => {
  const data = {
    items: [],
    milestones: [{ id: 'M1', title: 'x', status: 'built', evidence: 'https://x.test/m' }],
    app: { units: [{ id: 'A1', title: 'a', status: 'built', evidence: 'https://x.test/1' }] },
  };
  const v = compute(data);
  assert.equal(v.app.totals.built, 1);
  assert.equal(v.combined.total, 2);
  assert.equal(v.combined.pct, 100);
  assert.deepEqual(validate(data).errors, []);
  const bad = validate({ ...data, app: { units: [{ id: 'A1', title: '', status: 'nope' }, { id: 'A1', title: 'x', status: 'built' }] } });
  assert.ok(bad.errors.some((e) => /status "nope"/.test(e)));
  assert.ok(bad.errors.some((e) => /duplicate unit id A1/.test(e)));
  assert.ok(bad.errors.some((e) => /missing title/.test(e)));
});

test('recentCommits keeps the newest few with their subject line', () => {
  const rows = recentCommits([
    { sha: '1234567890', html_url: 'u', commit: { message: 'feat: one\n\nbody', author: { date: '2026-11-20T00:00:00Z' } } },
    { sha: 'abcdef0123', html_url: 'v', commit: { message: 'fix: two', author: { date: '2026-11-19T00:00:00Z' } } },
  ], 1);
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].short, rows[0].subject, rows[0].url], ['1234567', 'feat: one', 'u']);
});

import { tokenFor } from '../api/commits.js';

test('tokenFor sends Shiva\'s repos to WIGOAPP_TOKEN and everything else to GITHUB_TOKEN', () => {
  const env = { GITHUB_TOKEN: 'k', WIGOAPP_TOKEN: 's' };
  assert.equal(tokenFor('Shivadevdayone/WIGOAPP', env), 's');
  assert.equal(tokenFor('kunalachintya-dayone/wigo-admin', env), 'k');
  assert.equal(tokenFor('Shivadevdayone/WIGOAPP', { GITHUB_TOKEN: 'k' }), undefined);
});

test('commits from every branch merge newest first, shared history stays on main', async () => {
  const { mergeBranchCommits, recentCommits } = await import('../lib/app.js');
  const c = (sha, date) => ({ sha, html_url: `https://x/${sha}`, commit: { message: sha, author: { date }, committer: { date } } });
  const merged = mergeBranchCommits([
    { branch: 'main', commits: [c('a1', '2026-11-23T07:00:00Z'), c('a0', '2026-11-20T07:00:00Z')] },
    { branch: 'feature/x', commits: [c('b1', '2026-11-24T09:00:00Z'), c('a1', '2026-11-23T07:00:00Z')] },
  ]);
  assert.deepEqual(merged.map((m) => [m.sha, m.branch]), [['b1', 'feature/x'], ['a1', 'main'], ['a0', 'main']]);
  assert.equal(recentCommits(merged)[0].branch, 'feature/x');
});
