// Offline only: no pg import, network, child process, credentials or file writes.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../../..');
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function verifyArtifacts(read = file => readFileSync(path.join(root, file))) {
  const manifestBytes = read('lib/db/hosted/v1/manifest.json');
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest.lineage !== 'colli-hosted-v1' || manifest.postgresMajor !== 17) throw new Error('Manifest identity mismatch');
  for (const source of manifest.sources) {
    // Existing Windows working trees use CRLF; canonical source hash is explicitly LF.
    const canonical = read(source.path).toString('utf8').replace(/\r\n/g, '\n');
    if (sha256(canonical) !== source.sha256_utf8_lf) throw new Error(`Source mismatch: ${source.path}`);
  }
  for (const artifact of manifest.artifacts) {
    if (sha256(read(artifact.path)) !== artifact.sha256) throw new Error(`Artifact mismatch: ${artifact.path}`);
  }
  return { manifestSha256: sha256(manifestBytes), artifacts: manifest.artifacts.length, sources: manifest.sources.length };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(verifyArtifacts())); }
  catch { console.error('Hosted artifacts FAILED integrity verification; do not execute.'); process.exitCode = 1; }
}
