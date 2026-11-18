// GET /api/commits
// Commits per person per day and releases per person for the last 7 days (India time), read from the GitHub API.
//
// Configuration (Vercel project environment variables):
//   GITHUB_TOKEN   required. A fine-grained token with read-only "Contents" access to the repos.
//   GITHUB_REPOS   optional. Comma-separated "owner/repo" or "owner/repo@branch".
//                  Falls back to data.json -> github.repos.
//   AUTHOR_MAP     optional. JSON object mapping a GitHub login, email or commit name to a person.
//                  Merged over data.json -> github.authors.
//
// The token never reaches the browser. Responses are cached at the edge for 15 minutes.

const TZ = 'Asia/Kolkata';
const DAYS = 7;
const MAX_PAGES = 5;

const dayKey = (date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

export function lastDays(now = new Date(), n = DAYS) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(new Date(now.getTime() - i * 86400000)));
  return out;
}

export function parseRepo(spec) {
  const [repo, branch] = spec.trim().split('@');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
  return { repo, branch: branch || null };
}

export function personFor(commit, authors) {
  const keys = [
    commit.author && commit.author.login,
    commit.commit && commit.commit.author && commit.commit.author.email,
    commit.commit && commit.commit.author && commit.commit.author.name,
  ].filter(Boolean);
  for (const k of keys) {
    if (authors[k]) return authors[k];
    const lower = Object.keys(authors).find((a) => a.toLowerCase() === String(k).toLowerCase());
    if (lower) return authors[lower];
  }
  return keys[0] || 'Unknown';
}

/** Group commits into { days, people: [{ name, counts }] }. Pure, so it is unit tested. */
export function tally(commits, authors, days) {
  const seen = new Set();
  const byPerson = new Map();
  for (const c of commits) {
    if (!c || seen.has(c.sha)) continue;
    seen.add(c.sha);
    const when = c.commit && c.commit.author && c.commit.author.date;
    if (!when) continue;
    const idx = days.indexOf(dayKey(new Date(when)));
    if (idx === -1) continue;
    const name = personFor(c, authors);
    if (!byPerson.has(name)) byPerson.set(name, new Array(days.length).fill(0));
    byPerson.get(name)[idx] += 1;
  }
  const people = [...byPerson.entries()]
    .map(([name, counts]) => ({ name, counts }))
    .sort((a, b) => b.counts.reduce((x, y) => x + y, 0) - a.counts.reduce((x, y) => x + y, 0));
  return { days, people };
}

/** Releases published inside the window, newest first, with the person who published them. */
export function weeklyReleases(releases, authors, days) {
  const first = days[0];
  const out = [];
  const seen = new Set();
  for (const r of releases) {
    if (!r || r.draft || seen.has(r.id ?? r.html_url)) continue;
    seen.add(r.id ?? r.html_url);
    const when = r.published_at || r.created_at;
    if (!when || dayKey(new Date(when)) < first) continue;
    out.push({
      repo: r.repo,
      tag: r.tag_name,
      name: r.name || r.tag_name,
      url: r.html_url,
      published_at: when,
      prerelease: !!r.prerelease,
      person: personFor({ author: r.author }, authors),
    });
  }
  return out.sort((a, b) => (a.published_at < b.published_at ? 1 : -1));
}

/** Weekly totals per person: commits and releases. */
export function weekly(people, releases) {
  const map = new Map(people.map((p) => [p.name, { name: p.name, commits: p.counts.reduce((a, b) => a + b, 0), releases: 0 }]));
  for (const r of releases) {
    if (!map.has(r.person)) map.set(r.person, { name: r.person, commits: 0, releases: 0 });
    map.get(r.person).releases += 1;
  }
  return [...map.values()].sort((a, b) => b.commits + b.releases - (a.commits + a.releases));
}

async function readDataConfig(req) {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const res = await fetch(`${proto}://${host}/data.json`);
    if (!res.ok) return {};
    const data = await res.json();
    return data.github || {};
  } catch {
    return {};
  }
}

const ghHeaders = (token) => ({
  authorization: `Bearer ${token}`,
  accept: 'application/vnd.github+json',
  'x-github-api-version': '2022-11-28',
  'user-agent': 'wigo-build-dashboard',
});

async function fetchReleases(repo, token) {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=30`, { headers: ghHeaders(token) });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`${repo} releases: GitHub answered ${res.status}`);
  return (await res.json()).map((r) => ({ ...r, repo }));
}

async function fetchCommits({ repo, branch }, since, token) {
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(`https://api.github.com/repos/${repo}/commits`);
    url.searchParams.set('since', since.toISOString());
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));
    if (branch) url.searchParams.set('sha', branch);
    const res = await fetch(url, { headers: ghHeaders(token) });
    if (!res.ok) throw new Error(`${repo}${branch ? '@' + branch : ''}: GitHub answered ${res.status}`);
    const batch = await res.json();
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader('cache-control', 'public, s-maxage=900, stale-while-revalidate=3600');
  const token = process.env.GITHUB_TOKEN;
  const cfg = await readDataConfig(req);
  const repoSpecs = (process.env.GITHUB_REPOS ? process.env.GITHUB_REPOS.split(',') : cfg.repos || [])
    .map(parseRepo)
    .filter(Boolean);
  let authors = { ...(cfg.authors || {}) };
  if (process.env.AUTHOR_MAP) {
    try {
      authors = { ...authors, ...JSON.parse(process.env.AUTHOR_MAP) };
    } catch {
      /* ignore a malformed map */
    }
  }

  const repos = repoSpecs.map((r) => (r.branch ? `${r.repo}@${r.branch}` : r.repo));
  if (!token || !repoSpecs.length) {
    res.status(200).json({ configured: false, repos });
    return;
  }

  const now = new Date();
  const days = lastDays(now);
  const since = new Date(now.getTime() - (DAYS + 1) * 86400000);
  try {
    const uniqueRepos = [...new Set(repoSpecs.map((r) => r.repo))];
    const [lists, releaseLists] = await Promise.all([
      Promise.all(repoSpecs.map((r) => fetchCommits(r, since, token))),
      Promise.all(uniqueRepos.map((r) => fetchReleases(r, token))),
    ]);
    const counts = tally(lists.flat(), authors, days);
    const releases = weeklyReleases(releaseLists.flat(), authors, days);
    res.status(200).json({
      configured: true,
      repos,
      generated_at: now.toISOString(),
      ...counts,
      releases,
      weekly: weekly(counts.people, releases),
    });
  } catch (err) {
    res.setHeader('cache-control', 'no-store');
    res.status(200).json({ configured: true, repos, error: String(err.message || err) });
  }
}
