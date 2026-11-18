// GET /api/tests
// The latest test results for wigo-admin, written by its "Test results" workflow to the
// test-results branch. Configuration: GITHUB_TOKEN (read-only Contents on wigo-admin) and
// data.json -> testing.source { repo, branch, path }.

const DEFAULT_SOURCE = {
  repo: 'kunalachintya-dayone/wigo-admin',
  branch: 'test-results',
  path: 'results/admin-design.json',
};

async function readSourceConfig(req) {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const res = await fetch(`${proto}://${host}/data.json`);
    if (!res.ok) return {};
    const data = await res.json();
    return (data.testing && data.testing.source) || {};
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  res.setHeader('cache-control', 'public, s-maxage=300, stale-while-revalidate=1800');
  const token = process.env.GITHUB_TOKEN;
  const src = { ...DEFAULT_SOURCE, ...(await readSourceConfig(req)) };
  if (!token) {
    res.status(200).json({ configured: false, ...src });
    return;
  }
  try {
    const url = `https://api.github.com/repos/${src.repo}/contents/${encodeURI(src.path)}?ref=${encodeURIComponent(src.branch)}`;
    const gh = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github.raw+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'wigo-progress-dashboard',
      },
    });
    if (gh.status === 404) {
      res.setHeader('cache-control', 'public, s-maxage=60');
      res.status(200).json({ configured: true, ...src, error: 'No published results yet. The wigo-admin Test results workflow has not run on this branch.' });
      return;
    }
    if (!gh.ok) throw new Error(`GitHub answered ${gh.status}`);
    const results = JSON.parse(await gh.text());
    res.status(200).json({ configured: true, source: src, results });
  } catch (err) {
    res.setHeader('cache-control', 'no-store');
    res.status(200).json({ configured: true, ...src, error: String(err.message || err) });
  }
}
