import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire, Module } from 'node:module';

const root = process.cwd();
const require = createRequire(path.join(root, 'artifacts/api-server/package.json'));
const result = await require('esbuild').build({
  stdin: { contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { Router } from 'wouter';
    import { Privacy, Terms } from './artifacts/colli/src/pages/legal';
    import { LegalFooter } from './artifacts/colli/src/components/legal-footer';
    export const privacy = () => renderToStaticMarkup(<Router ssrPath="/privacy"><Privacy /></Router>);
    export const terms = () => renderToStaticMarkup(<Router ssrPath="/terms"><Terms /></Router>);
    export const footer = () => renderToStaticMarkup(<Router ssrPath="/login"><LegalFooter /></Router>);
  `, resolveDir: root, loader: 'tsx' },
  bundle: true, write: false, platform: 'node', format: 'cjs', metafile: true,
  loader: { '.css': 'empty' }, nodePaths: [path.join(root, 'artifacts/colli/node_modules')],
});
const mod = new Module(path.join(root, 'tests/legal-pages-compiled.cjs'));
mod.paths = Module._nodeModulePaths(root);
mod._compile(result.outputFiles[0].text, mod.filename = path.join(root, 'tests/legal-pages-compiled.cjs'));
const source = file => fs.readFileSync(path.join(root, 'artifacts/colli/src', file), 'utf8');

test('both policies render without a session, API, database or browser globals', () => {
  for (const [render, title] of [[mod.exports.privacy, 'Privacy Policy'], [mod.exports.terms, 'Terms of Service']]) {
    const html = render();
    assert.match(html, new RegExp(`<h1>${title}</h1>`));
    assert.equal((html.match(/<main/g) ?? []).length, 1);
    assert.match(html, /mailto:a.a.downsouth@gmail.com/);
    assert.match(html, /26 October 2026/);
  }
  assert.ok(!Object.keys(result.metafile.inputs).some(file => /api-client|api-server|lib\/db/.test(file)));
});

test('privacy preserves material beta disclosures and does not promise automatic deletion', () => {
  const html = mod.exports.privacy();
  for (const text of ['one-way password hash', 'Selecting a provider does not connect', '24 hours', 'seven days',
    'revocation records', 'Render', 'Neon', 'Cloudflare', 'Google Fonts', 'Gmail', 'synthetic or sample',
    'synthetic demonstration to Nebius', 'does not send your name', 'hashed account/report identifiers', 'no automatic account-deletion', 'handled manually', 'different lifecycles']) {
    assert.ok(html.includes(text), text);
  }
  const terms = mod.exports.terms();
  assert.match(terms, /To the extent permitted by applicable law/);
  assert.match(terms, /mandatory consumer or privacy rights/);
  assert.match(terms, /href="\/privacy"/);
});

test('public policy routes bypass authentication route wrappers', () => {
  const app = source('App.tsx');
  assert.match(app, /<Route path="\/privacy" component=\{Privacy\} \/>/);
  assert.match(app, /<Route path="\/terms" component=\{Terms\} \/>/);
  assert.ok(app.indexOf('path="/privacy"') < app.indexOf('<Route component={NotFound}'));
  assert.ok(app.indexOf('path="/terms"') < app.indexOf('<Route component={NotFound}'));
});

test('legal links are real keyboard-accessible anchors on entry pages and app footers', () => {
  const html = mod.exports.footer();
  assert.match(html, /<nav aria-label="Legal"/);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="\/terms"/);
  assert.match(html, /focus-visible:outline/);
  for (const file of ['pages/auth.tsx', 'pages/register.tsx', 'pages/brief.tsx', 'components/shell.tsx']) {
    assert.match(source(file), /<LegalFooter \/>/, file);
  }
  const register = source('pages/register.tsx');
  assert.ok(register.indexOf('<LegalFooter />') < register.indexOf('type="submit"'));
});
