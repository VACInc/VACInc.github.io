import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './helpers.mjs';

// Properties that still need a -webkit- twin for browsers the page targets:
// backdrop-filter (Safari < 18, i.e. iOS 17 and older) and
// mask-image (Safari < 15.4, Chromium < 120).
const NEEDS_PREFIX = ['backdrop-filter', 'mask-image'];

const declarations = (css) => [...css.matchAll(/(?<![\w-])(-webkit-)?([a-z-]+)\s*:\s*([^;{}]+);/g)]
  .map(([, prefix, prop, value]) => ({ prefixed: !!prefix, prop, value: value.trim().replace(/\s+/g, ' ') }));

test('properties that need a -webkit- prefix declare it with the same value', async () => {
  const html = await readFile(path.join(ROOT, 'index.html'), 'utf8');
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  const decls = declarations(css);
  for (const prop of NEEDS_PREFIX) {
    const plain = decls.filter((d) => !d.prefixed && d.prop === prop);
    const prefixed = decls.filter((d) => d.prefixed && d.prop === prop);
    for (const d of plain) {
      assert.ok(prefixed.some((p) => p.value === d.value), `${prop}: ${d.value} has no matching -webkit-${prop}`);
    }
  }
});
