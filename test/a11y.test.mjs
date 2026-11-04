import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupBrowser } from './helpers.mjs';

let env;
before(async () => { env = await setupBrowser(); });
after(async () => { await env?.close(); });

test('decorative glyphs are hidden from assistive technology', async () => {
  const { page, close } = await env.open();
  try {
    const tree = await page.locator('body').ariaSnapshot();
    assert.doesNotMatch(tree, /→/, 'arrow glyphs are announced');
    // The giant "VAC" watermark is CSS generated content on .hero::before.
    assert.doesNotMatch(tree, /text: VAC\b/, 'watermark text is announced');
  } finally {
    await close();
  }
});

test('social links have clean accessible names that mention the new tab', async () => {
  const { page, close } = await env.open();
  try {
    for (const name of ['LinkedIn', 'X / Twitter', 'GitHub']) {
      const link = page.getByRole('link', { name: `${name} (opens in new tab)`, exact: true });
      assert.equal(await link.count(), 1, `no link named "${name} (opens in new tab)"`);
      assert.equal(await link.getAttribute('target'), '_blank');
    }
  } finally {
    await close();
  }
});

test('the "opens in new tab" hint is visually hidden', async () => {
  const { page, close } = await env.open();
  try {
    const box = await page.locator('.links .sr-only').first().boundingBox();
    assert.ok(box && box.width <= 1 && box.height <= 1, `hint is visible: ${JSON.stringify(box)}`);
  } finally {
    await close();
  }
});

test('keyboard focus on links shows a visible outline', async () => {
  const { page, close } = await env.open({ reducedMotion: 'reduce' });
  try {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const el = document.activeElement;
      const s = getComputedStyle(el);
      return { cls: el.className, style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    assert.equal(focus.cls, 'link', 'first Tab stop should be a social link');
    assert.notEqual(focus.style, 'none');
    assert.ok(focus.width >= 2, `outline too thin: ${focus.width}px`);
  } finally {
    await close();
  }
});
