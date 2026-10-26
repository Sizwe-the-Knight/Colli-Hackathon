// Compile-only fixture: no application imports, database calls or listener.
import express, { type RequestHandler } from 'express';
import session, { type SessionData, type Store } from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';

const pool = new Pool();
const PgStore = connectPgSimple(session);
const options: connectPgSimple.PGStoreOptions = {
  pool,
  schemaName: 'auth',
  tableName: 'sessions',
  createTableIfMissing: false,
  pruneSessionInterval: false,
  disableTouch: false,
  ttl: 86400,
  errorLog: (..._errors: unknown[]) => {},
};
const store = new PgStore(options);
const middlewareStore: Store = store;
const middleware: RequestHandler = session({
  store: middlewareStore,
  secret: 'compile-only-fixture-not-a-deployed-secret',
  resave: false,
  saveUninitialized: false,
});
express().use(middleware);

const payload: SessionData = { cookie: new session.Cookie() };
payload.cookie.maxAge = 86400000;
const completed = (error?: unknown): void => { if (error) throw error; };
store.get('fixture', (error: unknown, data?: SessionData | null) => {
  completed(error);
  if (data) store.set('fixture', data, completed);
});
store.set('fixture', payload, completed);
store.touch('fixture', payload, completed);
store.destroy('fixture', completed);
store.pruneSessions(completed);

// Published declarations say void; runtime tests separately establish Promise.
const declaredCloseResult: void = store.close();
void declaredCloseResult;
