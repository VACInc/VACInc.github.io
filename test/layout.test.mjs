import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupBrowser } from './helpers.mjs';

let env;
before(async () => { env = await setupBrowser(); });
after(async () => { await env?.close(); });

// Viewports where the card is taller than the screen: small phones,
// landscape phones and short laptop screens.
const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 667, height: 375 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
];

for (const viewport of VIEWPORTS) {
  test(`every part of the card is reachable at ${viewport.width}x${viewport.height}`, async () => {
    const { page, close } = await env.open({ viewport });
    try {
      // Scroll the way a user does (wheel input). overflow:hidden still allows
      // programmatic scrolling, so scrollIntoView() would hide the bug.
      await page.mouse.move(viewport.width / 2, viewport.height / 2);
      await page.mouse.wheel(0, 5000);
      await page.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
      const m = await page.evaluate(() => {
        const r = (sel) => document.querySelector(sel).getBoundingClientRect();
        const de = document.documentElement;
        return {
          innerWidth, innerHeight,
          scrollWidth: de.scrollWidth,
          qrTop: r('.qr-card').top, qrBottom: r('.qr-card').bottom,
        };
      });
      assert.ok(m.qrTop >= 0 && m.qrBottom <= m.innerHeight + 0.5,
        `QR card not fully visible after scrolling: ${JSON.stringify(m)}`);
      assert.ok(m.scrollWidth <= m.innerWidth, `horizontal overflow: ${JSON.stringify(m)}`);

      // The top of the card must also be reachable once we scroll back up.
      await page.mouse.wheel(0, -5000);
      await page.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
      const top = await page.evaluate(() => document.querySelector('.shell').getBoundingClientRect().top);
      assert.ok(top >= 0, 'top of card not reachable');
    } finally {
      await close();
    }
  });
}
