import fs from 'node:fs/promises';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Compile only the pure processing module with the existing workspace esbuild.
// No app entrypoint, database imports, server, environment loading or output files.
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(path.join(root, 'artifacts/api-server/package.json'));
const source = path.join(root, 'artifacts/api-server/src/operational/usage.ts');
const fixture = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'scripts/fixtures/usage-synthetic.json');
try {
  const { build } = require('esbuild');
  const result = await build({ entryPoints: [source], bundle: true, write: false, platform: 'node', format: 'cjs' });
  const compiled = new Module(source);
  compiled._compile(result.outputFiles[0].text, source);
  const stat = await fs.stat(fixture);
  if (!stat.isFile() || stat.size > 10 * 1024 * 1024) throw new Error('Input is not a bounded JSON file');
  const report = compiled.exports.importUsageJson(await fs.readFile(fixture, 'utf8'));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  // Never echo raw input, filesystem details or parser excerpts.
  if (error?.name === 'UsageValidationError') console.error(error.message);
  else console.error('Usage example failed: provide an accessible normalized JSON file under 10 MiB.');
  process.exitCode = 1;
}
