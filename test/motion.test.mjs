import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setupBrowser } from './helpers.mjs';

let env;
before(async () => { env = await setupBrowser(); });
after(async () => { await env?.close(); });

const running = (page) => page.evaluate(() =>
  document.getAnimations()
    .filter((a) => a.playState === 'running')
    .map((a) => `${a.effect?.pseudoElement ?? 'body'} ${a.animationName ?? a.constructor.name}`));

test('background animates when the user has no motion preference', async () => {
  const { page, close } = await env.open({ reducedMotion: 'no-preference' });
  try {
    assert.ok((await running(page)).length > 0, 'expected the decorative animations to run');
  } finally {
    await close();
  }
});

test('no animations run when the user prefers reduced motion', async () => {
  const { page, close } = await env.open({ reducedMotion: 'reduce' });
  try {
    assert.deepEqual(await running(page), []);
  } finally {
    await close();
  }
});

test('hovering a link does not move it when the user prefers reduced motion', async () => {
  const { page, close } = await env.open({ reducedMotion: 'reduce' });
  try {
    const link = page.locator('.links a').first();
    await link.hover();
    assert.equal(await link.evaluate((el) => getComputedStyle(el).transform), 'none');
  } finally {
    await close();
  }
});
