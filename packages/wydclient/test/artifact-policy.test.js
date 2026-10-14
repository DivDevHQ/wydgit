import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { ARTIFACT_BASELINE, DIST, verifyArtifacts } from '../artifact-policy.js';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const artifact = `${DIST}/wydgit-client-1.0.0.js`;
function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'wydclient-immutable-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  git('init', '-q');
  const commit = () => { git('add', '-A'); git('-c','user.name=Artifact test','-c','user.email=artifact@example.invalid','-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null','commit','-qm','fixture'); return git('rev-parse','HEAD'); };
  mkdirSync(resolve(root,DIST), { recursive: true });
  writeFileSync(resolve(root,artifact),'original'); const baseline = commit();
  return { root, baseline, git, commit };
}
test('committed distributions match approved history and alpha.3 is byte-identical to H2', () => {
  assert.ok(verifyArtifacts({ root }) >= 6);
  for (const suffix of ['.js','.min.js']) {
    const path = `${DIST}/wydgit-client-0.1.0-alpha.3${suffix}`;
    const expected = execFileSync('git',['show',`${ARTIFACT_BASELINE}:${path}`],{cwd:root});
    const actual = readFileSync(resolve(root,path));
    assert.ok(actual.equals(expected),path);
    console.log(`${path}: sha256 ${createHash('sha256').update(actual).digest('hex')}`);
  }
  assert.ok(readFileSync(resolve(root,`${DIST}/sizes-0.1.0-alpha.3.json`)).equals(execFileSync('git',['show',`${ARTIFACT_BASELINE}:${DIST}/sizes.json`],{cwd:root})));
});
test('immutable guard rejects modified/deleted historical artifacts and mismatching rebuild candidates', t => {
  const f = fixture(t), path = resolve(f.root,artifact);
  assert.equal(verifyArtifacts(f),1);
  assert.equal(verifyArtifacts({...f,outputs:new Map([[artifact,Buffer.from('original')]])}),1);
  assert.throws(()=>verifyArtifacts({...f,outputs:new Map([[artifact,Buffer.from('changed')]])}),/new package version/);
  assert.equal(readFileSync(path,'utf8'),'original');
  writeFileSync(path,'changed'); assert.throws(()=>verifyArtifacts(f),/Immutable distribution changed/);
  f.commit(); assert.throws(()=>verifyArtifacts(f),/Immutable distribution changed/); // also catches an already committed mutation
  unlinkSync(path); f.commit(); assert.throws(()=>verifyArtifacts(f),/Immutable distribution missing/);
  const target=resolve(f.root,'original-copy');writeFileSync(target,'original');symlinkSync(target,path);assert.throws(()=>verifyArtifacts(f),/regular file/);
});
test('new version is allowed, then pinned to its first commit even after later committed edits', t => {
  const f = fixture(t), next = `${DIST}/wydgit-client-1.0.1.min.js`;
  assert.equal(verifyArtifacts({...f,outputs:new Map([[next,Buffer.from('new')]])}),1);
  writeFileSync(resolve(f.root,next),'new'); f.commit(); assert.equal(verifyArtifacts(f),2);
  writeFileSync(resolve(f.root,next),'rewritten'); f.commit(); assert.throws(()=>verifyArtifacts(f),/Immutable distribution changed/);
  writeFileSync(resolve(f.root,next),'new'); assert.equal(verifyArtifacts(f),2);
  assert.throws(()=>verifyArtifacts({...f,baseline:'missing-history'}));
  writeFileSync(resolve(f.root,'.git/shallow'),f.git('rev-parse','HEAD')+'\n');assert.throws(()=>verifyArtifacts(f),/complete Git history/);
});
