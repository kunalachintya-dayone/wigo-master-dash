// Local preview: serves the page and a stub /api/commits on http://localhost:3000.
// With GITHUB_TOKEN set in your shell, /api/commits calls GitHub for real.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import handler from '../api/commits.js';

const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT || 3000);

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/commits') {
    const shim = {
      setHeader: (k, v) => res.setHeader(k, v),
      status(code) { res.statusCode = code; return this; },
      json(body) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); },
    };
    req.headers['x-forwarded-proto'] = 'http';
    return handler(req, shim);
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
