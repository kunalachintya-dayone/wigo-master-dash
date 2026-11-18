// All numbers on the dashboard come from here. Nothing is typed by hand.
// Shared by the browser (app.js) and Node (scripts/check-data.mjs, tests).

export const STATUSES = ['built', 'in_progress', 'not_started', 'blocked'];
export const TYPES = ['ours', 'external'];
export const OWNERS = ['Shiva', 'Kunal', 'Kim', 'n1co', 'Meta', 'Hexup', 'Eric'];

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

  return {
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
      milestonesBuilt: count(milestones, 'built'),
      milestonesTotal: milestones.length,
    },
    lastUpdated,
    nextMilestone,
    milestones: milestoneRows,
    ours: ourRows,
    blocked: blockedRows,
    flagged: [...items, ...milestones].filter((i) => i.flags.length),
  };
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

  return { errors, warnings };
}
