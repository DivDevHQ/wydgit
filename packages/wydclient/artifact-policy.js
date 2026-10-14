// Repository-only build guard. Never imported by the browser entry point.
import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
export const ARTIFACT_BASELINE = '15905895489e8db54cf3620d0d1ce1c0b5570fc1';
export const DIST = 'packages/wydclient/dist';
const version = '[0-9]+\\.[0-9]+\\.[0-9]+(?:-[A-Za-z0-9.-]+)?(?:\\+[A-Za-z0-9.-]+)?';
export const versionedArtifact = path => new RegExp(`^${DIST}/(?:wydgit-client-${version}(?:\\.min)?\\.js|sizes-${version}\\.json)$`).test(path);
export function verifyArtifacts({ root, baseline = ARTIFACT_BASELINE, outputs = new Map() }) {
  const git = (...args) => {
    try { return execFileSync('git', args, { cwd: root, stdio: ['ignore','pipe','pipe'], maxBuffer: 16 * 1024 * 1024 }); }
    catch (cause) { throw new Error(`Distribution history unavailable. Fetch complete Git history including ${baseline} before building.`, { cause }); }
  };
  if (git('rev-parse','--is-shallow-repository').toString().trim() !== 'false') throw new Error('Fetch complete Git history before building immutable distributions.');
  git('merge-base','--is-ancestor',baseline,'HEAD');
  // Fail closed for shallow/missing history. The approved H2 snapshot freezes legacy
  // artifacts; after it, each new filename is pinned to its first committed bytes.
  const original = git('ls-tree', '-r', '--name-only', baseline, '--', DIST).toString().trim().split('\n').filter(versionedArtifact);
  const additions = git('log', '--format=', '--name-only', '--diff-filter=A', `${baseline}..HEAD`, '--', DIST).toString().split('\n').filter(versionedArtifact);
  const paths = new Set([...original, ...additions]);
  for (const path of paths) {
    const commit = original.includes(path) ? baseline : git('log', '--reverse', '--format=%H', '--diff-filter=A', `${baseline}..HEAD`, '--', path).toString().trim().split('\n')[0];
    const expected = git('show', `${commit}:${path}`);
    let stat;
    try { stat = lstatSync(resolve(root, path)); }
    catch { if (!outputs.has(path)) throw new Error(`Immutable distribution missing: ${path}. Restore its committed bytes.`); }
    if (stat && !stat.isFile()) throw new Error(`Immutable distribution must be a regular file: ${path}`);
    let actual;
    try { actual = outputs.get(path) ?? readFileSync(resolve(root, path)); }
    catch { throw new Error(`Immutable distribution missing: ${path}. Restore its committed bytes.`); }
    if (!Buffer.from(actual).equals(expected)) throw new Error(`Immutable distribution changed: ${path}. Restore its committed bytes and build a new package version.`);
  }
  return paths.size;
}
