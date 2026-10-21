import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {installedGuardSource} from '../test-support/historical-installed-guard.js';
import {createDeadlineLedger,deadlineArm,deadlineStart,deadlineCheck,deadlineMark,deadlinePhase,deadlineSync} from '../test-support/deadline-ledger.js';
import {classifyPostCommit} from '../test-support/post-commit-analysis.js';

test('deadline ledger preserves authoritative equality/rollback, terminal checks and fixed bounds',()=>{
  let monotonic=0,wall=1000;
  const capture=createDeadlineLedger({request:1,maxRows:4,now:()=>++monotonic,wall:()=>wall});
  capture.run(()=>{
    deadlineStart(1,2); // Other lifecycle budgets cannot capture the Page anchor.
    deadlineArm();deadlineStart(1000,2000);deadlineStart(3000,4000);
    deadlineCheck(1999,2000,true);deadlineCheck(900,2000,true);deadlineCheck(2000,2000,true);
    deadlineCheck(2001,2000,false);deadlineCheck(2000,9999,true);
    deadlineMark('nativeDispatch');wall=1100;deadlineMark('nativeCommit');
    deadlineMark('canonicalPublication');deadlineMark('pageComplete');
    deadlineMark('private payload');deadlinePhase('/secret/package');
  });
  const result=capture.finish();assert.equal(result,capture.finish());
  assert.equal(result.startedAtMs,1000);assert.equal(result.deadlineAtMs,2000);
  assert.equal(result.checks,4);assert.equal(result.lastCheck.remainingMs,-1);
  assert.equal(result.firstExhaustedCheck.remainingMs,0);assert.equal(result.rows.length,4);assert.equal(result.dropped,1);
  assert.deepEqual(result.rows.map(r=>r.name),['budgetStart','nativeDispatch','nativeCommit','canonicalPublication']);
  assert.equal(result.rows[2].remainingMs,900);assert.equal(result.rows[2].operation,1);
  assert.doesNotMatch(JSON.stringify(result),/secret|payload/);assert.ok(Object.isFrozen(result.rows));
});
test('deadline ledger is isolated across interleaved async requests and closes retention',async()=>{
  const captures=[createDeadlineLedger({request:1}),createDeadlineLedger({request:2})];
  await Promise.all(captures.map((c,i)=>c.run(async()=>{deadlineArm();deadlineStart(10+i,1010+i);deadlineMark('nativeDispatch');await Promise.resolve();deadlineCheck(20+i,1010+i,true);deadlineMark('nativeSettlement');})));
  const [a,b]=captures.map(c=>c.finish());assert.equal(a.request,1);assert.equal(b.request,2);assert.equal(a.checks,1);assert.equal(b.checks,1);
  assert.equal(a.deadlineAtMs,1010);assert.equal(b.deadlineAtMs,1011);
  captures[0].run(()=>{deadlineMark('nativeDispatch');deadlineCheck(40,1010,true);});assert.equal(a.rows.length,3);assert.equal(a.checks,1);
});
test('synchronous costs preserve returns and thrown identity and distinguish post-commit work',()=>{
  let now=0;const capture=createDeadlineLedger({now:()=>++now}),error=Error('not serialized');
  assert.equal(deadlineSync('pageTree',()=>3),3);
  capture.run(()=>{
    deadlineSync('pageTree',()=>3);deadlineMark('nativeCommit');
    assert.throws(()=>deadlineSync('pageTree',()=>{throw error;}),e=>e===error);
  });
  const r=capture.finish();assert.equal(r.synchronous.pageTree.calls,2);assert.equal(r.synchronous.pageTree.postCommitCalls,1);
  assert.equal(r.synchronous.pageTree.postCommitMs,1);assert.doesNotMatch(JSON.stringify(r),/not serialized/);
});
test('baseline source substitution exactly restores the Spike J installed guard',async()=>{
  const candidate=await fs.readFile('packages/wydgine/src/engine/packages/index.js','utf8');
  const reference=candidate.replace('  // Resolve immutable names once; every stamp still obtains fresh metadata.\n','')
    .replace("'content/package-operation.json'].map(file=>path.join(root,file));","'content/package-operation.json'];")
    .replace('lstatSync(file,{bigint:true,throwIfNoEntry:false})','lstatSync(path.join(root,file),{bigint:true,throwIfNoEntry:false})');
  // Hash pinned to 1277d456, not a rewritten reference implementation.
  const {createHash}=await import('node:crypto');
  const evidence=JSON.parse(await fs.readFile('test-support/http-post-commit-critical-path-spike-k-evidence-2026-10-20.json'));
  const bytes=await fs.readFile('test-support/'+evidence.archive.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),evidence.archive.sha256);
  const before=JSON.parse(gunzipSync(bytes)).artifacts['packages-before.js'];
  assert.equal(createHash('sha256').update(before).digest('hex'),'edd9577cb51a2a7c561e82c3742e0027845269bc3507bf3d564da4a227c7a3a5');
  assert.equal(installedGuardSource(reference),installedGuardSource(before));
  assert.notEqual(reference,candidate);
});
test('failure classes require direct evidence; aggregate persistence never proves a request deadline',()=>{
  assert.equal(classifyPostCommit({complete:true,status:200}).class,7);
  assert.equal(classifyPostCommit({complete:true,status:500,outcome:'indeterminate'}).class,'unknown');
  const trace={services:{nativeStarted:2,commitReported:1},failure:{code:'SEWN.LIMIT'},meter:{exhaustion:{resource:'timeMs'}}};
  assert.equal(classifyPostCommit({complete:true,status:500},trace).class,3);
  assert.equal(classifyPostCommit({complete:true,status:500},{...trace,failure:{code:'MUTATION.INVALID_PROPERTY'}}).class,'unknown');
  assert.equal(classifyPostCommit({complete:true,status:500},{services:{nativeStarted:0}}).class,1);
  assert.equal(classifyPostCommit({complete:false},{}, {rows:[{name:'responseHandoff'}]}).class,6);
  assert.equal(classifyPostCommit({complete:false},trace).class,3);
});
