// Local preview: serves the page and the /api functions on http://localhost:3000.
// With GITHUB_TOKEN set in your shell, /api/commits and /api/register call GitHub for real.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import commits from '../api/commits.js';
import register from '../api/register.js';
import tests from '../api/tests.js';

const api = { '/api/commits': commits, '/api/register': register, '/api/tests': tests };

const root = fileURLToPath(new URL('..', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT || 3000);

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (api[url.pathname]) {
    const shim = {
      setHeader: (k, v) => res.setHeader(k, v),
      status(code) { res.statusCode = code; return this; },
      json(body) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); },
    };
    req.headers['x-forwarded-proto'] = 'http';
    return api[url.pathname](req, shim);
  }
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = normalize(join(root, rel));
  if (!file.startsWith(root)) { res.statusCode = 403; return res.end(); }
  try {
    const body = await readFile(file);
    res.setHeader('content-type', types[extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
}).listen(port, () => console.log(`Dashboard on http://localhost:${port}`));
