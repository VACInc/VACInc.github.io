import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { SITE_URL, setupBrowser } from './helpers.mjs';

let env;
before(async () => { env = await setupBrowser(); });
after(async () => { await env?.close(); });

// Read back the QR exactly as it is painted on screen (after CSS scaling).
async function renderedQr(page) {
  const png = await page.locator('img[src="qr.png"]').screenshot({ animations: 'disabled' });
  // Decode in a blank page: the site's own CSP (rightly) forbids data: images.
  const scratch = await page.context().newPage();
  try {
    return await scratch.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      return { width: c.width, height: c.height, data: Array.from(data) };
    }, png.toString('base64'));
  } finally {
    await scratch.close();
  }
}

test('the QR as painted on screen scans to the site URL', async () => {
  const { page, close } = await env.open();
  try {
    const { width, height, data } = await renderedQr(page);
    const decoded = jsQR(Uint8ClampedArray.from(data), width, height);
    assert.equal(decoded?.data, SITE_URL);
  } finally {
    await close();
  }
});

test('the QR is scaled without smoothing (crisp module edges)', async () => {
  const { page, close } = await env.open();
  try {
    const { data } = await renderedQr(page);
    let grey = 0;
    for (let i = 0; i < data.length; i += 4) {
      const v = data[i];
      if (v > 40 && v < 215) grey++;
    }
    const ratio = grey / (data.length / 4);
    assert.ok(ratio < 0.01, `${(ratio * 100).toFixed(1)}% of QR pixels are blurred grey`);
  } finally {
    await close();
  }
});
