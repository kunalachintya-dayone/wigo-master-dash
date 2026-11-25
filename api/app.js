// GET /api/app
// Shiva's rider app progress, read live from the WIGOAPP repo: the build status in README.md plus the
// latest commits on the branch.
//
// Configuration:
//   WIGOAPP_TOKEN  required. A fine-grained token with read-only Contents on Shivadevdayone/WIGOAPP
//                  (a private repo). GITHUB_TOKEN is Kunal's and cannot see it, so it is not used.
//   data.json -> app_source: { repo, branch, file } names what to read.
//
// Responses are cached at the edge for 5 minutes.

import { parseReadme, recentCommits, mergeBranchCommits } from '../lib/app.js';

const MAX_BRANCHES = 10;

const DEFAULT_SOURCE = { repo: 'Shivadevdayone/WIGOAPP', branch: 'main', file: 'README.md' };

const ghHeaders = (token, raw = false) => ({
  ...(token ? { authorization: `Bearer ${token}` } : {}),
  accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
  'x-github-api-version': '2022-11-28',
  'user-agent': 'wigo-progress-dashboard',
});

async function readSourceConfig(req) {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const res = await fetch(`${proto}://${host}/data.json`);
    if (!res.ok) return {};
    return (await res.json()).app_source || {};
  } catch {
    return {};
  }
}

async function getJson(url, token) {
  const res = await fetch(url, { headers: ghHeaders(token) });
  if (!res.ok) throw new Error(`${new URL(url).pathname}: GitHub answered ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('cache-control', 'public, s-maxage=300, stale-while-revalidate=1800');
  const token = process.env.WIGOAPP_TOKEN;
  const src = { ...DEFAULT_SOURCE, ...(await readSourceConfig(req)) };
  if (!token) {
    res.status(200).json({ configured: false, repo: src.repo, branch: src.branch });
    return;
  }
  try {
    const head = await getJson(`https://api.github.com/repos/${src.repo}/commits/${encodeURIComponent(src.branch)}`, token);
    const sha = head.sha;
    const fileUrl = `https://api.github.com/repos/${src.repo}/contents/${encodeURI(src.file)}?ref=${sha}`;
    const [fileRes, history, branches] = await Promise.all([
      fetch(fileUrl, { headers: ghHeaders(token, true) }),
      getJson(`https://api.github.com/repos/${src.repo}/commits?sha=${sha}&per_page=30`, token),
      getJson(`https://api.github.com/repos/${src.repo}/branches?per_page=100`, token).catch(() => []),
    ]);
    if (!fileRes.ok) throw new Error(`${src.file}: GitHub answered ${fileRes.status}`);
    const { units, open } = parseReadme(await fileRes.text());
    if (!units.length) throw new Error('The README had no workflow counts or adapter table');
    // Work often lands on feature branches before it reaches the main branch, so recent commits and
    // "last updated" come from every branch, while the build status stays the main branch's README.
    const others = (Array.isArray(branches) ? branches : []).map((b) => b.name).filter((n) => n && n !== src.branch).slice(0, MAX_BRANCHES);
    const otherLists = await Promise.all(
      others.map((name) =>
        getJson(`https://api.github.com/repos/${src.repo}/commits?sha=${encodeURIComponent(name)}&per_page=30`, token)
          .then((commits) => ({ branch: name, commits }))
          .catch(() => ({ branch: name, commits: [] }))
      )
    );
    const merged = mergeBranchCommits([{ branch: src.branch, commits: history }, ...otherLists]);
    const newest = merged[0] || null;
    const latest = newest
      ? { branch: newest.branch, sha: newest.sha, short: newest.sha.slice(0, 7), url: newest.html_url, date: (newest.commit.committer && newest.commit.committer.date) || newest.commit.author.date }
      : null;
    res.status(200).json({
      configured: true,
      source: {
        repo: src.repo,
        branch: src.branch,
        file: src.file,
        sha,
        short: sha.slice(0, 7),
        url: head.html_url,
        date: head.commit && head.commit.committer && head.commit.committer.date,
      },
      latest,
      branches: [src.branch, ...others],
      fetched_at: new Date().toISOString(),
      units,
      open,
      recent: recentCommits(merged),
    });
  } catch (err) {
    res.setHeader('cache-control', 'no-store');
    res.status(200).json({ configured: true, repo: src.repo, branch: src.branch, error: String(err.message || err) });
  }
}
