// All numbers on the dashboard come from here. Nothing is typed by hand.
// Shared by the browser (app.js) and Node (scripts/check-data.mjs, tests).

export const STATUSES = ['built', 'in_progress', 'not_started', 'blocked'];
export const TYPES = ['ours', 'external'];
export const OWNERS = ['Shiva', 'Kunal', 'Sneha', 'Ajay', 'Kim', 'n1co', 'Meta', 'Hexup', 'Eric'];
export const TEAM = ['Shiva', 'Kunal', 'Sneha', 'Ajay'];
export const BUG_STATUSES = ['open', 'closed'];
export const SEVERITIES = ['critical', 'high', 'medium', 'low'];

export const STATUS_LABEL = {
  built: 'Built',
  in_progress: 'In progress',
  not_started: 'Not started',
  blocked: 'Blocked',
  placeholder: 'Placeholder',
};

const DAY_MS = 86400000;

/** Parse "YYYY-MM-DD" (or an ISO timestamp) into a UTC calendar date. */
export function parseDate(value) {
  if (!value || typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Today's calendar date as a UTC date, from the viewer's local clock. */
export function today(now = new Date()) {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function daysBetween(from, to) {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

export function isLink(value) {
  return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value.trim());
}

/**
 * Apply the rules to one item or milestone:
 *  - built without an evidence link shows as in progress
 *  - placeholder work is never built
 * Returns a copy with `status` (what the page shows), `declared_status`
 * (what data.json says) and `flags`.
 */
export function effective(item) {
  const flags = [];
  let status = item.status;
  if (!STATUSES.includes(status)) {
    flags.push('unknown_status');
    status = 'not_started';
  }
  if (item.placeholder) {
    flags.push('placeholder');
    if (status === 'built') status = 'in_progress';
  }
  if (status === 'built' && !isLink(item.evidence)) {
    flags.push('no_evidence');
    status = 'in_progress';
  }
  return { ...item, declared_status: item.status, status, flags };
}

/** Label shown in the status chip. Placeholder work is always labelled placeholder. */
export function displayStatus(eff) {
  return eff.flags.includes('placeholder') ? 'placeholder' : eff.status;
}

export function isOverdue(eff, now = today()) {
  if (eff.status === 'built') return false;
  const due = parseDate(eff.due);
  return !!due && due < now;
}

export function daysWaiting(eff, now = today()) {
  const asked = parseDate(eff.asked_on);
  if (!asked) return null;
  return Math.max(0, daysBetween(asked, now));
}

/** Everything the page renders, computed from the raw data file. */
export function compute(data, now = today()) {
  const items = (data.items || []).map(effective);
  const milestones = (data.milestones || []).map(effective);

  const ours = items.filter((i) => i.type === 'ours');
  const external = items.filter((i) => i.type === 'external');

  const count = (list, status) => list.filter((i) => i.status === status).length;
  const built = count(ours, 'built');
  const inProgress = count(ours, 'in_progress');
  const stillOurs = ours.length - built;
  const openExternal = external.filter((i) => i.status !== 'built');

  const share = ours.length ? built / ours.length : 0;

  // Overall progress of the admin console (web dashboard): milestones built out of all milestones.
  // A milestone counts only when it is built with evidence; in progress is shown beside it, not counted.
  const msBuilt = count(milestones, 'built');
  const overallShare = milestones.length ? msBuilt / milestones.length : 0;

  // Next dated milestone: the earliest due date among milestones not built.
  const dated = milestones
    .filter((m) => m.status !== 'built' && parseDate(m.due))
    .sort((a, b) => parseDate(a.due) - parseDate(b.due));
  const next = dated[0] || null;
  const nextMilestone = next
    ? { ...next, days_to_due: daysBetween(now, parseDate(next.due)) }
    : null;

  // Last updated: meta.updated_at if present, else the newest updated_on.
  const stamps = [...items, ...milestones].map((i) => i.updated_on).filter(Boolean).sort();
  const lastUpdated = (data.meta && data.meta.updated_at) || stamps[stamps.length - 1] || null;

  const ourRows = ours.map((i) => ({ ...i, overdue: isOverdue(i, now) }));
  const blockedRows = openExternal
    .map((i) => ({ ...i, days_waiting: daysWaiting(i, now) }))
    .sort((a, b) => (b.days_waiting ?? -1) - (a.days_waiting ?? -1));

  const milestoneRows = milestones.map((m) => {
    const linked = items.filter((i) => i.milestone === m.id);
    return {
      ...m,
      items_total: linked.length,
      items_built: linked.filter((i) => i.status === 'built').length,
    };
  });

  const trackerRows = items.map((i) => ({
    ...i,
    overdue: isOverdue(i, now),
    days_waiting: i.type === 'external' && i.status !== 'built' ? daysWaiting(i, now) : null,
  }));

  return {
    tracker: trackerRows,
    dependencies: dependencyGroups(blockedRows),
    partners: computePartners(data.partners, items, now),
    team: computeTeam(data.team, items, now),
    testing: computeTesting(data.testing, now),
    waitlist: computeWaitlist(data.waitlist),
    totals: {
      ours: ours.length,
      external: external.length,
      built,
      inProgress,
      notStarted: count(ours, 'not_started'),
      blockedOurs: count(ours, 'blocked'),
      stillOurs,
      blockedOnOthers: openExternal.length,
      share,
      sharePct: Math.round(share * 100),
      overdue: ourRows.filter((r) => r.overdue).length,
      milestonesBuilt: msBuilt,
      milestonesTotal: milestones.length,
      milestonesInProgress: count(milestones, 'in_progress'),
      overallShare,
      overallPct: Math.round(overallShare * 100),
    },
    lastUpdated,
    nextMilestone,
    milestones: milestoneRows,
    ours: ourRows,
    blocked: blockedRows,
    flagged: [...items, ...milestones].filter((i) => i.flags.length),
  };
}

/* ---------- Dependencies ---------- */

/** Group open external items into "Waiting on Eric" and "Waiting on third parties". */
export function dependencyGroups(blockedRows) {
  const groups = [
    { key: 'eric', label: 'Waiting on Eric', rows: blockedRows.filter((r) => r.owner === 'Eric') },
    { key: 'third', label: 'Waiting on third parties', rows: blockedRows.filter((r) => r.owner !== 'Eric') },
  ];
  return groups.map((g) => ({
    ...g,
    count: g.rows.length,
    longest: g.rows.reduce((m, r) => Math.max(m, r.days_waiting ?? 0), 0),
    over14: g.rows.filter((r) => (r.days_waiting ?? 0) >= 14).length,
  }));
}

/* ---------- Partners: n1co, Hexup, Meta, designs ---------- */

/** One thing we asked a partner for. Received when received_on is set; days waiting are calculated. */
export function computeAsk(ask, now = today()) {
  const asked = parseDate(ask.asked_on);
  const received = parseDate(ask.received_on);
  const end = received || now;
  const days = asked ? Math.max(0, daysBetween(asked, end)) : null;
  return { ...ask, received: !!received, days_waiting: received ? null : days, days_to_receive: received ? days : null };
}

export function computePartners(partners, items = [], now = today()) {
  const out = {};
  for (const p of Array.isArray(partners) ? partners : []) {
    if (!p || !p.id) continue;
    const asks = (p.asks || []).map((a) => computeAsk(a, now));
    const tracks = (p.tracks || []).map(effective);
    const linked = items.filter((i) => (p.items || []).includes(i.id));
    const waiting = asks.filter((a) => !a.received);
    out[p.id] = {
      ...p,
      asks,
      tracks,
      linked,
      received: asks.length - waiting.length,
      waiting: waiting.length,
      longest: waiting.reduce((m, a) => Math.max(m, a.days_waiting ?? 0), 0),
    };
  }
  return out;
}

/* ---------- Team ---------- */

const STATUS_RANK = { blocked: 0, in_progress: 1, not_started: 2, built: 3 };

/**
 * Owner, task and status for each person come from the tracker:
 * the task is the person's `focus` item if set, else their most active open item.
 * Only the daily update text is typed.
 */
export function computeTeam(team, items = [], now = today()) {
  return (Array.isArray(team) ? team : []).map((m) => {
    const mine = items.filter((i) => i.owner === m.name);
    const open = mine.filter((i) => i.status !== 'built');
    const focus = (m.focus && items.find((i) => i.id === m.focus)) ||
      [...open].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])[0] || null;
    const updated = parseDate(m.updated_on);
    const updateAge = updated ? daysBetween(updated, now) : null;
    return {
      ...m,
      items_total: mine.length,
      items_built: mine.length - open.length,
      items_open: open.length,
      items_blocked: open.filter((i) => i.status === 'blocked').length,
      task: focus,
      update_age: updateAge,
      update_today: updateAge === 0 && !!m.update,
    };
  });
}

/* ---------- Testing ---------- */

const n = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

export function computeTesting(testing, now = today()) {
  const suites = (testing && Array.isArray(testing.suites) ? testing.suites : []).map((s) => {
    const written = n(s.written);
    const executed = Math.min(n(s.executed), written);
    const passed = Math.min(n(s.passed), executed);
    return { ...s, written, executed, passed, failed: executed - passed, not_run: written - executed };
  });
  const sum = (k) => suites.reduce((t, s) => t + s[k], 0);
  const bugs = (testing && Array.isArray(testing.bugs) ? testing.bugs : []).map((b) => {
    const opened = parseDate(b.opened_on);
    const open = b.status !== 'closed';
    return { ...b, open, age: open && opened ? Math.max(0, daysBetween(opened, now)) : null };
  });
  const sevRank = (s) => { const i = SEVERITIES.indexOf(s); return i === -1 ? SEVERITIES.length : i; };
  const openBugs = bugs.filter((b) => b.open).sort((a, b) => sevRank(a.severity) - sevRank(b.severity) || (b.age ?? 0) - (a.age ?? 0));
  const written = sum('written');
  const executed = sum('executed');
  const passed = sum('passed');
  return {
    note: (testing && testing.note) || null,
    suites,
    bugs,
    openBugs,
    totals: {
      written,
      executed,
      passed,
      failed: executed - passed,
      notRun: written - executed,
      executedPct: written ? Math.round((executed / written) * 100) : 0,
      passPct: executed ? Math.round((passed / executed) * 100) : 0,
      bugsOpen: openBugs.length,
      bugsClosed: bugs.length - openBugs.length,
      bugsCritical: openBugs.filter((b) => b.severity === 'critical' || b.severity === 'high').length,
    },
  };
}

/* ---------- Waitlist and conversion ---------- */

/** Daily snapshots of waitlist size and riders converted. Change is calculated against the previous snapshot. */
export function computeWaitlist(waitlist) {
  const days = (waitlist && Array.isArray(waitlist.days) ? waitlist.days : [])
    .filter((d) => parseDate(d.date) && Number.isFinite(d.size))
    .sort((a, b) => parseDate(a.date) - parseDate(b.date))
    .map((d) => {
      const size = n(d.size);
      const converted = Math.min(n(d.converted), size);
      return { date: d.date, size, converted, rate: size ? converted / size : 0 };
    });
  const rows = days.map((d, i) => {
    const prev = days[i - 1];
    return {
      ...d,
      size_change: prev ? d.size - prev.size : null,
      converted_change: prev ? d.converted - prev.converted : null,
      rate_change_pts: prev ? Math.round((d.rate - prev.rate) * 1000) / 10 : null,
    };
  });
  return { ...(waitlist || {}), days: rows, latest: rows[rows.length - 1] || null };
}

/** Validate the data file. Returns { errors, warnings }. */
export function validate(data) {
  const errors = [];
  const warnings = [];
  if (!data || typeof data !== 'object') return { errors: ['data.json is not an object'], warnings };
  if (!Array.isArray(data.items)) errors.push('"items" must be an array');
  if (!Array.isArray(data.milestones)) errors.push('"milestones" must be an array');
  if (errors.length) return { errors, warnings };

  const ids = new Set();
  const milestoneIds = new Set();

  const checkDate = (rec, field) => {
    if (rec[field] != null && rec[field] !== '' && !parseDate(rec[field])) {
      errors.push(`${rec.id}: ${field} "${rec[field]}" is not a YYYY-MM-DD date`);
    }
  };

  for (const m of data.milestones) {
    if (!/^M\d+$/.test(m.id || '')) errors.push(`milestone id "${m.id}" must look like M1..M16`);
    if (ids.has(m.id)) errors.push(`duplicate id ${m.id}`);
    ids.add(m.id);
    milestoneIds.add(m.id);
    if (!m.title) errors.push(`${m.id}: missing title`);
    if (!STATUSES.includes(m.status)) errors.push(`${m.id}: status "${m.status}" must be one of ${STATUSES.join(', ')}`);
    if (m.status === 'built' && !isLink(m.evidence)) warnings.push(`${m.id}: marked built with no evidence link, shows as in progress`);
    ['due', 'updated_on'].forEach((f) => checkDate(m, f));
  }

  for (const i of data.items) {
    if (!/^[OX]\d+$/.test(i.id || '')) errors.push(`item id "${i.id}" must look like O7 or X3`);
    if (ids.has(i.id)) errors.push(`duplicate id ${i.id}`);
    ids.add(i.id);
    if (!i.title) errors.push(`${i.id}: missing title`);
    if (!TYPES.includes(i.type)) errors.push(`${i.id}: type "${i.type}" must be ours or external`);
    if (i.id && i.type && (i.id[0] === 'O') !== (i.type === 'ours')) {
      errors.push(`${i.id}: O ids are ours, X ids are external`);
    }
    if (!STATUSES.includes(i.status)) errors.push(`${i.id}: status "${i.status}" must be one of ${STATUSES.join(', ')}`);
    if (!OWNERS.includes(i.owner)) errors.push(`${i.id}: owner "${i.owner}" must be one of ${OWNERS.join(', ')}`);
    if (i.milestone && !milestoneIds.has(i.milestone)) errors.push(`${i.id}: milestone "${i.milestone}" does not exist`);
    if (!i.milestone) warnings.push(`${i.id}: no milestone`);
    ['asked_on', 'due', 'updated_on'].forEach((f) => checkDate(i, f));
    if (i.type === 'external') {
      if (!i.needs) warnings.push(`${i.id}: external item has no "needs"`);
      if (!i.asked_on) warnings.push(`${i.id}: external item has no asked_on, days waiting cannot be calculated`);
    }
    if (i.status === 'built' && !isLink(i.evidence)) warnings.push(`${i.id}: marked built with no evidence link, shows as in progress`);
    if (i.placeholder && i.status === 'built') warnings.push(`${i.id}: placeholder work marked built, shows as placeholder`);
    if (i.evidence && !isLink(i.evidence)) warnings.push(`${i.id}: evidence "${i.evidence}" is not a link`);
  }

  if (data.team != null) {
    if (!Array.isArray(data.team)) errors.push('"team" must be an array');
    else for (const m of data.team) {
      if (!OWNERS.includes(m.name)) errors.push(`team: "${m.name}" must be one of ${OWNERS.join(', ')}`);
      if (m.focus && !ids.has(m.focus)) errors.push(`team ${m.name}: focus "${m.focus}" is not an item id`);
      checkDate({ id: `team ${m.name}`, ...m }, 'updated_on');
    }
  }

  if (data.partners != null) {
    if (!Array.isArray(data.partners)) errors.push('"partners" must be an array');
    else for (const p of data.partners) {
      if (!p.id) errors.push('partner without an id');
      for (const ref of p.items || []) if (!ids.has(ref)) errors.push(`partner ${p.id}: item "${ref}" does not exist`);
      for (const a of p.asks || []) {
        const rec = { id: `${p.id} ask "${a.title}"`, ...a };
        if (!a.title) errors.push(`partner ${p.id}: ask without a title`);
        ['asked_on', 'received_on'].forEach((f) => checkDate(rec, f));
        if (!a.asked_on) warnings.push(`${rec.id}: no asked_on, days waiting cannot be calculated`);
        if (a.received_on && a.asked_on && parseDate(a.received_on) < parseDate(a.asked_on)) errors.push(`${rec.id}: received before it was asked`);
      }
      for (const t of p.tracks || []) {
        if (!STATUSES.includes(t.status)) errors.push(`partner ${p.id} "${t.title}": status "${t.status}" must be one of ${STATUSES.join(', ')}`);
        if (t.status === 'built' && !isLink(t.evidence)) warnings.push(`partner ${p.id} "${t.title}": marked built with no evidence link, shows as in progress`);
      }
    }
  }

  if (data.testing != null) {
    const suites = data.testing.suites || [];
    const bugs = data.testing.bugs || [];
    for (const s of suites) {
      const label = `test suite "${s.area}"`;
      for (const f of ['written', 'executed', 'passed']) {
        if (!Number.isInteger(s[f]) || s[f] < 0) errors.push(`${label}: ${f} must be a whole number`);
      }
      if (s.executed > s.written) errors.push(`${label}: executed is more than written`);
      if (s.passed > s.executed) errors.push(`${label}: passed is more than executed`);
      if (s.evidence && !isLink(s.evidence)) warnings.push(`${label}: evidence is not a link`);
    }
    const bugIds = new Set();
    for (const b of bugs) {
      if (!b.id) errors.push('bug without an id');
      if (bugIds.has(b.id)) errors.push(`duplicate bug id ${b.id}`);
      bugIds.add(b.id);
      if (!BUG_STATUSES.includes(b.status)) errors.push(`bug ${b.id}: status "${b.status}" must be open or closed`);
      if (b.severity && !SEVERITIES.includes(b.severity)) errors.push(`bug ${b.id}: severity "${b.severity}" must be one of ${SEVERITIES.join(', ')}`);
      ['opened_on', 'closed_on'].forEach((f) => checkDate(b, f));
    }
  }

  if (data.waitlist != null) {
    const seen = new Set();
    for (const d of data.waitlist.days || []) {
      if (!parseDate(d.date)) errors.push(`waitlist: date "${d.date}" is not a YYYY-MM-DD date`);
      if (seen.has(d.date)) errors.push(`waitlist: ${d.date} appears twice`);
      seen.add(d.date);
      if (!Number.isInteger(d.size) || d.size < 0) errors.push(`waitlist ${d.date}: size must be a whole number`);
      if (d.converted != null && (!Number.isInteger(d.converted) || d.converted < 0)) errors.push(`waitlist ${d.date}: converted must be a whole number`);
      if (d.converted > d.size) errors.push(`waitlist ${d.date}: converted is more than the waitlist size`);
    }
  }

  return { errors, warnings };
}
