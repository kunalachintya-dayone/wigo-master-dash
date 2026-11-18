import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownTables, milestoneStatus, parseMilestones, parseFollowups, closingCommits, mergeRegister } from '../lib/register.js';
import { validate } from '../lib/compute.js';

const MILESTONES_MD = `
# Admin console

| # | Milestone | Design files | Status |
|---|---|---|---|
| M1 | Design system and shell: tokens, General Sans | Dashboard | Done |
| M2 | Auth: credentials plus mandatory 2FA | Auth | Mostly done: sign-in, code. Open: A-25 |
| M3 | Hub: analytics home | Dashboard | Done for the data we hold. El Salvador localization |
| M4 | Fleet Accounts | Fleet | Console side done; the Fleet Portal is not built. |
| M5 | Handoff modules | none supplied | Blocked on designs |
| M6 | Closing sweep | none | Planned |

## Tracked gaps

| # | Gap | Raised in | Blocked on | Lands in |
|---|---|---|---|---|
| G1 | n1co sync | M4 | n1co | M9 |
`;

const FOLLOWUPS_MD = `
## Part 1. Our side

| # | Work | Gaps | Lands in | Notes |
|---|---|---|---|---|
| O1 | Field and depot app (PWA): runner and depot screens | G29, G35 | Built in M3 | The console side exists. |
| O2 | Heartbeat and telemetry receivers: authenticated endpoints | G17 | M5 | Hardware sending is X8. |
| O3 | Rider 360 completion: risk band | G5 | M6 | |

## Part 2. Out of our hands

| # | Dependency | Who | What we need | Unblocks | Ready on our side |
|---|---|---|---|---|---|
| X1 | **n1co** (lender and payment rail) | n1co, via the owner's contract | API access and credentials | G1, G11 | A payments port with a fake adapter. |
| X2 | **Map tile provider** | The owner | A tile provider account and key | G60 | The map component. |
`;

test('markdown tables skip header and divider rows', () => {
  const tables = markdownTables(MILESTONES_MD);
  assert.equal(tables.length, 2);
  assert.deepEqual(tables[0].header, ['#', 'Milestone', 'Design files', 'Status']);
  assert.equal(tables[0].rows.length, 6);
  assert.equal(tables[0].rows[0][0], 'M1');
});

test('milestone status text maps to a dashboard status', () => {
  assert.equal(milestoneStatus('Done'), 'built');
  assert.equal(milestoneStatus('Done for the data we hold. Rider 360'), 'built');
  assert.equal(milestoneStatus('Mostly done: sign-in'), 'in_progress');
  assert.equal(milestoneStatus('Console side done; the Fleet Portal is not built.'), 'in_progress');
  assert.equal(milestoneStatus('Blocked on designs'), 'blocked');
  assert.equal(milestoneStatus('Planned'), 'not_started');
  assert.equal(milestoneStatus('something new'), 'not_started');
});

test('milestones parse with short titles and ignore the gaps table', () => {
  const ms = parseMilestones(MILESTONES_MD);
  assert.deepEqual(ms.map((m) => m.id), ['M1', 'M2', 'M3', 'M4', 'M5', 'M6']);
  assert.equal(ms[0].title, 'Design system and shell');
  assert.deepEqual(ms.map((m) => m.status), ['built', 'in_progress', 'built', 'in_progress', 'blocked', 'not_started']);
});

test('follow-ups parse into ours and external with built read from "Built in"', () => {
  const { ours, external } = parseFollowups(FOLLOWUPS_MD);
  assert.deepEqual(ours.map((o) => [o.id, o.status, o.milestone]), [
    ['O1', 'built', 'M3'],
    ['O2', 'not_started', 'M5'],
    ['O3', 'not_started', 'M6'],
  ]);
  assert.equal(ours[0].title, 'Field and depot app (PWA)');
  assert.equal(external[0].title, 'n1co (lender and payment rail)');
  assert.equal(external[0].holder, "n1co, via the owner's contract");
  assert.equal(external[1].needs, 'A tile provider account and key');
  assert.ok(external.every((x) => x.status === 'blocked'));
});

test('closing commits: newest record or close per milestone, progress commits ignored', () => {
  const commits = [
    { sha: 'c3', html_url: 'https://x/c3', commit: { message: 'Build pages; record milestone 3 and six tracked gaps' } },
    { sha: 'c2', html_url: 'https://x/c2', commit: { message: 'Close milestone 2: an outbox' } },
    { sha: 'c1', html_url: 'https://x/c1', commit: { message: 'record milestone 3 progress' } },
    { sha: 'c0', html_url: 'https://x/c0', commit: { message: 'record milestone 3 as done' } },
  ];
  const out = closingCommits(commits);
  assert.equal(out.M3.url, 'https://x/c3');
  assert.equal(out.M2.url, 'https://x/c2');
  assert.equal(out.M1, undefined);
});

const BASE = {
  meta: { register_as_of: '2026-11-16' },
  milestones: [
    { id: 'M1', title: 'Design system', status: 'built', evidence: 'https://x/m1' },
    { id: 'M2', title: 'Auth', status: 'in_progress', note: 'hand note' },
  ],
  items: [
    { id: 'O2', title: 'Telemetry', type: 'ours', status: 'in_progress', owner: 'Kunal', milestone: 'M5' },
    { id: 'X1', title: 'n1co', type: 'external', status: 'blocked', owner: 'n1co', holder: 'n1co (Wilber)', asked_on: '2026-10-12', milestone: 'M4' },
    { id: 'O99', title: 'Old item', type: 'ours', status: 'built', owner: 'Kunal', evidence: 'https://x/o99', milestone: 'M1' },
  ],
};

function liveFixture() {
  const { ours, external } = parseFollowups(FOLLOWUPS_MD);
  return {
    source: { repo: 'o/r', branch: 'b', sha: 'abc1234', short: 'abc1234', url: 'https://x/abc', date: '2026-11-18T10:00:00Z' },
    milestones: parseMilestones(MILESTONES_MD),
    ours,
    external,
    closing: closingCommits([{ sha: 'c3', html_url: 'https://x/c3', commit: { message: 'record milestone 3' } }]),
  };
}

test('merge: the register decides items and status, data.json keeps owners, dates and hand-written evidence', () => {
  const merged = mergeRegister(BASE, liveFixture());
  const ms = Object.fromEntries(merged.milestones.map((m) => [m.id, m]));
  assert.equal(merged.milestones.length, 6);
  assert.equal(ms.M1.title, 'Design system');
  assert.equal(ms.M1.evidence, 'https://x/m1');
  assert.equal(ms.M3.status, 'built');
  assert.equal(ms.M3.evidence, 'https://x/c3');
  assert.match(ms.M2.note, /^Mostly done/);

  const items = Object.fromEntries(merged.items.map((i) => [i.id, i]));
  assert.equal(items.O1.status, 'built');
  assert.equal(items.O1.evidence, 'https://x/c3', 'built item borrows its milestone closing commit');
  assert.equal(items.O1.owner, 'Kunal');
  assert.equal(items.O2.status, 'in_progress', 'a hand-set in_progress survives a not-built register row');
  assert.equal(items.X1.holder, 'n1co (Wilber)');
  assert.equal(items.X1.asked_on, '2026-10-12');
  assert.equal(items.X2.owner, 'Eric');
  assert.equal(items.O99.live, false, 'items the register dropped stay visible');
  assert.equal(merged.meta.register_as_of, '2026-11-18');
  assert.equal(validate(merged).errors.length, 0);
});

test('merge: no live register leaves data.json untouched', () => {
  assert.equal(mergeRegister(BASE, null), BASE);
  assert.equal(mergeRegister(BASE, { milestones: [] }), BASE);
});
