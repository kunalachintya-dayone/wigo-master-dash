import { compute, displayStatus, parseDate, STATUS_LABEL, validate } from './lib/compute.js';
import { mergeRegister } from './lib/register.js';

const VIEWS = [
  ['progress', 'Overall progress'],
  ['n1co', 'n1co'],
  ['hexup', 'Hexup'],
  ['meta', 'Meta and designs'],
  ['team', 'Team'],
  ['tracker', 'Progress tracker'],
  ['code', 'Code updates'],
  ['testing', 'Testing'],
  ['waitlist', 'Waitlist'],
  ['dependencies', 'Dependencies'],
];

const $app = document.getElementById('app');
const state = { owner: 'all', status: 'all', type: 'all', depGroup: 'all', selectedMs: null, view: null, data: null, base: null, live: undefined };

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(value) {
  const d = parseDate(value);
  if (!d) return '';
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function fmtStamp(value) {
  if (!value) return 'unknown';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return fmtDate(value);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return esc(value);
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return `${f.format(d).replace(',', '')} IST`;
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function pill(eff) {
  const s = displayStatus(eff);
  return `<span class="pill ${s}">${STATUS_LABEL[s]}</span>`;
}
function flagPills(eff) {
  const out = [];
  if (eff.flags.includes('no_evidence')) out.push('<span class="pill flag" title="Marked built in data.json but has no evidence link">No evidence link</span>');
  return out.join(' ');
}
function evidenceLink(eff) {
  if (!eff.evidence) return '<span class="muted">None</span>';
  const url = esc(eff.evidence);
  const m = /github\.com\/[^/]+\/([^/]+)\/(commit|pull)\/([0-9a-f]{7}|\d+)/i.exec(eff.evidence);
  const label = m ? `${m[2] === 'pull' ? 'PR #' : ''}${m[3]}` : 'Link';
  const repo = m ? ` title="${esc(m[1])}"` : '';
  return `<a class="ev" href="${url}"${repo} target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
}

/* ---------- Shared pieces ---------- */

const opt = (val, label, cur) => `<option value="${esc(val)}"${val === cur ? ' selected' : ''}>${esc(label)}</option>`;
const signed = (v, unit = '') => (v == null ? '<span class="muted">–</span>' : `<span class="delta ${v > 0 ? 'up' : v < 0 ? 'down' : ''}">${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v)}${unit}</span>`);
const pct = (x) => `${Math.round(x * 1000) / 10}%`;

function sectionHead(id, title, sub) {
  return `<div class="section-head"><h2 id="h-${id}">${esc(title)}</h2>${sub ? `<p>${sub}</p>` : ''}</div>`;
}
function stat(label, value, sub, tone = '') {
  return `<div class="card kpi ${tone}"><div class="label">${label}</div><div class="value">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
}
function daysBadge(d) {
  if (d == null) return '<span class="muted">–</span>';
  return `<span class="days ${d >= 30 ? 'hot' : d >= 14 ? 'warm' : ''}">${d}</span>`;
}
function askStatus(a) {
  if (a.received) return `<span class="pill built">Received</span>`;
  return `<span class="pill blocked">Waiting</span>`;
}

function asksTable(asks, emptyText, firstCol = 'What we asked for') {
  const body = asks.length
    ? asks
        .map(
          (a) => `<tr>
        <td data-label="${esc(firstCol)}"><span class="title">${esc(a.title)}</span>${a.note ? `<div class="note">${esc(a.note)}</div>` : ''}</td>
        <td data-label="Asked on" class="inline-label num nowrap">${a.asked_on ? esc(fmtDate(a.asked_on)) : '<span class="muted">Not recorded</span>'}</td>
        <td data-label="Received" class="inline-label nowrap">${askStatus(a)}${a.received ? ` <span class="muted">${esc(fmtDate(a.received_on))}</span>` : ''}</td>
        <td data-label="Days waiting" class="inline-label">${a.received ? `<span class="muted">${plural(a.days_to_receive, 'day', 'days')} to arrive</span>` : daysBadge(a.days_waiting)}</td>
      </tr>`
        )
        .join('')
    : `<tr><td colspan="4" class="empty">${esc(emptyText)}</td></tr>`;
  return `<div class="table-wrap"><table class="stack">
    <thead><tr><th>${esc(firstCol)}</th><th>Asked on</th><th>Received</th><th>Days waiting</th></tr></thead>
    <tbody>${body}</tbody></table></div>`;
}

function tracksTable(tracks, emptyText, firstCol = 'Work') {
  const body = tracks.length
    ? tracks
        .map(
          (t) => `<tr>
        <td data-label="${esc(firstCol)}"><span class="title">${esc(t.title)}</span>${t.note ? `<div class="note">${esc(t.note)}</div>` : ''}</td>
        <td data-label="Status" class="inline-label">${pill(t)} ${flagPills(t)}</td>
        <td data-label="Evidence" class="inline-label">${evidenceLink(t)}</td>
      </tr>`
        )
        .join('')
    : `<tr><td colspan="3" class="empty">${esc(emptyText)}</td></tr>`;
  return `<div class="table-wrap"><table class="stack">
    <thead><tr><th>${esc(firstCol)}</th><th>Status</th><th>Evidence</th></tr></thead>
    <tbody>${body}</tbody></table></div>`;
}

function partnerMissing(id) {
  return `<div class="card"><div class="chart-note">No <code>partners</code> entry with id <code>${esc(id)}</code> in data.json.</div></div>`;
}

function waitSummary(p) {
  if (!p.asks.length) return 'Nothing asked yet';
  if (!p.waiting) return `All ${p.asks.length} received`;
  return `${p.waiting} of ${p.asks.length} still waiting, longest ${plural(p.longest, 'day', 'days')}`;
}

function nav() {
  return `<nav class="viewnav" aria-label="Views"><div class="viewnav-inner">${VIEWS.map(
    ([id, label]) => `<a href="#${id}">${esc(label)}</a>`
  ).join('')}</div></nav>`;
}

/* ---------- 1. Overall progress ---------- */

function renderLiveLine() {
  const live = state.live;
  if (live === undefined) return `<div class="banner info"><span>⟳</span><span>Checking wigo-admin for the latest register…</span></div>`;
  if (live && live.source && !live.error) {
    const s = live.source;
    return `<div class="banner ok"><span>●</span><span><b>Live from wigo-admin.</b> Milestones and items are read from <code>${esc(s.repo)}</code> branch <code>${esc(s.branch)}</code> at <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.short)}</a> (${esc(fmtStamp(s.date))}). Owners, ask dates, partners, team, testing and waitlist come from data.json.</span></div>`;
  }
  const why = !live ? 'could not be reached' : live.configured === false ? 'is not connected (no GITHUB_TOKEN)' : `failed: ${live.error}`;
  return `<div class="banner warn"><span>⚠</span><span><b>Showing the saved copy.</b> The live register in wigo-admin ${esc(why)}, so milestones and items come from data.json.</span></div>`;
}

function renderBanner(meta) {
  if (meta && meta.reviewed_by) {
    return `<div class="banner ok">Numbers checked against the register by <b>${esc(meta.reviewed_by)}</b>${meta.reviewed_on ? ` on ${esc(fmtDate(meta.reviewed_on))}` : ''}.</div>`;
  }
  return `<div class="banner warn"><span>⚠</span><span><b>Not yet reviewed.</b> Numbers come from the follow-ups register${
    meta && meta.register_as_of ? ` as of ${esc(fmtDate(meta.register_as_of))}` : ''
  } and have not been checked by Kim yet.</span></div>`;
}

function renderProgress(v) {
  const t = v.totals;
  const next = v.nextMilestone;
  let nextHtml;
  if (next) {
    const d = next.days_to_due;
    const when = d < 0 ? `<span class="pill overdue">${plural(-d, 'day', 'days')} overdue</span>` : d === 0 ? 'due today' : `in ${plural(d, 'day', 'days')}`;
    nextHtml = `<span class="tag">Next dated milestone</span><span><strong>${esc(next.id)}</strong> ${esc(next.title)}</span><span>${esc(fmtDate(next.due))} · ${when}</span>`;
  } else {
    nextHtml = `<span class="tag">Next dated milestone</span><span class="muted">None. No open milestone has a due date in data.json.</span>`;
  }
  const msCount = (s) => v.milestones.filter((m) => m.status === s).length;
  const tiles = v.milestones
    .map((m) => {
      const s = m.status;
      const sel = state.selectedMs === m.id;
      return `<button class="ms ${s}" type="button" data-ms="${esc(m.id)}" aria-pressed="${sel}" title="${esc(`${m.id} ${m.title}: ${STATUS_LABEL[s]}`)}">${esc(m.id)}<small>${STATUS_LABEL[s]}</small></button>`;
    })
    .join('');
  const sel = v.milestones.find((m) => m.id === state.selectedMs);
  const detail = sel
    ? `<div class="ms-detail">
        <h3>${esc(sel.id)} · ${esc(sel.title)}</h3>
        <div>${pill(sel)} ${flagPills(sel)} ${sel.due ? `<span class="muted">Due ${esc(fmtDate(sel.due))}</span>` : ''}</div>
        ${sel.note ? `<p>${esc(sel.note)}</p>` : ''}
        <p>${sel.items_total ? `${sel.items_built} of ${sel.items_total} linked items built.` : 'No items linked.'} Evidence: ${evidenceLink(sel)}</p>
      </div>`
    : `<div class="ms-detail muted">Tap a milestone for its name and evidence.</div>`;
  return `
  <section id="progress" aria-labelledby="h-progress">
    ${sectionHead('progress', 'Overall progress', 'How much of the admin console (web dashboard) is built: milestones built out of all milestones, live from wigo-admin.')}
    <div class="kpis">
      <div class="card kpi hero">
        <div class="label">Admin console progress</div>
        <div class="value">${t.overallPct}%</div>
        <div class="bar" role="img" aria-label="${t.overallPct} percent"><span style="width:${(t.overallShare * 100).toFixed(1)}%"></span></div>
        <div class="sub">${t.milestonesBuilt} of ${t.milestonesTotal} milestones built${t.milestonesInProgress ? ` · ${t.milestonesInProgress} in progress` : ''}</div>
      </div>
      ${stat('<span class="dot" style="background:var(--green)"></span>Built', t.built, `of ${t.ours} open follow-up items (${t.sharePct}%)`)}
      ${stat('<span class="dot" style="background:var(--amber)"></span>In progress', t.inProgress, 'our items being built')}
      ${stat('<span class="dot" style="background:var(--ink)"></span>Still ours', t.stillOurs, t.overdue ? `<span style="color:var(--red-ink);font-weight:600">${t.overdue} overdue</span>` : 'not yet built')}
      ${stat('<span class="dot" style="background:var(--red)"></span>Blocked on others', t.blockedOnOthers, 'waiting on someone else')}
    </div>
    <div class="card next">${nextHtml}</div>
    <div class="card" style="margin-top:12px">
      <div class="strip-head"><b>Milestones M1 to M${v.milestones.length}</b>
        <span>${msCount('built')} built · ${msCount('in_progress')} in progress · ${msCount('not_started')} not started · ${msCount('blocked')} blocked</span></div>
      <div class="strip">${tiles}</div>
      <div class="legend">
        <span><i style="background:var(--green)"></i>Built</span>
        <span><i style="background:var(--amber)"></i>In progress</span>
        <span><i style="background:var(--grey)"></i>Not started</span>
        <span><i style="background:var(--red)"></i>Blocked</span>
      </div>
      ${detail}
    </div>
  </section>`;
}

/* ---------- 2. n1co ---------- */

function renderN1co(v) {
  const p = v.partners.n1co;
  const head = sectionHead('n1co', 'n1co', 'Payment documentation, sandbox and webhooks: asked on, received, days waiting, joint testing.');
  if (!p) return `<section id="n1co">${head}${partnerMissing('n1co')}</section>`;
  const joint = p.tracks.find((t) => /joint test/i.test(t.title));
  return `
  <section id="n1co" aria-labelledby="h-n1co">
    ${head}
    <div class="kpis kpis-3">
      ${stat('Received', `${p.received}<small> of ${p.asks.length}</small>`, esc(waitSummary(p)))}
      ${stat('Longest wait', p.waiting ? `${p.longest}<small> days</small>` : '–', p.contact ? `Contact: ${esc(p.contact)}` : '')}
      ${stat('Joint testing', joint ? pill(joint) : '<span class="muted">Not tracked</span>', joint && joint.note ? esc(joint.note) : '')}
    </div>
    <div class="card" style="margin-top:12px">${asksTable(p.asks, 'Nothing asked of n1co yet.')}</div>
    <div class="card" style="margin-top:12px">${tracksTable(p.tracks, 'No n1co work tracked yet.')}</div>
  </section>`;
}

/* ---------- 3. Hexup ---------- */

function renderHexup(v) {
  const p = v.partners.hexup;
  const head = sectionHead('hexup', 'Hexup', 'Hardware and cabinet integration status, and what is still needed from them.');
  if (!p) return `<section id="hexup">${head}${partnerMissing('hexup')}</section>`;
  const built = p.tracks.filter((t) => t.status === 'built').length;
  const blocked = p.tracks.filter((t) => t.status === 'blocked').length;
  return `
  <section id="hexup" aria-labelledby="h-hexup">
    ${head}
    <div class="kpis kpis-3">
      ${stat('Integration built', `${built}<small> of ${p.tracks.length}</small>`, blocked ? `${blocked} blocked on hardware` : 'nothing blocked')}
      ${stat('Still needed', p.waiting, esc(waitSummary(p)))}
      ${stat('Longest wait', p.waiting ? `${p.longest}<small> days</small>` : '–', p.contact ? esc(p.contact) : '')}
    </div>
    <div class="grid-2">
      <div class="card"><h3 class="card-title">Integration status</h3>${tracksTable(p.tracks, 'No integration work tracked yet.')}</div>
      <div class="card"><h3 class="card-title">Still needed from Hexup</h3>${asksTable(p.asks, 'Nothing asked of Hexup yet.', 'Item')}</div>
    </div>
  </section>`;
}

/* ---------- 4. Meta and module designs ---------- */

function renderMeta(v) {
  const meta = v.partners.meta;
  const designs = v.partners.designs;
  const head = sectionHead('meta', 'Meta and module designs', 'WhatsApp and Meta approvals, and design status for the four modules.');
  const metaCard = meta
    ? `<div class="card"><h3 class="card-title">WhatsApp and Meta approvals <span class="muted">${esc(waitSummary(meta))}</span></h3>
        ${asksTable(meta.asks, 'Nothing submitted to Meta yet.', 'Approval')}
        ${meta.tracks.length ? `<div class="subhead">Our side, ready for approval</div>${tracksTable(meta.tracks, '')}` : ''}
      </div>`
    : partnerMissing('meta');
  const designCard = designs
    ? `<div class="card"><h3 class="card-title">Module designs <span class="muted">${designs.received} of ${designs.asks.length} received</span></h3>
        ${asksTable(designs.asks, 'No module designs requested yet.', 'Module')}
        ${designs.contact ? `<div class="chart-note">Held by ${esc(designs.contact)}.</div>` : ''}
      </div>`
    : partnerMissing('designs');
  return `<section id="meta" aria-labelledby="h-meta">${head}<div class="grid-2">${metaCard}${designCard}</div></section>`;
}

/* ---------- 5. Team ---------- */

function renderTeam(v) {
  const head = sectionHead('team', 'Team', 'Owner, current task and status from the tracker, plus the daily update.');
  if (!v.team.length) return `<section id="team">${head}<div class="card"><div class="chart-note">No <code>team</code> list in data.json.</div></div></section>`;
  const cards = v.team
    .map((m) => {
      const task = m.task
        ? `<div class="team-task"><span class="id">${esc(m.task.id)}</span>${esc(m.task.title)}</div><div>${pill(m.task)} ${flagPills(m.task)}</div>`
        : `<div class="team-task muted">No open items assigned in the tracker.</div>`;
      let update;
      if (m.update) {
        const age = m.update_age;
        const when = age === 0 ? 'today' : age === 1 ? 'yesterday' : age != null ? `${age} days ago` : 'date not set';
        update = `<div class="team-update ${m.update_today ? '' : 'stale'}"><span class="tag">Daily update · ${esc(when)}</span><p>${esc(m.update)}</p></div>`;
      } else {
        update = `<div class="team-update stale"><span class="tag">Daily update</span><p>No update posted yet.</p></div>`;
      }
      return `<div class="card team-card">
        <div class="team-head"><h3>${esc(m.name)}</h3>${m.update_today ? '<span class="pill built">Updated today</span>' : '<span class="pill not_started">No update today</span>'}</div>
        ${m.role ? `<div class="note">${esc(m.role)}</div>` : ''}
        <div class="team-label">Current task</div>${task}
        <div class="team-counts">${m.items_total ? `${m.items_built} of ${m.items_total} items built · ${m.items_open} open${m.items_blocked ? ` · <b class="red">${m.items_blocked} blocked</b>` : ''}` : 'No items owned in the tracker'}</div>
        ${update}
      </div>`;
    })
    .join('');
  return `<section id="team" aria-labelledby="h-team">${head}<div class="team-grid">${cards}</div></section>`;
}

/* ---------- 6. Progress tracker ---------- */

function renderTracker(v) {
  const owners = [...new Set(v.tracker.map((r) => r.owner))].sort();
  const rows = v.tracker.filter((r) => {
    if (state.owner !== 'all' && r.owner !== state.owner) return false;
    if (state.type !== 'all' && r.type !== state.type) return false;
    if (state.status === 'all') return true;
    if (state.status === 'overdue') return r.overdue;
    if (state.status === 'open') return r.status !== 'built';
    if (state.status === 'placeholder') return r.flags.includes('placeholder');
    if (state.status === 'no_evidence') return r.flags.includes('no_evidence');
    return r.status === state.status;
  });
  const body = rows.length
    ? rows
        .map(
          (r) => `<tr class="${r.overdue ? 'is-overdue' : ''}">
        <td data-label="Item"><span class="id">${esc(r.id)}</span><span class="title">${esc(r.title)}</span>
          ${r.note ? `<div class="note">${esc(r.note)}</div>` : ''}</td>
        <td data-label="Milestone" class="inline-label muted">${esc(r.milestone || '')}</td>
        <td data-label="Owner" class="inline-label">${esc(r.type === 'external' && r.holder ? r.holder : r.owner)}</td>
        <td data-label="Status" class="inline-label">${pill(r)} ${flagPills(r)} ${r.overdue ? '<span class="pill overdue">Overdue</span>' : ''}${r.days_waiting != null ? ` <span class="muted nowrap">${plural(r.days_waiting, 'day', 'days')} waiting</span>` : ''}</td>
        <td data-label="Due" class="inline-label num nowrap">${r.due ? esc(fmtDate(r.due)) : '<span class="muted">Not set</span>'}</td>
        <td data-label="Evidence" class="inline-label">${evidenceLink(r)}</td>
      </tr>`
        )
        .join('')
    : `<tr><td colspan="6" class="empty">No items match these filters.</td></tr>`;
  return `
  <section id="tracker" aria-labelledby="h-tracker">
    ${sectionHead('tracker', 'Progress tracker', 'Every item with owner, status, due date and evidence. Built needs an evidence link.')}
    <div class="card">
      <div class="filters">
        <label>Side <select id="f-type">${opt('all', 'All', state.type)}${opt('ours', 'Ours', state.type)}${opt('external', 'Others', state.type)}</select></label>
        <label>Owner <select id="f-owner">${opt('all', 'All', state.owner)}${owners.map((o) => opt(o, o, state.owner)).join('')}</select></label>
        <label>Status <select id="f-status">
          ${opt('all', 'All', state.status)}${opt('open', 'Not built yet', state.status)}${opt('built', 'Built', state.status)}${opt('in_progress', 'In progress', state.status)}${opt('not_started', 'Not started', state.status)}${opt('blocked', 'Blocked', state.status)}${opt('placeholder', 'Placeholder', state.status)}${opt('no_evidence', 'Missing evidence', state.status)}${opt('overdue', 'Overdue', state.status)}
        </select></label>
        <span class="count">${plural(rows.length, 'item', 'items')} shown of ${v.tracker.length}</span>
      </div>
      <div class="table-wrap">
        <table class="stack">
          <thead><tr><th>Item</th><th>Milestone</th><th>Owner</th><th>Status</th><th>Due</th><th>Evidence</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>
  </section>`;
}

/* ---------- 7. Code updates (filled by renderChart) ---------- */

function renderCodeShell() {
  return `
  <section id="code" aria-labelledby="h-code">
    ${sectionHead('code', 'Code updates', 'GitHub commits and releases by person, last 7 days.')}
    <div class="card" id="commits"><div class="chart-note">Loading commits…</div></div>
  </section>`;
}

/* ---------- 8. Testing ---------- */

function renderTesting(v) {
  const t = v.testing.totals;
  const head = sectionHead('testing', 'Testing updates', 'Test cases written against executed and passed, and open bugs.');
  const suites = v.testing.suites;
  const suiteBody = suites.length
    ? suites
        .map(
          (s) => `<tr>
        <td data-label="Area"><span class="title">${esc(s.area || 'Unnamed')}</span>${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}</td>
        <td data-label="Written" class="inline-label num">${s.written}</td>
        <td data-label="Executed" class="inline-label num">${s.executed}${s.not_run ? ` <span class="muted">(${s.not_run} not run)</span>` : ''}</td>
        <td data-label="Passed" class="inline-label num">${s.passed}${s.failed ? ` <span class="red">(${s.failed} failed)</span>` : ''}</td>
        <td data-label="Updated" class="inline-label num nowrap">${s.updated_on ? esc(fmtDate(s.updated_on)) : '<span class="muted">–</span>'}</td>
        <td data-label="Evidence" class="inline-label">${evidenceLink(s)}</td>
      </tr>`
        )
        .join('')
    : `<tr><td colspan="6" class="empty">No test results recorded yet. Add one row per area to <code>testing.suites</code> in data.json.</td></tr>`;
  const bugs = v.testing.openBugs;
  const bugBody = bugs.length
    ? bugs
        .map(
          (b) => `<tr>
        <td data-label="Bug"><span class="id">${esc(b.id)}</span><span class="title">${esc(b.title)}</span>${b.area ? `<div class="note">${esc(b.area)}</div>` : ''}</td>
        <td data-label="Severity" class="inline-label"><span class="pill sev-${esc(b.severity || 'none')}">${esc(b.severity || 'Not set')}</span></td>
        <td data-label="Owner" class="inline-label">${esc(b.owner || '')}</td>
        <td data-label="Open for" class="inline-label">${b.age == null ? '<span class="muted">–</span>' : plural(b.age, 'day', 'days')}</td>
        <td data-label="Link" class="inline-label">${evidenceLink({ evidence: b.link })}</td>
      </tr>`
        )
        .join('')
    : `<tr><td colspan="5" class="empty">${v.testing.bugs.length ? 'No open bugs.' : 'No bugs logged yet. Add them to <code>testing.bugs</code> in data.json.'}</td></tr>`;
  return `
  <section id="testing" aria-labelledby="h-testing">
    ${head}
    <div class="kpis kpis-4">
      ${stat('Written', t.written, 'test cases')}
      ${stat('Executed', t.executed, t.written ? `${t.executedPct}% of written` : 'none yet')}
      ${stat('Passed', t.passed, t.executed ? `${t.passPct}% of executed${t.failed ? ` · ${t.failed} failed` : ''}` : 'none yet')}
      ${stat('Open bugs', t.bugsOpen, t.bugsCritical ? `<span class="red">${t.bugsCritical} critical or high</span>` : `${t.bugsClosed} closed`)}
    </div>
    <div class="card" style="margin-top:12px"><div class="table-wrap"><table class="stack">
      <thead><tr><th>Area</th><th>Written</th><th>Executed</th><th>Passed</th><th>Updated</th><th>Evidence</th></tr></thead>
      <tbody>${suiteBody}</tbody></table></div>${v.testing.note ? `<div class="chart-note">${esc(v.testing.note)}</div>` : ''}</div>
    <div class="card" style="margin-top:12px"><h3 class="card-title">Open bugs</h3><div class="table-wrap"><table class="stack">
      <thead><tr><th>Bug</th><th>Severity</th><th>Owner</th><th>Open for</th><th>Link</th></tr></thead>
      <tbody>${bugBody}</tbody></table></div></div>
  </section>`;
}

/* ---------- 9. Waitlist and conversion ---------- */

function renderWaitlist(v) {
  const w = v.waitlist;
  const head = sectionHead('waitlist', 'Waitlist and conversion', esc(w.source ? `From ${w.source}. Change is against the previous day.` : 'Change is against the previous day.'));
  const l = w.latest;
  if (!l) {
    return `<section id="waitlist" aria-labelledby="h-waitlist">${head}<div class="card"><div class="chart-note">No waitlist data yet. Add a daily row (<code>date</code>, <code>size</code>, <code>converted</code>) to <code>waitlist.days</code> in data.json. Waiting on the rider app team (X7).</div></div></section>`;
  }
  const rows = [...w.days].reverse().slice(0, 14);
  const body = rows
    .map(
      (d) => `<tr>
      <td data-label="Day" class="nowrap">${esc(fmtDate(d.date))}</td>
      <td data-label="Waitlist" class="inline-label num">${d.size.toLocaleString('en-US')} ${signed(d.size_change)}</td>
      <td data-label="Converted" class="inline-label num">${d.converted.toLocaleString('en-US')} ${signed(d.converted_change)}</td>
      <td data-label="Conversion" class="inline-label num">${pct(d.rate)} ${signed(d.rate_change_pts, ' pts')}</td>
    </tr>`
    )
    .join('');
  return `
  <section id="waitlist" aria-labelledby="h-waitlist">
    ${head}
    <div class="kpis kpis-3">
      ${stat('Waitlist size', l.size.toLocaleString('en-US'), `${signed(l.size_change)} since previous day · ${esc(fmtDate(l.date))}`)}
      ${stat('Converted', l.converted.toLocaleString('en-US'), `${signed(l.converted_change)} since previous day`)}
      ${stat('Conversion', pct(l.rate), `${signed(l.rate_change_pts, ' pts')} since previous day`)}
    </div>
    <div class="card" style="margin-top:12px"><div class="table-wrap"><table class="stack">
      <thead><tr><th>Day</th><th>Waitlist</th><th>Converted</th><th>Conversion</th></tr></thead>
      <tbody>${body}</tbody></table></div>
      ${w.days.length > 14 ? `<div class="chart-note">Last 14 of ${w.days.length} days shown.</div>` : ''}
    </div>
  </section>`;
}

/* ---------- 10. Dependencies ---------- */

function renderDependencies(v) {
  const groups = v.dependencies;
  const shown = state.depGroup === 'all' ? v.blocked : (groups.find((g) => g.key === state.depGroup) || { rows: [] }).rows;
  const summary = groups
    .map(
      (g) => `<button type="button" class="card kpi dep-card ${state.depGroup === g.key ? 'on' : ''}" data-dep="${g.key}" aria-pressed="${state.depGroup === g.key}">
      <div class="label">${esc(g.label)}</div>
      <div class="value">${g.count}</div>
      <div class="sub">${g.count ? `longest ${plural(g.longest, 'day', 'days')}${g.over14 ? ` · <span class="red">${g.over14} over 14 days</span>` : ''}` : 'nothing waiting'}</div>
    </button>`
    )
    .join('');
  const body = shown.length
    ? shown
        .map((r) => {
          const d = r.days_waiting;
          return `<tr>
        <td data-label="Who holds it"><span class="title">${esc(r.holder || r.owner)}</span><div class="note"><span class="id">${esc(r.id)}</span>${esc(r.title)}</div></td>
        <td data-label="What we need">${esc(r.needs || '')}</td>
        <td data-label="Asked on" class="inline-label num nowrap">${r.asked_on ? esc(fmtDate(r.asked_on)) : '<span class="muted">Not recorded</span>'}</td>
        <td data-label="Days waiting" class="inline-label">${daysBadge(d)}${d != null && d >= 14 ? ` <span class="pill ${d >= 30 ? 'overdue' : 'in_progress'}">${d >= 30 ? 'Over 30 days' : 'Over 14 days'}</span>` : ''}</td>
        <td data-label="Built and waiting">${esc(r.built_waiting || '')}</td>
      </tr>`;
        })
        .join('')
    : `<tr><td colspan="5" class="empty">Nothing is waiting here.</td></tr>`;
  return `
  <section id="dependencies" aria-labelledby="h-dependencies">
    ${sectionHead('dependencies', 'Dependencies', 'Items waiting on Eric or third parties. Longest wait first; days are counted from the date asked.')}
    <div class="kpis kpis-2">${summary}</div>
    <div class="card" style="margin-top:12px">
      <div class="filters">
        <label>Waiting on <select id="f-dep">${opt('all', 'Everyone', state.depGroup)}${groups.map((g) => opt(g.key, g.key === 'eric' ? 'Eric' : 'Third parties', state.depGroup)).join('')}</select></label>
        <span class="count">${plural(shown.length, 'item', 'items')} shown of ${v.blocked.length}</span>
      </div>
      <div class="table-wrap">
        <table class="stack">
          <thead><tr><th>Who holds it</th><th>What we need</th><th>Asked on</th><th>Days waiting</th><th>Already built and waiting</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>
  </section>`;
}

function renderChecks(v, check) {
  const lines = [...check.errors.map((e) => `Error: ${e}`), ...check.warnings];
  if (!lines.length) return '';
  return `
  <section>
    <div class="card"><details class="checks"><summary>Data checks (${lines.length})</summary>
      <ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    </details></div>
  </section>`;
}

/* ---------- Commit chart ---------- */

const PERSON_COLORS = ['#1CD94C', '#0E0E0E', '#F2A516', '#4C7DF0', '#A855F7', '#8A8F96'];

function renderChart(payload) {
  const host = document.getElementById('commits');
  if (!host) return;
  if (!payload || !payload.configured) {
    host.innerHTML = `<div class="chart-note">Not connected yet. Set <code>GITHUB_TOKEN</code> and <code>GITHUB_REPOS</code> on the Vercel project to show commits here.</div>`;
    return;
  }
  if (payload.error) {
    host.innerHTML = `<div class="chart-note">Could not read commits from GitHub: ${esc(payload.error)}</div>`;
    return;
  }
  const { days, people } = payload;
  const releases = payload.releases || [];
  const weeklyRows = payload.weekly || people.map((p) => ({ name: p.name, commits: p.counts.reduce((a, b) => a + b, 0), releases: 0 }));
  const total = people.reduce((s, p) => s + p.counts.reduce((a, b) => a + b, 0), 0);
  const weeklyTable = weeklyRows.length
    ? `<div class="table-wrap"><table class="stack weekly">
        <thead><tr><th>Person</th><th>Commits this week</th><th>Releases this week</th></tr></thead>
        <tbody>${weeklyRows
          .map((w) => `<tr><td data-label="Person"><span class="title">${esc(w.name)}</span></td><td data-label="Commits" class="inline-label num">${w.commits}</td><td data-label="Releases" class="inline-label num">${w.releases}</td></tr>`)
          .join('')}</tbody></table></div>`
    : '';
  const releaseList = releases.length
    ? `<div class="subhead">Releases</div><ul class="releases">${releases
        .map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a> <span class="muted">${esc(r.repo)} · ${esc(r.person)} · ${esc(fmtStamp(r.published_at))}${r.prerelease ? ' · pre-release' : ''}</span></li>`)
        .join('')}</ul>`
    : `<div class="chart-note">No releases published in the last 7 days.</div>`;
  if (!total) {
    host.innerHTML = `<div class="chart-note">No commits in the last 7 days on ${esc((payload.repos || []).join(', '))}.</div>${weeklyTable}${releaseList}`;
    return;
  }
  const W = 700, H = 240, padL = 30, padB = 28, padT = 10, padR = 6;
  const max = Math.max(1, ...people.flatMap((p) => p.counts));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const groupW = (W - padL - padR) / days.length;
  const barW = Math.max(3, Math.min(22, (groupW * 0.78) / people.length));
  const y = (val) => padT + (H - padT - padB) * (1 - val / top);
  let svg = '';
  for (let g = 0; g <= top; g += step) {
    svg += `<line x1="${padL}" x2="${W - padR}" y1="${y(g)}" y2="${y(g)}" stroke="#E4E6E9"/>`;
    svg += `<text x="${padL - 6}" y="${y(g) + 4}" text-anchor="end" font-size="11" fill="#6B7178">${g}</text>`;
  }
  days.forEach((day, di) => {
    const gx = padL + groupW * di + (groupW - barW * people.length) / 2;
    people.forEach((p, pi) => {
      const val = p.counts[di];
      if (!val) return;
      const x = gx + pi * barW;
      svg += `<rect x="${x + 0.5}" y="${y(val)}" width="${barW - 1}" height="${y(0) - y(val)}" rx="2" fill="${PERSON_COLORS[pi % PERSON_COLORS.length]}"><title>${esc(p.name)}: ${val} on ${esc(fmtDate(day))}</title></rect>`;
    });
    const d = parseDate(day);
    svg += `<text x="${padL + groupW * di + groupW / 2}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#6B7178">${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}</text>`;
  });
  const legend = people
    .map((p, i) => `<span><i style="background:${PERSON_COLORS[i % PERSON_COLORS.length]}"></i>${esc(p.name)} (${p.counts.reduce((a, b) => a + b, 0)})</span>`)
    .join('');
  host.innerHTML = `${weeklyTable}<div class="chart">
    <div class="subhead" style="padding:0 0 6px">Commits per person per day</div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Commits per person per day">${svg}</svg>
    <div class="legend">${legend}</div>
  </div>${releaseList}
  <div class="chart-note">Repos: ${esc((payload.repos || []).join(', '))}. A repo without @branch counts its default branch.</div>`;
}

function niceStep(max) {
  if (max <= 5) return 1;
  if (max <= 10) return 2;
  if (max <= 25) return 5;
  if (max <= 50) return 10;
  return Math.ceil(max / 5 / 10) * 10;
}

/* ---------- Main ---------- */

function render() {
  const { data } = state;
  const v = compute(data);
  const check = validate(data);
  state.view = v;
  document.getElementById('updated').textContent = `Updated ${fmtStamp(v.lastUpdated)}`;
  const src = document.getElementById('source');
  if (src && data.meta && data.meta.register) src.textContent = `Source register: ${data.meta.register}.`;
  $app.innerHTML =
    renderLiveLine() +
    renderBanner(data.meta) +
    nav() +
    renderProgress(v) +
    renderN1co(v) +
    renderHexup(v) +
    renderMeta(v) +
    renderTeam(v) +
    renderTracker(v) +
    renderCodeShell() +
    renderTesting(v) +
    renderWaitlist(v) +
    renderDependencies(v) +
    renderChecks(v, check);
  if (state.commits !== undefined) renderChart(state.commits);
}

$app.addEventListener('click', (e) => {
  const dep = e.target.closest('.dep-card');
  if (dep) {
    state.depGroup = state.depGroup === dep.dataset.dep ? 'all' : dep.dataset.dep;
    render();
    $app.querySelector(`.dep-card[data-dep="${dep.dataset.dep}"]`)?.focus();
    return;
  }
  const btn = e.target.closest('.ms');
  if (!btn) return;
  state.selectedMs = state.selectedMs === btn.dataset.ms ? null : btn.dataset.ms;
  render();
  const again = $app.querySelector(`.ms[data-ms="${btn.dataset.ms}"]`);
  if (again) again.focus();
});
$app.addEventListener('change', (e) => {
  if (e.target.id === 'f-owner') state.owner = e.target.value;
  else if (e.target.id === 'f-status') state.status = e.target.value;
  else if (e.target.id === 'f-type') state.type = e.target.value;
  else if (e.target.id === 'f-dep') state.depGroup = e.target.value;
  else return;
  render();
  document.getElementById(e.target.id)?.focus();
});

async function main() {
  try {
    const res = await fetch('/data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.base = await res.json();
    state.data = state.base;
  } catch (err) {
    $app.innerHTML = `<div class="error-box">Could not load data.json (${esc(err.message)}).</div>`;
    document.getElementById('updated').textContent = '';
    return;
  }
  render();
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  const getJson = (url) =>
    fetch(url, { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  const [live, commits] = await Promise.all([getJson('/api/register'), getJson('/api/commits')]);
  state.live = live;
  if (live && live.source && !live.error) state.data = mergeRegister(state.base, live);
  state.commits = commits || { configured: false };
  render();
}

main();
