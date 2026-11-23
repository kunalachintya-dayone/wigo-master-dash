// Reads Shiva's rider app progress from the WIGOAPP repo and merges it into data.json.
// Shared by the Vercel function (api/app.js), the browser (app.js) and the tests.
//
// WIGOAPP has no milestone register, so progress is read from what the repo does record:
//   README.md "Full Build Status"   screen counts per workflow (WF 01, WF 02), the vendor adapter table
//                                   (Real / Conditionally real / Still fake) and the "still open" list
//   commit history on the branch    recent work, shown as it lands
// Each workflow and each adapter is one unit. Real is built, conditionally real or actively being built
// is in progress, blocked on someone is blocked, anything else is not started.

import { markdownTables } from './register.js';

const plain = (s) => String(s || '').replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();

/** Workflow screen counts from lines like "- **WF 01 Onboarding (Buy + Rent): 23 / 23 screens, fully real**". */
export function parseWorkflows(md) {
  const out = [];
  const re = /^[-*]\s+\*\*(WF\s*\d+[^:*\n]*?):\s*(\d+)\s*\/\s*(\d+)\s+screens/gim;
  let m;
  while ((m = re.exec(String(md || '')))) {
    const done = Number(m[2]);
    const total = Number(m[3]);
    out.push({
      id: plain(m[1]).split(/\s+/).slice(0, 2).join(' '),
      title: plain(m[1]),
      kind: 'workflow',
      done,
      total,
      status: total && done >= total ? 'built' : done > 0 ? 'in_progress' : 'not_started',
      status_text: `${done} of ${total} screens real`,
    });
  }
  return out;
}

/** Map an adapter's status cell and detail text to a dashboard status. */
export function adapterStatus(statusText, detail = '') {
  const s = plain(statusText).toLowerCase();
  const d = plain(detail).toLowerCase();
  if (/^(real|upgraded)\b/.test(s)) return 'built';
  if (/conditionally/.test(s) || /in-progress|in progress/.test(`${s} ${d}`)) return 'in_progress';
  if (/\bblocked on\b|\bpending\b/.test(d)) return 'blocked';
  return 'not_started';
}

/** The vendor adapter table: one unit per row. */
export function parseAdapters(md) {
  const table = markdownTables(md).find((t) => /^adapter$/i.test(plain(t.header[0])));
  if (!table) return [];
  return table.rows.map((r, i) => {
    const [name, status, detail] = r.map(plain);
    return {
      id: `A${i + 1}`,
      title: name.replace(/\s*\(.*$/, '').trim(),
      kind: 'adapter',
      status: adapterStatus(status, detail),
      status_text: status,
      detail: detail || null,
    };
  });
}

/** The numbered "still genuinely open" list: titles only. */
export function parseOpen(md) {
  const text = String(md || '');
  const start = text.search(/^#+\s.*still genuinely open/im);
  if (start === -1) return [];
  const rest = text.slice(start).split(/\r?\n/).slice(1);
  const out = [];
  for (const line of rest) {
    if (/^#{1,6}\s/.test(line)) break;
    const m = /^\d+\.\s+\*\*(.+?)\*\*/.exec(line.trim());
    if (m) out.push(plain(m[1]).replace(/\s+[—-]\s*$/, ''));
  }
  return out;
}

/** Everything the README says, as { units, open }. */
export function parseReadme(md) {
  return { units: [...parseWorkflows(md), ...parseAdapters(md)], open: parseOpen(md) };
}

/** The last few commits, newest first, as plain rows. */
export function recentCommits(commits, n = 12) {
  return (commits || []).slice(0, n).map((c) => ({
    sha: c.sha,
    short: String(c.sha || '').slice(0, 7),
    subject: String((c.commit && c.commit.message) || '').split('\n')[0],
    date: (c.commit && c.commit.author && c.commit.author.date) || null,
    url: c.html_url || null,
  }));
}

/**
 * Merge the live read over data.json -> app. The live units replace the saved ones, each linked to the
 * README at the commit it was read from (that is its evidence). Everything else in `app` stays as written.
 */
export function mergeApp(data, live) {
  if (!live || !live.source || live.error || !Array.isArray(live.units) || !live.units.length) return data;
  const base = data.app || {};
  const readme = `https://github.com/${live.source.repo}/blob/${live.source.sha}/${live.source.file}`;
  const day = live.source.date ? live.source.date.slice(0, 10) : null;
  return {
    ...data,
    app: {
      ...base,
      units: live.units.map((u) => ({ ...u, evidence: readme, updated_on: day, live: true })),
      open: live.open || [],
      recent: live.recent || [],
      live: live.source,
    },
  };
}
