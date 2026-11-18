import { compute, displayStatus, parseDate, STATUS_LABEL, validate } from './lib/compute.js';

const $app = document.getElementById('app');
const state = { owner: 'all', status: 'all', selectedMs: null, view: null, data: null };

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

/* ---------- Sections ---------- */

function renderBanner(meta) {
  if (meta && meta.reviewed_by) {
    return `<div class="banner ok">Numbers checked against the register by <b>${esc(meta.reviewed_by)}</b>${meta.reviewed_on ? ` on ${esc(fmtDate(meta.reviewed_on))}` : ''}.</div>`;
  }
  return `<div class="banner warn"><span>⚠</span><span><b>Not yet reviewed.</b> Numbers come from the follow-ups register${
    meta && meta.register_as_of ? ` as of ${esc(fmtDate(meta.register_as_of))}` : ''
  } and have not been checked by Kim yet.</span></div>`;
}

function renderHeader(v) {
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
  return `
  <section aria-label="Summary">
    <div class="kpis">
      <div class="card kpi hero">
        <div class="label">Our work done</div>
        <div class="value">${t.sharePct}%</div>
        <div class="bar" role="img" aria-label="${t.sharePct} percent"><span style="width:${(t.share * 100).toFixed(1)}%"></span></div>
        <div class="sub">${t.built} of ${t.ours} items in our control are built</div>
      </div>
      <div class="card kpi">
        <div class="label"><span class="dot" style="background:var(--green)"></span>Built</div>
        <div class="value">${t.built}</div>
        <div class="sub">${t.milestonesBuilt} of ${t.milestonesTotal} milestones</div>
      </div>
      <div class="card kpi">
        <div class="label"><span class="dot" style="background:var(--amber)"></span>In progress</div>
        <div class="value">${t.inProgress}</div>
        <div class="sub">our items being built</div>
      </div>
      <div class="card kpi">
        <div class="label"><span class="dot" style="background:var(--ink)"></span>Still ours</div>
        <div class="value">${t.stillOurs}</div>
        <div class="sub">${t.overdue ? `<span style="color:var(--red-ink);font-weight:600">${t.overdue} overdue</span>` : 'not yet built'}</div>
      </div>
      <div class="card kpi">
        <div class="label"><span class="dot" style="background:var(--red)"></span>Blocked on others</div>
        <div class="value">${t.blockedOnOthers}</div>
        <div class="sub">waiting on someone else</div>
      </div>
    </div>
    <div class="card next">${nextHtml}</div>
  </section>`;
}

function renderStrip(v) {
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
  <section aria-labelledby="h-ms">
    <div class="section-head"><h2 id="h-ms">Milestones</h2><p>M1 to M${v.milestones.length}</p></div>
    <div class="card">
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

function renderOurs(v) {
  const owners = [...new Set(v.ours.map((r) => r.owner))].sort();
  const rows = v.ours.filter((r) => {
    if (state.owner !== 'all' && r.owner !== state.owner) return false;
    if (state.status === 'all') return true;
    if (state.status === 'overdue') return r.overdue;
    if (state.status === 'open') return r.status !== 'built';
    if (state.status === 'placeholder') return r.flags.includes('placeholder');
    return r.status === state.status;
  });
  const opt = (val, label, cur) => `<option value="${esc(val)}"${val === cur ? ' selected' : ''}>${esc(label)}</option>`;
  const body = rows.length
    ? rows
        .map(
          (r) => `<tr class="${r.overdue ? 'is-overdue' : ''}">
        <td data-label="Item"><span class="id">${esc(r.id)}</span><span class="title">${esc(r.title)}</span>
          ${r.note ? `<div class="note">${esc(r.note)}</div>` : ''}</td>
        <td data-label="Milestone" class="inline-label muted">${esc(r.milestone || '')}</td>
        <td data-label="Owner" class="inline-label">${esc(r.owner)}</td>
        <td data-label="Status" class="inline-label">${pill(r)} ${flagPills(r)} ${r.overdue ? '<span class="pill overdue">Overdue</span>' : ''}</td>
        <td data-label="Due" class="inline-label num nowrap">${r.due ? esc(fmtDate(r.due)) : '<span class="muted">Not set</span>'}</td>
        <td data-label="Evidence" class="inline-label">${evidenceLink(r)}</td>
      </tr>`
        )
        .join('')
    : `<tr><td colspan="6" class="empty">No items match these filters.</td></tr>`;
  return `
  <section aria-labelledby="h-ours">
    <div class="section-head"><h2 id="h-ours">Our side</h2><p>Work in our control. Overdue rows are marked red.</p></div>
    <div class="card">
      <div class="filters">
        <label>Owner <select id="f-owner">${opt('all', 'All', state.owner)}${owners.map((o) => opt(o, o, state.owner)).join('')}</select></label>
        <label>Status <select id="f-status">
          ${opt('all', 'All', state.status)}${opt('open', 'Not built yet', state.status)}${opt('built', 'Built', state.status)}${opt('in_progress', 'In progress', state.status)}${opt('not_started', 'Not started', state.status)}${opt('blocked', 'Blocked', state.status)}${opt('placeholder', 'Placeholder', state.status)}${opt('overdue', 'Overdue', state.status)}
        </select></label>
        <span class="count">${plural(rows.length, 'item', 'items')} shown of ${v.ours.length}</span>
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

function renderBlocked(v) {
  const body = v.blocked.length
    ? v.blocked
        .map((r) => {
          const d = r.days_waiting;
          return `<tr>
        <td data-label="Who holds it"><span class="title">${esc(r.holder || r.owner)}</span><div class="note"><span class="id">${esc(r.id)}</span>${esc(r.title)}</div></td>
        <td data-label="What we need">${esc(r.needs || '')}</td>
        <td data-label="Asked on" class="inline-label num">${r.asked_on ? esc(fmtDate(r.asked_on)) : '<span class="muted">Not recorded</span>'}</td>
        <td data-label="Days waiting" class="inline-label"><span class="days ${d != null && d >= 14 ? 'hot' : ''}">${d == null ? '–' : d}</span></td>
        <td data-label="Built and waiting">${esc(r.built_waiting || '')}</td>
      </tr>`;
        })
        .join('')
    : `<tr><td colspan="5" class="empty">Nothing is waiting on anyone else.</td></tr>`;
  return `
  <section aria-labelledby="h-blocked">
    <div class="section-head"><h2 id="h-blocked">Blocked on others</h2><p>Longest wait first. Days are counted from the date asked.</p></div>
    <div class="card">
      <div class="table-wrap">
        <table class="stack">
          <thead><tr><th>Who holds it</th><th>What we need</th><th>Asked on</th><th>Days waiting</th><th>Already built and waiting</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>
  </section>`;
}

function renderCommitsShell() {
  return `
  <section aria-labelledby="h-commits">
    <div class="section-head"><h2 id="h-commits">Proof of work</h2><p>Commits per person per day, last 7 days, from GitHub.</p></div>
    <div class="card" id="commits"><div class="chart-note">Loading commits…</div></div>
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
  const total = people.reduce((s, p) => s + p.counts.reduce((a, b) => a + b, 0), 0);
  if (!total) {
    host.innerHTML = `<div class="chart-note">No commits in the last 7 days on ${esc((payload.repos || []).join(', '))}.</div>`;
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
  host.innerHTML = `<div class="chart">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Commits per person per day">${svg}</svg>
    <div class="legend">${legend}</div>
    <div class="note">Repos: ${esc((payload.repos || []).join(', '))}. A repo without @branch counts its default branch.</div>
  </div>`;
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
    renderBanner(data.meta) + renderHeader(v) + renderStrip(v) + renderOurs(v) + renderBlocked(v) + renderCommitsShell() + renderChecks(v, check);
  if (state.commits !== undefined) renderChart(state.commits);
}

$app.addEventListener('click', (e) => {
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
  else return;
  render();
  document.getElementById(e.target.id)?.focus();
});

async function main() {
  try {
    const res = await fetch('/data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.data = await res.json();
  } catch (err) {
    $app.innerHTML = `<div class="error-box">Could not load data.json (${esc(err.message)}).</div>`;
    document.getElementById('updated').textContent = '';
    return;
  }
  render();
  try {
    const res = await fetch('/api/commits', { headers: { accept: 'application/json' } });
    state.commits = res.ok ? await res.json() : { configured: false };
  } catch {
    state.commits = { configured: false };
  }
  renderChart(state.commits);
}

main();
