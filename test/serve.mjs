// A tiny static server for the tests. It serves dist/index.html with the same response
// headers Start9 Pages (nginx) adds, so the page is tested under those headers.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.html');
const port = Number(process.env.PORT || 4173);

createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path !== '/' && path !== '/index.html') { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-XSS-Protection': '1; mode=block',
  });
  res.end(readFileSync(file));
}).listen(port, '127.0.0.1', () => console.log(`serving dist/index.html on http://127.0.0.1:${port}`));
