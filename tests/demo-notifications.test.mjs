import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire, Module } from 'node:module';
const require = createRequire(path.resolve('artifacts/api-server/package.json'));
const { build } = require('esbuild');
const result = await build({ entryPoints: ['artifacts/colli/src/lib/demo-notifications.ts'], bundle: true, write: false, platform: 'node', format: 'cjs' });
const mod = new Module(path.resolve('tests/notifications-compiled.cjs'));
mod._compile(result.outputFiles[0].text, path.resolve('tests/notifications-compiled.cjs'));
const { markDemoRead, unreadDemoCount, demoNotificationsSchema } = mod.exports;
const items = [{ id: 'a', title: 'Sample', body: 'Example', kind: 'info', read: false, timestamp: '2026-10-24T00:00:00.000Z' },
  { id: 'b', title: 'Sample two', body: 'Example two', kind: 'warning', read: false, timestamp: '2026-10-24T00:00:00.000Z' }];
test('individual and mark-all actions update the same unread state without altering notification contents', () => {
  const first = markDemoRead(items, 'a');
  assert.equal(unreadDemoCount(first), 1); assert.equal(first[1].read, false);
  const all = markDemoRead(first); assert.equal(unreadDemoCount(all), 0);
  assert.deepEqual(markDemoRead(all), all);
  assert.deepEqual(all.map(({ read, ...rest }) => rest), items.map(({ read, ...rest }) => rest));
  assert.equal(unreadDemoCount(items), 2);
});
test('unknown notification IDs cannot change other items; empty lists have no unread indicator', () => {
  assert.deepEqual(markDemoRead(items, 'missing'), items);
  assert.equal(unreadDemoCount([]), 0);
});
test('malformed notification responses are rejected rather than rendered as healthy empty state', () => {
  assert.equal(demoNotificationsSchema.safeParse(items).success, true);
  for (const invalid of [null, {}, '<html>', [{ ...items[0], kind: 'invented' }], [{ ...items[0], timestamp: 'bad' }]]) {
    assert.equal(demoNotificationsSchema.safeParse(invalid).success, false);
  }
});
