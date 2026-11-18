import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compute, effective, validate, daysWaiting, isOverdue, parseDate, computeAsk, computeTeam, computeTesting, computeWaitlist, computePartners } from '../lib/compute.js';
import { tally, lastDays, parseRepo, personFor, weeklyReleases, weekly } from '../api/commits.js';

const NOW = parseDate('2026-11-18');
const base = (o) => ({ id: 'O1', title: 't', type: 'ours', owner: 'Kunal', milestone: 'M1', status: 'built', evidence: 'https://github.com/a/b/commit/abc1234', ...o });

test('built with evidence stays built', () => {
  assert.equal(effective(base()).status, 'built');
});

test('built without an evidence link shows as in progress', () => {
  const e = effective(base({ evidence: '' }));
  assert.equal(e.status, 'in_progress');
  assert.equal(e.declared_status, 'built');
  assert.ok(e.flags.includes('no_evidence'));
  assert.equal(effective(base({ evidence: 'see slack' })).status, 'in_progress');
});

test('placeholder work is never built', () => {
  const e = effective(base({ placeholder: true }));
  assert.equal(e.status, 'in_progress');
  assert.ok(e.flags.includes('placeholder'));
});

test('share is built divided by all ours items, never typed', () => {
  const data = {
    meta: { share: 99 },
    milestones: [{ id: 'M1', title: 'm', status: 'built', evidence: 'https://x.y/1' }],
    items: [
      base({ id: 'O1' }),
      base({ id: 'O2', evidence: null }),
      base({ id: 'O3', status: 'not_started', evidence: null }),
      base({ id: 'O4', status: 'blocked', evidence: null }),
      { id: 'X1', title: 'x', type: 'external', owner: 'n1co', status: 'blocked', asked_on: '2026-11-01' },
      { id: 'X2', title: 'y', type: 'external', owner: 'Meta', status: 'built', evidence: 'https://x.y/2' },
    ],
  };
  const t = compute(data, NOW).totals;
  assert.equal(t.ours, 4);
  assert.equal(t.built, 1);
  assert.equal(t.sharePct, 25);
  assert.equal(t.inProgress, 1);
  assert.equal(t.stillOurs, 3);
  assert.equal(t.blockedOnOthers, 1);
});

test('overdue only for ours items past due and not built', () => {
  assert.equal(isOverdue(effective(base({ status: 'in_progress', due: '2026-11-17' })), NOW), true);
  assert.equal(isOverdue(effective(base({ status: 'in_progress', due: '2026-11-18' })), NOW), false);
  assert.equal(isOverdue(effective(base({ due: '2026-11-01' })), NOW), false);
});

test('days waiting is calculated from asked_on', () => {
  assert.equal(daysWaiting({ asked_on: '2026-10-12' }, NOW), 37);
  assert.equal(daysWaiting({}, NOW), null);
});

test('next dated milestone is the earliest open one with a due date', () => {
  const v = compute({
    milestones: [
      { id: 'M1', title: 'a', status: 'built', evidence: 'https://x/1', due: '2026-11-01' },
      { id: 'M2', title: 'b', status: 'in_progress', due: '2026-11-25' },
      { id: 'M3', title: 'c', status: 'not_started', due: '2026-11-20' },
      { id: 'M4', title: 'd', status: 'not_started' },
    ],
    items: [],
  }, NOW);
  assert.equal(v.nextMilestone.id, 'M3');
  assert.equal(v.nextMilestone.days_to_due, 2);
});

test('validate catches bad data', () => {
  const { errors } = validate({
    milestones: [{ id: 'M1', title: 'm', status: 'done' }],
    items: [
      base({ id: 'O1', owner: 'Bob' }),
      base({ id: 'O1' }),
      base({ id: 'X9', type: 'ours' }),
      base({ id: 'O5', milestone: 'M99', due: '18/11/2026' }),
    ],
  });
  const text = errors.join('\n');
  assert.match(text, /M1: status "done"/);
  assert.match(text, /owner "Bob"/);
  assert.match(text, /duplicate id O1/);
  assert.match(text, /O ids are ours/);
  assert.match(text, /milestone "M99"/);
  assert.match(text, /not a YYYY-MM-DD date/);
});

test('seed data.json is valid and matches the register counts', () => {
  const data = JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8'));
  assert.deepEqual(validate(data).errors, []);
  const t = compute(data, NOW).totals;
  assert.equal(t.milestonesTotal, 16);
  assert.equal(data.items.filter((i) => i.type === 'ours').length, 29);
  assert.equal(data.items.filter((i) => i.type === 'external').length, 14);
  for (const i of data.items) if (i.status === 'built') assert.match(i.evidence, /^https:\/\//, `${i.id} needs evidence`);
});

test('commit tally groups by person and India day, dedupes by sha', () => {
  const days = lastDays(new Date('2026-11-18T10:00:00Z'));
  assert.equal(days.length, 7);
  assert.equal(days[6], '2026-11-18');
  const mk = (sha, login, date) => ({ sha, author: { login }, commit: { author: { name: login, date } } });
  const out = tally(
    [
      mk('a', 'latent-0', '2026-11-18T05:00:00Z'),
      mk('a', 'latent-0', '2026-11-18T05:00:00Z'),
      mk('b', 'latent-0', '2026-11-17T20:00:00Z'), // 01:30 on the 18th in India
      mk('c', 'shiva-x', '2026-11-16T08:00:00Z'),
      mk('d', 'shiva-x', '2026-10-01T08:00:00Z'), // outside the window
    ],
    { 'latent-0': 'Kunal' },
    days
  );
  const kunal = out.people.find((p) => p.name === 'Kunal');
  assert.equal(kunal.counts[6], 2);
  assert.equal(out.people.find((p) => p.name === 'shiva-x').counts[4], 1);
});

test('repo specs and author mapping', () => {
  assert.deepEqual(parseRepo('latent-0/wigo-admin@admin-design'), { repo: 'latent-0/wigo-admin', branch: 'admin-design' });
  assert.equal(parseRepo('not a repo'), null);
  assert.equal(personFor({ author: { login: 'LATENT-0' } }, { 'latent-0': 'Kunal' }), 'Kunal');
});

test('partner asks: days waiting until received, then time to arrive', () => {
  const waiting = computeAsk({ title: 'Sandbox', asked_on: '2026-10-12' }, NOW);
  assert.equal(waiting.received, false);
  assert.equal(waiting.days_waiting, 37);
  const got = computeAsk({ title: 'Docs', asked_on: '2026-10-12', received_on: '2026-10-20' }, NOW);
  assert.equal(got.received, true);
  assert.equal(got.days_waiting, null);
  assert.equal(got.days_to_receive, 8);
  const p = computePartners([{ id: 'n1co', asks: [{ title: 'a', asked_on: '2026-10-12' }, { title: 'b', asked_on: '2026-11-01', received_on: '2026-11-02' }], tracks: [{ title: 't', status: 'built' }] }], [], NOW).n1co;
  assert.equal(p.waiting, 1);
  assert.equal(p.received, 1);
  assert.equal(p.longest, 37);
  assert.equal(p.tracks[0].status, 'in_progress', 'built track without evidence is not built');
});

test('team task and status come from the tracker', () => {
  const items = [
    effective(base({ id: 'O1', owner: 'Kunal' })),
    effective(base({ id: 'O2', owner: 'Kunal', status: 'not_started', evidence: null })),
    effective(base({ id: 'O3', owner: 'Kunal', status: 'in_progress', evidence: null })),
  ];
  const [kunal, sneha] = computeTeam(
    [{ name: 'Kunal', update: 'Shipped O1', updated_on: '2026-11-18' }, { name: 'Sneha', update: 'x', updated_on: '2026-11-16' }],
    items,
    NOW
  );
  assert.equal(kunal.task.id, 'O3', 'in progress beats not started');
  assert.equal(kunal.items_open, 2);
  assert.equal(kunal.update_today, true);
  assert.equal(sneha.task, null);
  assert.equal(sneha.update_today, false);
  assert.equal(sneha.update_age, 2);
  const [withFocus] = computeTeam([{ name: 'Kunal', focus: 'O2' }], items, NOW);
  assert.equal(withFocus.task.id, 'O2');
});

test('testing totals are summed and clamped', () => {
  const t = computeTesting({
    suites: [
      { area: 'Auth', written: 10, executed: 8, passed: 7 },
      { area: 'Pay', written: 5, executed: 9, passed: 12 },
    ],
    bugs: [
      { id: 'B1', status: 'open', severity: 'low', opened_on: '2026-11-10' },
      { id: 'B2', status: 'open', severity: 'critical', opened_on: '2026-11-17' },
      { id: 'B3', status: 'closed', severity: 'high' },
    ],
  }, NOW);
  assert.deepEqual([t.totals.written, t.totals.executed, t.totals.passed, t.totals.failed], [15, 13, 12, 1]);
  assert.equal(t.totals.bugsOpen, 2);
  assert.equal(t.totals.bugsCritical, 1);
  assert.equal(t.openBugs[0].id, 'B2', 'critical first');
  assert.equal(t.openBugs[1].age, 8);
});

test('waitlist change is against the previous day', () => {
  const w = computeWaitlist({ days: [
    { date: '2026-11-18', size: 120, converted: 30 },
    { date: '2026-11-17', size: 100, converted: 20 },
  ] });
  assert.equal(w.latest.date, '2026-11-18');
  assert.equal(w.latest.size_change, 20);
  assert.equal(w.latest.converted_change, 10);
  assert.equal(w.latest.rate_change_pts, 5);
  assert.equal(w.days[0].size_change, null);
  assert.equal(computeWaitlist(undefined).latest, null);
});

test('dependencies split into Eric and third parties', () => {
  const v = compute({ milestones: [], items: [
    { id: 'X1', title: 'a', type: 'external', owner: 'Eric', status: 'blocked', asked_on: '2026-10-19' },
    { id: 'X2', title: 'b', type: 'external', owner: 'n1co', status: 'blocked', asked_on: '2026-10-12' },
    { id: 'X3', title: 'c', type: 'external', owner: 'Meta', status: 'blocked', asked_on: '2026-11-15' },
  ] }, NOW);
  const [eric, third] = v.dependencies;
  assert.equal(eric.count, 1);
  assert.equal(eric.longest, 30);
  assert.equal(third.count, 2);
  assert.equal(third.longest, 37);
  assert.equal(third.over14, 1);
  assert.equal(v.tracker.length, 3);
});

test('validate checks the new sections', () => {
  const { errors } = validate({
    milestones: [],
    items: [],
    team: [{ name: 'Bob' }, { name: 'Kunal', focus: 'O99' }],
    partners: [{ id: 'n1co', items: ['X99'], asks: [{ title: 'a', asked_on: '2026-11-10', received_on: '2026-11-01' }], tracks: [{ title: 't', status: 'done' }] }],
    testing: { suites: [{ area: 'A', written: 2, executed: 3, passed: 1 }], bugs: [{ id: 'B1', status: 'gone' }] },
    waitlist: { days: [{ date: '2026-11-18', size: 5, converted: 9 }] },
  });
  const text = errors.join('\n');
  for (const re of [/"Bob"/, /O99/, /X99/, /received before/, /status "done"/, /executed is more/, /bug B1/, /more than the waitlist/]) assert.match(text, re);
});

test('weekly releases and per-person totals', () => {
  const days = lastDays(new Date('2026-11-18T10:00:00Z'));
  const rel = weeklyReleases([
    { id: 1, repo: 'a/b', tag_name: 'v1', html_url: 'https://x/1', published_at: '2026-11-17T10:00:00Z', author: { login: 'latent-0' } },
    { id: 2, repo: 'a/b', tag_name: 'v0', html_url: 'https://x/0', published_at: '2026-10-01T10:00:00Z', author: { login: 'latent-0' } },
    { id: 3, repo: 'a/b', tag_name: 'd', draft: true, published_at: null, author: { login: 'latent-0' } },
  ], { 'latent-0': 'Kunal' }, days);
  assert.equal(rel.length, 1);
  assert.equal(rel[0].person, 'Kunal');
  const w = weekly([{ name: 'Kunal', counts: [1, 0, 0, 0, 0, 0, 2] }], [...rel, { person: 'Shiva' }]);
  assert.deepEqual(w.find((x) => x.name === 'Kunal'), { name: 'Kunal', commits: 3, releases: 1 });
  assert.equal(w.find((x) => x.name === 'Shiva').releases, 1);
});
