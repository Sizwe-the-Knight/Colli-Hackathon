import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire, Module } from 'node:module';

// Offline preview only: compile the isolated pure scorer, never an API entrypoint.
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(path.join(root, 'artifacts/api-server/package.json'));
const source = path.join(root, 'artifacts/api-server/src/operational/health-score.ts');
const built = await require('esbuild').build({ entryPoints: [source], bundle: true, write: false, platform: 'node', format: 'cjs' });
const mod = new Module(source); mod._compile(built.outputFiles[0].text, source);
const input = JSON.parse(await fs.readFile(path.join(root, 'scripts/fixtures/health-score-synthetic.json'), 'utf8'));
const output = JSON.stringify({ disclosure: input.provenance.label, period: input.period,
  currency: input.spend.currency, result: mod.exports.scoreSyntheticHealth(input) }, null, 2) + '\n';
const destination = path.join(root, 'artifacts/colli/src/lib/health-score-sample.json');
const mode = process.argv[2];
if (process.argv.length > 3 || (mode && !['--write-preview', '--check-preview'].includes(mode))) {
  console.error('Use no argument, --write-preview or --check-preview.'); process.exitCode = 1;
} else if (mode === '--write-preview') {
  await fs.writeFile(destination, output); console.log('Synthetic preview artifact generated.');
} else if (mode === '--check-preview') {
  if ((await fs.readFile(destination, 'utf8')).replace(/\r\n/g, '\n') !== output) {
    console.error('Synthetic preview is stale; regenerate from the scorer and fixture.'); process.exitCode = 1;
  } else console.log('Synthetic preview matches the scorer and fixture.');
} else console.log(output.trimEnd());
