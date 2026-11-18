// Live test results from wigo-admin. The "Test results" workflow in wigo-admin runs the suites on
// every push and writes results/<branch>.json to its test-results branch: one row per test file
// with tests, passed, failed and skipped. Here those files are grouped into the areas named in
// data.json -> testing.areas, so a new test file only needs a pattern there, never a code change.
// Files that match no area land in "Other", so nothing is silently dropped.

/** Turn a pattern like "server/src/__tests__/agent-*" or "web/*" into a RegExp over the file path. */
export function globToRegExp(glob) {
  const esc = String(glob).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`(^|/)${esc}$`);
}

/** The first area whose patterns match the file. A pattern without "/" matches the file's stem. */
export function areaFor(file, areas) {
  const path = String(file);
  const stem = path.split('/').pop().replace(/\.test\.[cm]?[jt]sx?$/, '');
  for (const a of areas || []) {
    for (const p of a.match || []) {
      if (p.includes('/') ? globToRegExp(p).test(path) : globToRegExp(p).test(stem)) return a.area;
    }
  }
  return 'Other';
}

const n = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

/** Group per-file results into suites shaped like data.json -> testing.suites. */
export function groupResults(results, areas) {
  const order = (areas || []).map((a) => a.area);
  const day = results && results.generated_at ? results.generated_at.slice(0, 10) : null;
  const evidence = (results && (results.run_url || (results.repo && results.sha ? `https://github.com/${results.repo}/commit/${results.sha}` : null))) || null;
  const map = new Map();
  for (const f of (results && results.files) || []) {
    const area = areaFor(f.file, areas);
    if (!map.has(area)) map.set(area, { area, written: 0, executed: 0, passed: 0, skipped: 0, load_errors: 0, files: 0 });
    const s = map.get(area);
    s.files += 1;
    s.written += n(f.tests);
    s.passed += n(f.passed);
    s.executed += n(f.passed) + n(f.failed);
    s.skipped += n(f.skipped);
    if (f.load_error) s.load_errors += 1;
  }
  const rank = (a) => (order.indexOf(a) === -1 ? order.length : order.indexOf(a));
  return [...map.values()]
    .sort((a, b) => rank(a.area) - rank(b.area))
    .map((s) => {
      const notes = [];
      if (s.skipped) notes.push(`${s.skipped} skipped`);
      if (s.load_errors) notes.push(`${s.load_errors} test file${s.load_errors > 1 ? 's' : ''} failed to load`);
      if (s.area === 'Other') notes.push('Test files with no area: add a pattern to testing.areas in data.json');
      const area = (areas || []).find((a) => a.area === s.area);
      if (area && area.note && s.skipped) notes.push(area.note);
      return {
        area: s.area,
        written: s.written,
        executed: s.executed,
        passed: s.passed,
        updated_on: day,
        evidence,
        note: notes.length ? notes.join('. ') + '.' : undefined,
        files: s.files,
      };
    });
}

/** Replace data.json's suites with the live ones; bugs and everything else stay as written. */
export function mergeTesting(testing, results) {
  if (!results || !Array.isArray(results.files) || !results.files.length) return testing;
  const base = testing || {};
  const short = results.sha ? results.sha.slice(0, 7) : null;
  const t = results.totals || {};
  const when = results.generated_at ? results.generated_at.replace('T', ' ').slice(0, 16) + ' UTC' : 'unknown time';
  return {
    ...base,
    suites: groupResults(results, base.areas),
    note: `Live: automated run on wigo-admin ${results.branch || ''}${short ? ` at ${short}` : ''}, ${when}. ${n(t.tests)} tests in ${n(t.files)} files. Bugs are logged by hand.`,
    live: { branch: results.branch, sha: results.sha, run_url: results.run_url, generated_at: results.generated_at },
  };
}
