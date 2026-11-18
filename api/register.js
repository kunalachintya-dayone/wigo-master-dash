// GET /api/register
// The live register from wigo-admin: milestones, our items and external items, parsed from the
// markdown files on the branch, plus the commits that record or close each milestone.
//
// Configuration:
//   GITHUB_TOKEN    required. The same read-only token as /api/commits (Contents on wigo-admin).
//   data.json -> register_source: { repo, branch, milestones, followups } names what to read.
//
// The token never reaches the browser. Responses are cached at the edge for 5 minutes.

import { parseMilestones, parseFollowups, closingCommits } from '../lib/register.js';

const DEFAULT_SOURCE = {
  repo: 'kunalachintya-dayone/wigo-admin',
  branch: 'admin-design',
  milestones: 'docs/ADMIN_MILESTONES.md',
  followups: 'docs/FOLLOWUPS_AND_DEPENDENCIES.md',
};

const ghHeaders = (token, raw = false) => ({
  authorization: `Bearer ${token}`,
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
    return (await res.json()).register_source || {};
  } catch {
    return {};
  }
}

async function getJson(url, token) {
  const res = await fetch(url, { headers: ghHeaders(token) });
  if (!res.ok) throw new Error(`${new URL(url).pathname}: GitHub answered ${res.status}`);
  return res.json();
}

async function getFile(src, path, ref, token) {
  const url = `https://api.github.com/repos/${src.repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(url, { headers: ghHeaders(token, true) });
  if (!res.ok) throw new Error(`${path}: GitHub answered ${res.status}`);
  return res.text();
}

export default async function handler(req, res) {
  res.setHeader('cache-control', 'public, s-maxage=300, stale-while-revalidate=1800');
  const token = process.env.GITHUB_TOKEN;
  const src = { ...DEFAULT_SOURCE, ...(await readSourceConfig(req)) };
  if (!token) {
    res.status(200).json({ configured: false, repo: src.repo, branch: src.branch });
    return;
  }
  try {
    // Pin both files to one commit so the two documents are always read at the same point in time.
    const head = await getJson(`https://api.github.com/repos/${src.repo}/commits/${encodeURIComponent(src.branch)}`, token);
    const sha = head.sha;
    const [msText, fuText, history] = await Promise.all([
      getFile(src, src.milestones, sha, token),
      getFile(src, src.followups, sha, token),
      getJson(`https://api.github.com/repos/${src.repo}/commits?sha=${sha}&per_page=100`, token),
    ]);
    const milestones = parseMilestones(msText);
    const { ours, external } = parseFollowups(fuText);
    if (!milestones.length || !ours.length) throw new Error('The register files had no milestone or item tables');
    res.status(200).json({
      configured: true,
      source: {
        repo: src.repo,
        branch: src.branch,
        sha,
        short: sha.slice(0, 7),
        url: head.html_url,
        date: head.commit && head.commit.committer && head.commit.committer.date,
        files: [src.milestones, src.followups],
      },
      fetched_at: new Date().toISOString(),
      milestones,
      ours,
      external,
      closing: closingCommits(history),
    });
  } catch (err) {
    res.setHeader('cache-control', 'no-store');
    res.status(200).json({ configured: true, repo: src.repo, branch: src.branch, error: String(err.message || err) });
  }
}
