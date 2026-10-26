import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(path.resolve('artifacts/api-server/package.json'));
const { build } = require('esbuild');
const compiled = await build({ entryPoints: ['artifacts/colli/src/lib/brief-reveal.ts'], bundle: true, write: false, platform: 'node', format: 'cjs' });
function fixture(reduced = false) {
  let next = 0;
  const frames = new Map(), listeners = new Set();
  const motion = { matches: reduced, addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn) };
  const context = { module: { exports: {} }, window: { matchMedia: () => motion }, performance: { now: () => 0 },
    requestAnimationFrame: fn => { frames.set(++next, fn); return next; }, cancelAnimationFrame: id => frames.delete(id) };
  vm.runInNewContext(compiled.outputFiles[0].text, context);
  return { api: context.module.exports, frames, listeners,
    tick(time) { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(time)); },
    reduce() { motion.matches = true; [...listeners].forEach(fn => fn()); } };
}
test('one cosmetic 0–100 reveal completes in 1.8 seconds and is not replayed on navigation', () => {
  const f = fixture(), values = []; let completed = 0;
  assert.equal(f.api.shouldRevealBrief(), true);
  f.api.beginBriefReveal(v => values.push(v), () => completed++);
  for (const time of [0, 850, 1700, 1800]) f.tick(time);
  assert.deepEqual(values, [0, 50, 100, 100]); assert.equal(completed, 1);
  assert.equal(f.frames.size, 0); assert.equal(f.listeners.size, 0);
  assert.equal(f.api.shouldRevealBrief(), false);
});
test('leaving the Brief cancels all scheduled work without waiting or completing', () => {
  const f = fixture(); let completed = false;
  const cancel = f.api.beginBriefReveal(() => {}, () => completed = true);
  f.tick(500); cancel(); f.tick(2000);
  assert.equal(completed, false); assert.equal(f.frames.size, 0); assert.equal(f.listeners.size, 0);
  assert.equal(f.api.shouldRevealBrief(), false);
});
test('reduced motion skips the countdown and changing the preference finishes immediately', () => {
  const f = fixture(true); assert.equal(f.api.shouldRevealBrief(), false);
  f.api.rememberBriefVisit(); assert.equal(f.frames.size, 0);
  const active = fixture(); let completed = 0;
  active.api.beginBriefReveal(() => {}, () => completed++); active.reduce();
  assert.equal(completed, 1); assert.equal(active.frames.size, 0); assert.equal(active.listeners.size, 0);
});
test('favicon metadata uses PNG copies of the existing logo and retains Colli title', () => {
  const html = fs.readFileSync('artifacts/colli/index.html', 'utf8');
  assert.match(html, /<title>Colli<\/title>/); assert.doesNotMatch(html, /favicon\.svg|vite\.svg/);
  for (const size of [16, 32]) {
    assert.ok(html.includes(`sizes="${size}x${size}" href="/favicon-${size}.png"`));
    const png = fs.readFileSync(`artifacts/colli/public/favicon-${size}.png`);
    assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
  }
});
