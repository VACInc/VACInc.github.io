import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { SITE_URL, setupBrowser } from './helpers.mjs';

let env;
before(async () => { env = await setupBrowser(); });
after(async () => { await env?.close(); });

test('canonical URL and Open Graph tags point at the site URL', async () => {
  const { page, close } = await env.open();
  try {
    const meta = await page.evaluate(() => {
      const get = (sel, attr = 'content') => document.querySelector(sel)?.getAttribute(attr) ?? null;
      return {
        canonical: get('link[rel="canonical"]', 'href'),
        ogUrl: get('meta[property="og:url"]'),
        ogTitle: get('meta[property="og:title"]'),
        ogDescription: get('meta[property="og:description"]'),
        ogType: get('meta[property="og:type"]'),
        twitterCard: get('meta[name="twitter:card"]'),
        description: get('meta[name="description"]'),
      };
    });
    assert.equal(meta.canonical, SITE_URL);
    assert.equal(meta.ogUrl, SITE_URL);
    assert.ok(meta.ogTitle, 'og:title missing');
    assert.equal(meta.ogDescription, meta.description, 'og:description should match description');
    assert.equal(meta.ogType, 'website');
    assert.equal(meta.twitterCard, 'summary');
  } finally {
    await close();
  }
});

test('a same-origin favicon is declared and served', async () => {
  const { page, close } = await env.open();
  try {
    const href = await page.evaluate(() => document.querySelector('link[rel="icon"]')?.href);
    assert.ok(href, 'no <link rel="icon">');
    assert.equal(new URL(href).origin, new URL(page.url()).origin, 'favicon should be same-origin');
    const res = await page.request.get(href);
    assert.equal(res.status(), 200);
    assert.match(res.headers()['content-type'], /^image\//);
    assert.match((await res.text()).trim(), /^<svg[\s>]/);
  } finally {
    await close();
  }
});
