import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { HtmlValidate, FileSystemConfigLoader } from 'html-validate';
import jsQR from 'jsqr';
import { ROOT, SITE_URL, setupBrowser } from './helpers.mjs';

let env;
before(async () => { env = await setupBrowser(); });
after(async () => { await env?.close(); });

test('index.html passes html-validate', async () => {
  const validator = new HtmlValidate(new FileSystemConfigLoader());
  const report = await validator.validateFile(path.join(ROOT, 'index.html'));
  const messages = report.results.flatMap((r) => r.messages.map((m) => `${m.line}:${m.column} ${m.ruleId} ${m.message}`));
  assert.equal(report.valid, true, messages.join('\n'));
});

test('qr.png decodes to the canonical site URL and matches its alt text', async () => {
  const { page, close } = await env.open();
  try {
    // Decode the pixels the browser actually renders (handles any PNG flavour
    // the browser does), padded with a white quiet zone for the decoder.
    const { width, height, data, alt } = await page.evaluate(async () => {
      const img = new Image();
      img.src = 'qr.png';
      await img.decode();
      const pad = 16;
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth + pad * 2;
      canvas.height = img.naturalHeight + pad * 2;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, pad, pad);
      const px = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return {
        width: px.width,
        height: px.height,
        data: Array.from(px.data),
        alt: document.querySelector('img[src="qr.png"]')?.getAttribute('alt'),
      };
    });
    const decoded = jsQR(Uint8ClampedArray.from(data), width, height);
    assert.ok(decoded, 'qr.png did not decode as a QR code');
    assert.equal(decoded.data, SITE_URL);
    assert.ok(alt?.includes(decoded.data), `alt text "${alt}" does not mention ${decoded.data}`);
  } finally {
    await close();
  }
});

test('external links are https and new-tab links use rel=noopener', async () => {
  const { page, close } = await env.open();
  try {
    const links = await page.$$eval('a[href]', (as) => as.map((a) => ({
      href: a.getAttribute('href'), target: a.getAttribute('target'), rel: (a.getAttribute('rel') || '').split(/\s+/),
    })));
    assert.ok(links.length > 0);
    for (const l of links) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(l.href)) assert.match(l.href, /^https:\/\//, `non-https link ${l.href}`);
      if (l.target === '_blank') assert.ok(l.rel.includes('noopener') || l.rel.includes('noreferrer'), `${l.href} missing noopener`);
    }
  } finally {
    await close();
  }
});

test('page loads with no console errors or failed requests', async () => {
  const { page, errors, close } = await env.open();
  try {
    await page.waitForLoadState('networkidle');
    assert.ok(await page.$eval('img[src="qr.png"]', (img) => img.complete && img.naturalWidth > 0), 'QR image failed to load');
    assert.deepEqual(errors, []);
  } finally {
    await close();
  }
});
