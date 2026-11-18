// Reads the live register in wigo-admin and merges it into data.json.
// Shared by the Vercel function (api/register.js), the browser (app.js) and the tests.
//
// What comes live from wigo-admin:
//   docs/ADMIN_MILESTONES.md          M1 to M16: title and status
//   docs/FOLLOWUPS_AND_DEPENDENCIES.md O items (ours) and X items (external): title, status, gaps, holder, needs
//   commit history on the branch      "record milestone N" / "close milestone N" commits as evidence
// What stays in data.json (the repo does not hold it): owners, ask dates, due dates, partner asks,
// team updates, testing, waitlist, and hand-written notes or evidence that override the live values.

/** Every markdown table in a document, as arrays of trimmed cell strings (header and divider rows dropped). */
export function markdownTables(md) {
  const tables = [];
  let current = null;
  for (const raw of String(md || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('|')) {
      current = null;
      continue;
    }
    const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    if (cells.every((c) => /^:?-{2,}:?$/.test(c) || c === '')) continue;
    if (!current) {
      current = { header: cells, rows: [] };
      tables.push(current);
      continue;
    }
    current.rows.push(cells);
  }
  return tables;
}

const plain = (s) => String(s || '').replace(/\*\*/g, '').replace(/`/g, '').trim();

/** Short title: the text before the first colon, or the first sentence, capped. */
export function shortTitle(text, max = 80) {
  const t = plain(text);
  const cut = t.split(/:\s|\.\s/)[0];
  return cut.length > max ? cut.slice(0, max - 1).trimEnd() + '…' : cut;
}

/** Map the milestone status text in ADMIN_MILESTONES.md to a dashboard status. */
export function milestoneStatus(text) {
  const t = plain(text).toLowerCase();
  if (t.startsWith('blocked')) return 'blocked';
  if (t.startsWith('planned') || t.startsWith('not started')) return 'not_started';
  if (/^(mostly done|console side done|partly|in progress)/.test(t) || /\bnot built\b/.test(t)) return 'in_progress';
  if (t.startsWith('done')) return 'built';
  return 'not_started';
}

function rowsWithId(tables, prefix) {
  const re = new RegExp(`^${prefix}\\d+$`);
  return tables.flatMap((t) => t.rows.map((r) => ({ header: t.header, r }))).filter(({ r }) => re.test(plain(r[0])));
}

/** Parse ADMIN_MILESTONES.md into [{ id, title, status, status_text }]. */
export function parseMilestones(md) {
  return rowsWithId(markdownTables(md), 'M').map(({ r }) => {
    const statusText = plain(r[r.length - 1]);
    return {
      id: plain(r[0]),
      title: shortTitle(r[1]),
      status: milestoneStatus(statusText),
      status_text: statusText,
    };
  });
}

/** Parse FOLLOWUPS_AND_DEPENDENCIES.md into { ours: [...], external: [...] }. */
export function parseFollowups(md) {
  const tables = markdownTables(md);
  const ours = rowsWithId(tables, 'O').map(({ r }) => {
    const [id, work, gaps, landsIn, notes] = r.map(plain);
    const built = /^built in\b/i.test(landsIn);
    const ms = (/\bM\d+\b/.exec(landsIn) || [])[0] || null;
    return { id, type: 'ours', title: shortTitle(work), detail: work, gaps: gaps || null, milestone: ms, status: built ? 'built' : 'not_started', register_note: notes || null };
  });
  const external = rowsWithId(tables, 'X').map(({ r }) => {
    const [id, dep, who, need, unblocks, ready] = r.map(plain);
    return { id, type: 'external', title: shortTitle(dep), holder: who || null, needs: need || null, unblocks: unblocks || null, built_waiting: ready || null, status: 'blocked' };
  });
  return { ours, external };
}

/** Newest commit per milestone whose subject records or closes it, e.g. "record milestone 14", "Close milestone 12". */
export function closingCommits(commits) {
  const out = {};
  for (const c of commits || []) {
    const msg = (c.commit && c.commit.message) || c.message || '';
    const re = /\b(?:record|close|closing)\s+milestone\s+(\d+)\b(?!\s+progress)/gi;
    let m;
    while ((m = re.exec(msg))) {
      const id = `M${m[1]}`;
      if (!out[id]) out[id] = { sha: c.sha, url: c.html_url || null, date: (c.commit && c.commit.author && c.commit.author.date) || null };
    }
  }
  return out;
}

const STATUS_KEEP = new Set(['in_progress', 'blocked']);

/**
 * Merge the live register over data.json. The register decides which items exist, their titles and
 * whether they are built; data.json supplies owners, dates and anything the register does not record.
 * A hand-written `evidence` or `note` in data.json wins over the live value.
 */
export function mergeRegister(data, live) {
  if (!live || !Array.isArray(live.milestones) || !live.milestones.length) return data;
  const byId = (list) => new Map((list || []).map((x) => [x.id, x]));
  const oldMs = byId(data.milestones);
  const oldItems = byId(data.items);
  const closing = live.closing || {};
  const day = live.source && live.source.date ? live.source.date.slice(0, 10) : null;

  const milestones = live.milestones.map((m) => {
    const o = oldMs.get(m.id) || {};
    const close = closing[m.id];
    return {
      ...o,
      id: m.id,
      title: o.title || m.title,
      status: m.status,
      evidence: o.evidence || (close && close.url) || null,
      note: m.status === 'built' ? o.note || null : m.status_text || o.note || null,
      updated_on: day || o.updated_on || null,
      live: true,
    };
  });

  const merge = (row) => {
    const o = oldItems.get(row.id) || {};
    let status = row.status;
    if (status !== 'built' && STATUS_KEEP.has(o.status)) status = o.status;
    let evidence = o.evidence || null;
    if (status === 'built' && !evidence && row.milestone) {
      const close = closing[row.milestone];
      if (close) evidence = close.url;
    }
    return {
      ...o,
      id: row.id,
      title: o.title || row.title,
      milestone: o.milestone || row.milestone || null,
      type: row.type,
      status,
      owner: o.owner || (row.type === 'ours' ? 'Kunal' : 'Eric'),
      gaps: row.gaps || o.gaps || null,
      holder: row.type === 'external' ? o.holder || row.holder : o.holder,
      needs: row.type === 'external' ? row.needs || o.needs : o.needs,
      built_waiting: row.type === 'external' ? row.built_waiting || o.built_waiting : o.built_waiting,
      evidence,
      note: o.note || row.register_note || null,
      updated_on: o.updated_on || day,
      live: true,
    };
  };
  const liveIds = new Set([...live.ours, ...live.external].map((r) => r.id));
  const items = [
    ...live.ours.map(merge),
    ...live.external.map(merge),
    // Items in data.json the register no longer lists stay as written, so nothing silently disappears.
    ...(data.items || []).filter((i) => !liveIds.has(i.id)).map((i) => ({ ...i, live: false })),
  ];

  return {
    ...data,
    meta: {
      ...(data.meta || {}),
      register_as_of: day || (data.meta && data.meta.register_as_of) || null,
      live: live.source || null,
    },
    milestones,
    items,
  };
}
