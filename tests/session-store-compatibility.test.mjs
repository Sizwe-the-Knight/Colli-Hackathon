import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';

const apiRequire = createRequire(path.resolve('artifacts/api-server/package.json'));
const dbRequire = createRequire(path.resolve('lib/db/package.json'));
const express = apiRequire('express');
const session = apiRequire('express-session');
const connectPgSimple = apiRequire('connect-pg-simple');
const { Pool } = dbRequire('pg');
const PgStore = connectPgSimple(session);

function fixture(t, { disableTouch = false } = {}) {
  // A real pg Pool, but both acquisition and SQL are intercepted. No database
  // configuration, application DB module, network listener or connection is used.
  const pool = new Pool();
  t.mock.method(pool, 'connect', () => { throw new Error('Real connection forbidden'); });
  const calls = [];
  let rows = [];
  let failure;
  t.mock.method(pool, 'query', async (sql, params) => {
    calls.push({ sql, params });
    if (failure) throw failure;
    assert.doesNotMatch(sql, /CREATE|ALTER|to_regclass/i);
    return { rows };
  });
  const store = new PgStore({
    pool, schemaName: 'compatibility', tableName: 'sessions',
    createTableIfMissing: false, pruneSessionInterval: false,
    disableTouch, ttl: 86400,
    errorLog: () => { throw new Error('Unexpected store log'); },
  });
  t.after(async () => { await store.close(); await pool.end(); });
  return {
    pool, store, calls,
    rows: value => { rows = value; },
    fail: value => { failure = value; },
  };
}

const payload = () => ({ cookie: new session.Cookie({ maxAge: 86400000 }), userId: 1 });
const invoke = (store, method, ...args) => new Promise((resolve, reject) => {
  store[method](...args, (error, value) => error ? reject(error) : resolve(value));
});

test('pinned package versions reuse the existing pg runtime', () => {
  assert.equal(apiRequire('connect-pg-simple/package.json').version, '10.0.0');
  assert.equal(apiRequire('@types/connect-pg-simple/package.json').version, '7.0.3');
  assert.equal(apiRequire('express/package.json').version, '5.2.1');
  assert.equal(apiRequire('express-session/package.json').version, '1.19.0');
  assert.equal(dbRequire('pg/package.json').version, '8.22.0');
  const storeRequire = createRequire(apiRequire.resolve('connect-pg-simple'));
  assert.equal(storeRequire('pg').Pool, Pool);
});

test('constructor and Express 5 middleware registration perform no SQL or connection', t => {
  const f = fixture(t);
  assert.ok(f.store instanceof session.Store);
  const middleware = session({
    store: f.store, secret: 'offline-test-only-not-a-deployed-secret',
    resave: false, saveUninitialized: false,
  });
  express().use(middleware);
  assert.equal(f.calls.length, 0);
  assert.equal(f.pool.connect.mock.callCount(), 0);
});

test('real session middleware can generate, save, regenerate and destroy with mocked SQL', async t => {
  const f = fixture(t);
  const middleware = session({
    store: f.store, secret: 'offline-test-only-not-a-deployed-secret',
    resave: false, saveUninitialized: false,
  });
  const socket = new Socket(); // Unconnected, never opened or listened on.
  t.after(() => socket.destroy());
  const req = new IncomingMessage(socket);
  req.url = '/fixture';
  req.method = 'GET';
  const res = new ServerResponse(req);
  await new Promise((resolve, reject) => middleware(req, res, e => e ? reject(e) : resolve()));
  req.session.userId = 1;
  await new Promise((resolve, reject) => req.session.save(e => e ? reject(e) : resolve()));
  const oldId = req.sessionID;
  await new Promise((resolve, reject) => req.session.regenerate(e => e ? reject(e) : resolve()));
  assert.notEqual(req.sessionID, oldId);
  await new Promise((resolve, reject) => req.session.destroy(e => e ? reject(e) : resolve()));
  assert.deepEqual(f.calls.map(c => c.sql.split(' ')[0]), ['INSERT', 'DELETE', 'DELETE']);
  assert.equal(f.pool.connect.mock.callCount(), 0);
});

test('get/set/touch/destroy/prune use the selected table without table creation', async t => {
  const f = fixture(t);
  const data = payload();
  await invoke(f.store, 'set', 'fixture-sid', data);
  f.rows([{ sess: data }]);
  assert.deepEqual(await invoke(f.store, 'get', 'fixture-sid'), data);
  await invoke(f.store, 'touch', 'fixture-sid', data);
  await invoke(f.store, 'destroy', 'fixture-sid');
  await invoke(f.store, 'pruneSessions');
  assert.deepEqual(f.calls.map(c => c.sql.split(' ')[0]), ['INSERT', 'SELECT', 'UPDATE', 'DELETE', 'DELETE']);
  for (const { sql } of f.calls) assert.ok(sql.includes('"compatibility"."sessions"'));
  assert.equal(f.calls[0].params[1], Math.ceil(data.cookie.expires.getTime() / 1000));
  assert.equal(f.pool.connect.mock.callCount(), 0);
});

test('missing sessions return no identity; query failures reach every callback', async t => {
  const f = fixture(t);
  assert.equal(await invoke(f.store, 'get', 'missing'), undefined);
  const failure = new Error('Synthetic store failure');
  f.fail(failure);
  for (const [method, args] of [
    ['get', ['fixture']], ['set', ['fixture', payload()]],
    ['touch', ['fixture', payload()]], ['destroy', ['fixture']], ['pruneSessions', []],
  ]) {
    await assert.rejects(invoke(f.store, method, ...args), error => error === failure);
  }
  // touch's runtime error callback is richer than its published () => void type.
  assert.equal(f.pool.connect.mock.callCount(), 0);
});

test('disableTouch prevents writes and close returns a Promise without ending a shared pool', async t => {
  const f = fixture(t, { disableTouch: true });
  await invoke(f.store, 'touch', 'fixture', payload());
  assert.equal(f.calls.length, 0);
  const closing = f.store.close();
  assert.ok(closing instanceof Promise); // Published declarations say void.
  await closing;
  assert.equal(f.pool.ended, false);
});
