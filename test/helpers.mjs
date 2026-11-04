// Shared test helpers: a tiny static file server for the repo root and a
// Playwright page factory. Serving over HTTP (rather than file://) keeps
// origin-dependent behaviour such as CSP 'self' identical to GitHub Pages.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SITE_URL = 'https://vacinc.github.io/';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

export async function startServer() {
  const server = createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = path.resolve(ROOT, '.' + pathname);
      if (!file.startsWith(ROOT + path.sep)) throw new Error('outside root');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}/`, close: () => new Promise((r) => server.close(r)) };
}

/**
 * Launches Chromium once per test file. Returns helpers to open the page
 * with a given viewport / media emulation and collect console errors.
 */
export async function setupBrowser() {
  const server = await startServer();
  const browser = await chromium.launch();
  return {
    server,
    browser,
    async open({ viewport = { width: 390, height: 844 }, reducedMotion = 'no-preference' } = {}) {
      const context = await browser.newContext({ viewport, reducedMotion });
      const page = await context.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()}`));
      page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
      await page.goto(server.url, { waitUntil: 'load' });
      return { page, errors, close: () => context.close() };
    },
    async close() {
      await browser.close();
      await server.close();
    },
  };
}
