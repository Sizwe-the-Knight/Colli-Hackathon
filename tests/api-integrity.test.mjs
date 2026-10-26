import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import path from 'node:path';

// Compile in memory using existing dependencies; no server, network or output files.
const root = process.cwd();
const require = createRequire(path.join(root, 'artifacts/api-server/package.json'));
const { build } = require('esbuild');
const result = await build({
  stdin: { contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import App from './artifacts/colli/src/App';
    import { Brief } from './artifacts/colli/src/pages/brief';
    import { processUsage } from './artifacts/api-server/src/operational/usage';
    import demo from './scripts/fixtures/usage-synthetic.json';
    export const exampleReport = () => processUsage(demo);
    export const emptyReport = () => processUsage({...demo, records: []});
    export * from './lib/api-client-react/src/custom-fetch';
    export { getMe, login, getDashboardSummary } from './lib/api-client-react/src/generated/api';
    export { fixture } from 'test-fixture';
    export const renderApp = () => renderToStaticMarkup(<App />);
    export const renderBrief = () => renderToStaticMarkup(<Brief />);
  `, resolveDir: root, loader: 'tsx' },
  loader: { '.css': 'empty' }, bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'transform',
  nodePaths: [path.join(root, 'artifacts/colli/node_modules')],
  define: { 'import.meta.env.BASE_URL': '"/"' },
  plugins: [{ name: 'offline-ui-fixtures', setup(b) {
    b.onResolve({ filter: /^test-fixture$/ }, () => ({ path: 'fixture', namespace: 'test' }));
    b.onLoad({ filter: /^fixture$/, namespace: 'test' }, () => ({ contents: 'export const fixture = { auth: {}, summary: {}, route: "/login" };' }));
    b.onResolve({ filter: /^@workspace\/api-client-react$/ }, () => ({ path: 'api', namespace: 'test' }));
    b.onLoad({ filter: /^api$/, namespace: 'test' }, () => ({ contents: `
      import { fixture } from 'test-fixture';
      export * from './lib/api-client-react/src/custom-fetch';
      export * from './lib/api-client-react/src/response-validation';
      export * from './lib/api-client-react/src/operational-brief';
      export const useGetMe = () => ({ isLoading: false, refetch() {}, ...fixture.auth });
      export const useGetDashboardSummary = () => ({ isLoading: false, refetch() {}, ...fixture.summary });
    `, resolveDir: root }));
    b.onResolve({ filter: /^@tanstack\/react-query$/ }, () => ({ path: 'query', namespace: 'test' }));
    b.onLoad({ filter: /^query$/, namespace: 'test' }, () => ({ contents: `import { fixture } from 'test-fixture'; export const useQuery = () => ({isLoading:false, refetch(){}, ...fixture.summary}); export const useMutation = () => ({}); export const QueryClient = class {}; export const QueryClientProvider=({children})=>children;` }));
    b.onResolve({ filter: /^@\/lib\/operational-brief$/ }, () => ({ path: path.join(root, 'artifacts/colli/src/lib/operational-brief.ts') }));
    b.onResolve({ filter: /^wouter$/ }, () => ({ path: 'router', namespace: 'test' }));
    b.onLoad({ filter: /^router$/, namespace: 'test' }, () => ({ contents: `
      import { fixture } from 'test-fixture';
      import React from 'react';
      export const Link = ({href,children,...props}) => React.createElement('a',{href,...props},children);
      export const useLocation = () => [fixture.route, () => {}];
      export const Router = ({children}) => children;
      export const Switch = ({children}) => children;
      export const Route = ({path, children}) => path === fixture.route ? children : null;
    `, resolveDir: root }));
    b.onResolve({ filter: /^@\/lib\/context$/ }, () => ({ path: 'context', namespace: 'test' }));
    b.onLoad({ filter: /^context$/, namespace: 'test' }, () => ({ contents: 'export const AppProvider = ({children}) => children; export const useAppContext = () => ({setUser() {}});' }));
    b.onResolve({ filter: /^@\/(pages|components)\// }, args => {
      if (args.path === '@/components/api-unavailable') return { path: path.join(root, 'artifacts/colli/src/components/api-unavailable.tsx') };
      return { path: args.path, namespace: 'stub' };
    });
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: `
      export default () => 'Not found';
      export const Login = () => 'LOGIN FORM'; export const Register = () => 'REGISTER FORM';
      export const Brief = () => 'BRIEF'; export const Dashboard = () => 'DASHBOARD';
      export const Models = () => null; export const ActivityPage = () => null;
      export const Workflows = () => null; export const Costs = () => null;
      export const Reports = () => null; export const Settings = () => null;
      export const Onboarding = () => 'ONBOARDING';
      export const Shell = ({children}) => children; export const TooltipProvider = Shell;
      export const Toaster = () => null;
    ` }));
  }}],
});
const compiled = new Module(path.join(root, 'tests/in-memory.cjs'));
compiled.filename = path.join(root, 'tests/in-memory.cjs');
compiled.paths = Module._nodeModulePaths(root);
compiled._compile(result.outputFiles[0].text, compiled.filename);
const api = compiled.exports;
const user = { id: 1, name: 'Test User', email: 'test@example.invalid', providers: [], createdAt: '2026-10-15T00:00:00Z' };
const summary = {
  healthScore: { score: 92, change: 4, status: 'healthy', label: 'Healthy' },
  metrics: { totalMonthlySpend: 0, estimatedSavings: 0, activeModels: 0, activeWorkflows: 0, totalTokensToday: 0, failedExecutions: 0 },
  brief: { date: '2026-10-15', items: [{ id: '1', text: 'Verified warning', type: 'warning' }] },
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

test('transport and consumer failure integrity (all fetches mocked)', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const cases = [
    ['HTML 200', () => new Response('<html>SPA fallback</html>', { headers: { 'content-type': 'text/html' } }), 'invalid'],
    ['malformed JSON', () => new Response('{', { headers: { 'content-type': 'application/json' } }), 'invalid'],
    ['401 JSON', () => json({ error: 'Not authenticated' }, 401), 'unauthorized'],
    ['unreachable backend', () => { throw new TypeError('offline'); }, 'unavailable'],
    ['503 JSON', () => json({ error: 'Unavailable' }, 503), 'unavailable'],
    ['missing auth fields', () => json({ id: 1 }), 'invalid'],
    ['null body', () => json(null), 'invalid'],
    ['missing content type', () => new Response(JSON.stringify(user)), 'invalid'],
    ['empty JSON response', () => new Response('', { headers: { 'content-type': 'application/json' } }), 'invalid'],
    ['successful JSON error envelope', () => json({ error: 'unavailable' }), 'invalid'],
  ];
  for (const [name, response, kind] of cases) await t.test(name, async () => {
    globalThis.fetch = async () => response();
    let failure;
    await assert.rejects(api.getMe(), error => { failure = error; return api.apiFailureKind(error) === kind; });
    // Even previously cached valid identity must not override a failed refresh.
    api.fixture.auth = { data: user, error: failure };
    api.fixture.route = '/login';
    const html = api.renderApp();
    assert.match(html, kind === 'unauthorized' ? /LOGIN FORM/ : /Account status.*unavailable/);
    assert.doesNotMatch(html, /BRIEF|DASHBOARD/);
    for (const route of ['/brief', '/dashboard', '/onboarding']) {
      api.fixture.route = route;
      const protectedHtml = api.renderApp();
      assert.doesNotMatch(protectedHtml, /BRIEF|DASHBOARD|ONBOARDING/);
      if (kind !== 'unauthorized') assert.match(protectedHtml, /Account status.*unavailable/);
    }
  });
  await t.test('valid identity and login JSON succeed; HTML login cannot succeed', async () => {
    globalThis.fetch = async () => json(user);
    assert.deepEqual(await api.getMe(), user);
    api.fixture.auth = { data: user };
    api.fixture.route = '/dashboard';
    assert.match(api.renderApp(), /DASHBOARD/);
    api.fixture.auth = { data: '<html>not an identity</html>' };
    assert.match(api.renderApp(), /Account status.*unavailable/);
    assert.deepEqual(await api.login({ email: user.email, password: 'fixture-only' }), user);
    globalThis.fetch = async () => new Response('<html/>', { headers: { 'content-type': 'text/html' } });
    await assert.rejects(api.login({ email: user.email, password: 'fixture-only' }), api.InvalidResponseError);
  });
  for (const brief of [undefined, {}, { date: 'today', items: null }, { date: 'today', items: [null] }, { date: 'today', items: [{ id: '1', type: 'warning' }] }, { date: 'today', items: [{ id: '1', text: 'Bad enum', type: ['warning'] }] }]) {
    await t.test(`malformed brief ${JSON.stringify(brief)}`, async () => {
      const invalid = { ...summary, brief };
      globalThis.fetch = async () => json(invalid);
      await assert.rejects(api.getDashboardSummary(), api.InvalidResponseError);
      api.fixture.auth = { data: user };
      api.fixture.summary = { data: invalid };
      const html = api.renderBrief();
      assert.match(html, /Daily Brief.*unavailable/);
      assert.doesNotMatch(html, /No urgent issues|exceptionally well|92\/100/);
    });
  }
  await t.test('operational brief preserves every engine finding beyond the fourth item', () => {
    const report=api.exampleReport();
    api.fixture.summary={data:report};
    const html=api.renderBrief();
    assert.ok(report.findings.length>4);
    for(const item of report.findings)assert.ok(html.includes(item.whatChanged));
    assert.match(html,/Failed requests rose from 0 to 1/);
  });
  await t.test('empty valid brief does not imply zero incidents or health', () => {
    api.fixture.summary = { data: api.emptyReport() };
    const html = api.renderBrief();
    assert.match(html, /Not enough data/);
    assert.match(html, /Spending, incidents and service health remain unknown/);
    assert.doesNotMatch(html, /exceptionally well|92\/100|No urgent issues/);
  });
  await t.test('failed brief refresh hides cached health and warnings', () => {
    api.fixture.summary = { data: api.exampleReport(), error: new api.ServiceUnavailableError('offline') };
    assert.match(api.renderBrief(), /Daily Brief.*unavailable/);
    assert.doesNotMatch(api.renderBrief(), /Failed requests rose|92\/100|exceptionally well/);
  });
  await t.test('missing health or metrics rejected instead of healthy defaults', async () => {
    for (const invalid of [{ ...summary, healthScore: null }, { ...summary, metrics: {} }, { ...summary, healthScore: { ...summary.healthScore, score: '92' } }]) {
      globalThis.fetch = async () => json(invalid);
      await assert.rejects(api.getDashboardSummary(), api.InvalidResponseError);
    }
  });
});
