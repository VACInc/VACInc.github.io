import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupBrowser } from './helpers.mjs';

let env;
before(async () => { env = await setupBrowser(); });
after(async () => { await env?.close(); });

const directives = (csp) => Object.fromEntries(
  csp.split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([k, ...v]) => [k, v]));

test('a restrictive Content-Security-Policy is declared before any resources', async () => {
  const { page, close } = await env.open();
  try {
    const { csp, isFirstInHead } = await page.evaluate(() => {
      const meta = document.querySelector('meta[http-equiv="Content-Security-Policy" i]');
      const firstResource = document.head.querySelector('style, link, script');
      return {
        csp: meta?.content,
        // A meta CSP only applies to content after it.
        isFirstInHead: !!meta && (!firstResource || !!(meta.compareDocumentPosition(firstResource) & Node.DOCUMENT_POSITION_FOLLOWING)),
      };
    });
    assert.ok(csp, 'missing CSP meta tag');
    assert.ok(isFirstInHead, 'CSP meta must precede styles/scripts');
    const d = directives(csp);
    assert.deepEqual(d['default-src'], ["'none'"]);
    assert.ok(!d['script-src'], 'scripts should fall back to default-src none');
    assert.deepEqual(d['base-uri'], ["'none'"]);
    assert.deepEqual(d['form-action'], ["'none'"]);
  } finally {
    await close();
  }
});

test('the CSP blocks injected scripts and does not break the page', async () => {
  const { page, errors, close } = await env.open();
  try {
    await page.waitForLoadState('networkidle');
    assert.deepEqual(errors, [], 'page itself should not trigger CSP violations');

    const blocked = await page.evaluate(() => new Promise((resolve) => {
      document.addEventListener('securitypolicyviolation', (e) => resolve(e.effectiveDirective), { once: true });
      window.__injected = false;
      const s = document.createElement('script');
      s.textContent = 'window.__injected = true';
      document.body.append(s);
      setTimeout(() => resolve(window.__injected ? 'ran' : 'no-event'), 500);
    }));
    assert.equal(blocked, 'script-src-elem');

    // Styling and the same-origin QR image still load.
    assert.ok(await page.$eval('img[src="qr.png"]', (i) => i.naturalWidth > 0));
    assert.notEqual(await page.$eval('.shell', (el) => getComputedStyle(el).borderTopStyle), 'none');
  } finally {
    await close();
  }
});
