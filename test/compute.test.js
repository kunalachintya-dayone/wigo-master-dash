import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compute, effective, validate, daysWaiting, isOverdue, parseDate } from '../lib/compute.js';
import { tally, lastDays, parseRepo, personFor } from '../api/commits.js';

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
