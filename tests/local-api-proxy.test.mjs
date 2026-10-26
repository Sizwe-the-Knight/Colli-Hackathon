import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import { EventEmitter } from 'node:events';
import path from 'node:path';
const require = createRequire(path.resolve('artifacts/api-server/package.json'));
const { build } = require('esbuild');
const result = await build({ entryPoints: ['artifacts/colli/local-api-proxy.ts'], bundle: true, write: false, platform: 'node', format: 'cjs' });
const compiled = new Module(path.resolve('tests/proxy-in-memory.cjs'));
compiled._compile(result.outputFiles[0].text, compiled.id);
const { localApiProxy } = compiled.exports;

test('proxy is opt-in and allows only a distinct numeric loopback port', () => {
  assert.equal(localApiProxy(undefined, 5173), undefined);
  for (const invalid of ['', '0', '-1', '65536', '5173', '3001.5', 'http://example.invalid', '3001/path']) {
    assert.throws(() => localApiProxy(invalid, 5173));
  }
  const [pattern, options] = Object.entries(localApiProxy('3001', 5173))[0];
  assert.equal(options.target, 'http://127.0.0.1:3001');
  assert.equal(options.proxyTimeout, 5000);
  const matcher = new RegExp(pattern);
  for (const url of ['/api', '/api?x=1', '/api/auth/me']) assert.ok(matcher.test(url));
  for (const url of ['/login', '/brief', '/apiary', '/assets/main.js']) assert.ok(!matcher.test(url));
});

test('connection and timeout errors finish with JSON 503, not SPA HTML', () => {
  const options = Object.values(localApiProxy('3001', 5173))[0];
  for (const code of ['ECONNREFUSED', 'ETIMEDOUT']) {
    const proxy = new EventEmitter();
    options.configure(proxy);
    let status, headers, body;
    const response = { headersSent: false, writableEnded: false,
      writeHead(s, h) { status = s; headers = h; this.headersSent = true; },
      end(b) { body = b; this.writableEnded = true; },
    };
    proxy.emit('error', Object.assign(new Error('fixture'), { code }), {}, response);
    assert.equal(status, 503);
    assert.match(headers['Content-Type'], /^application\/json/);
    assert.equal(headers['Cache-Control'], 'no-store');
    assert.deepEqual(JSON.parse(body), { error: 'Local API unavailable. Please try again.' });
    // A repeated error must not attempt a second response.
    proxy.emit('error', new Error('again'), {}, response);
  }
});
