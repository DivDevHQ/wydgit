// Offline replay of the one retained window. This never starts a server or load.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {partitionNativeGaps} from '../test-support/native-settlement-gap.js';
const evidence=JSON.parse(await fs.readFile(new URL('../test-support/http-native-settlement-gap-evidence-2026-10-19.json',import.meta.url)));

test('retained Spike D artifacts and captured source fingerprint reproduce their hashes',async()=>{
  const {file,...configuration}=evidence.series.windows[0];
  const artifacts={'summary.json':evidence.series,[file]:evidence.window,
    'first-matching-trace.json':{configuration,window:file,trace:evidence.window.traces.find(t=>t.matchingHistoricalSignature)}};
  for(const [name,value]of Object.entries(artifacts))assert.equal(createHash('sha256').update(JSON.stringify(value,null,2)+'\n').digest('hex'),evidence.artifacts[name].sha256,name);
  // Spike E intentionally changes runtime code. Verify the immutable captured
  // source, rather than requiring every future runtime to equal Spike D.
  const source=JSON.parse(gunzipSync(await fs.readFile(new URL('../test-support/http-native-settlement-gap-source-2026-10-19.json.gz',import.meta.url))));
  assert.equal(source.schema,'wydgine.captured-source/1');
  assert.equal(source.sourceCommit,'0eb374f105c73b9c8ca555ec5bd4dc5ee3ecb3c5');
  assert.deepEqual(source.roots,['packages/wydgine/src','packages/wydstore/src']);
  const hash=createHash('sha256'),seen=new Set();
  for(const {path,base64}of source.files){
    assert.ok(source.roots.some(root=>path.startsWith(root+'/'))&&!path.split('/').includes('..')&&!seen.has(path));seen.add(path);
    const bytes=Buffer.from(base64,'base64');hash.update(path+'\0'+bytes.length+'\0');hash.update(bytes);
  }
  assert.equal(hash.digest('hex'),evidence.series.fingerprints.implementation,'original capture source fingerprint');
  assert.equal(source.implementationSha256,evidence.series.fingerprints.implementation);
});

test('retained Spike D identities, partitions, outcomes and FS resources independently audit',async()=>{
  const {window:w}=evidence,s=w.resourceCorrelation;
  assert.deepEqual(partitionNativeGaps(s),evidence.partitions);
  assert.deepEqual([evidence.partitions.eligible,evidence.partitions.complete,evidence.partitions.partial,evidence.partitions.missing],[12,12,0,0]);
  assert.deepEqual([w.actualConcurrency.client,w.actualConcurrency.server,w.actualConcurrency.admitted,w.actualConcurrency.pageLedger],[12,12,12,12]);
  assert.equal(evidence.runnerExit,0);assert.equal(evidence.series.complete,true);assert.deepEqual(evidence.series.failures,[]);
  assert.equal(w.fixtureFailure,null);assert.equal(w.cleanupComplete,true);assert.equal(w.requests.length,12);
  assert.deepEqual([s.stopped,s.tracked,s.droppedCalls,s.droppedResources,s.hookErrors],[true,0,0,0,0]);
  assert.equal(s.nativeCalls.length,25);assert.equal(s.inspections.length,25);assert.equal(s.calls.length,250);
  assert.equal(new Set(s.calls.map(r=>r.resources[0].id)).size,250);
  const post=s.calls.filter(r=>r.request>0);
  assert.equal(post.filter(r=>r.mode==='inspection').length,216);assert.equal(post.filter(r=>r.mode==='lifecycle').length,24);
  for(const row of s.calls){
    assert.equal(row.correlation,row.mode+'-single-resource');assert.equal(row.candidates,1);
    const resource=row.resources[0];assert.equal(resource.trigger,row.executionId);
    assert.deepEqual([resource.beforeCount,resource.afterCount],[1,1]);
    assert.ok(row.invocationMs<=resource.initMs&&resource.initMs<=row.invokedMs&&row.invokedMs<=resource.firstBeforeMs&&resource.firstBeforeMs<=resource.lastAfterMs);
    assert.ok(resource.lastAfterMs<=(row.mode==='inspection'?row.resumeMs:row.recoveryMs));
  }
  for(const pair of evidence.partitions.pairs){
    const {request}=pair,rows=s.nativeCalls.filter(r=>r.request===request),inspections=s.inspections.filter(r=>r.request===request);
    assert.deepEqual(rows.map(r=>r.operation),[1,2]);assert.deepEqual(inspections.map(r=>r.operation),[1,2]);
    for(const row of rows){const span=inspections.find(i=>i.operation===row.operation);
      assert.ok(row.dispatchMs<=row.storeEntryMs&&row.storeEntryMs<=span.entryMs&&span.resumeMs<=span.settledMs&&span.settledMs<=row.completeMs&&row.completeMs<=row.pageContinuationMs);
      assert.equal(s.calls.filter(r=>r.request===request&&r.operation===row.operation&&r.mode==='inspection').length,9);
    }
    assert.equal(pair.residualMs,0);assert.ok(pair.clearMs>0&&pair.clearMs<=pair.partitionsMs[1]);
  }
  assert.equal(w.traces.filter(t=>t.record.status===200).length,2);assert.equal(w.traces.filter(t=>t.record.status===500).length,10);
  for(const t of w.traces){
    const r=t.record;assert.deepEqual(r.services,{admitted:2,nativeStarted:2,pending:0,commitReported:1});assert.ok(r.headersPublished&&r.responseEnded);
    assert.equal(r.operationOutcome,r.status===200?'committed':'indeterminate');
    if(r.status===500){assert.equal(r.meter.diagnostics.phaseAtFailure,'prerender');assert.equal(r.meter.exhaustion.resource,'timeMs');}
  }
  const cleanup=w.traces.find(t=>t.index===5).record;
  assert.equal(cleanup.status,200);assert.equal(cleanup.failure,null);assert.equal(cleanup.meter.diagnostics.phaseAtFailure,'cleanup');assert.equal(cleanup.meter.exhaustion.resource,'timeMs');
  const transactions=s.inspections.filter(r=>r.request>0&&r.transactionStartMs!==null);assert.equal(transactions.length,22);
  const absent=s.inspections.filter(r=>r.request>0&&r.transactionStartMs===null);
  for(const span of absent){assert.equal(span.operation,2);assert.equal(span.transactionEndMs,null);assert.ok(span.settledMs!==null);}
  const previous=JSON.parse(await fs.readFile(new URL('../test-support/http-fsreqpromise-inspection-evidence-2026-10-19.json',import.meta.url)));
  const spans=previous.window.resourceCorrelation.inspections.filter(r=>r.request===1);
  assert.equal(evidence.original.completionMs,spans.find(r=>r.operation===1).settledMs);
  assert.equal(evidence.original.inspectionMs,spans.find(r=>r.operation===2).entryMs);
  assert.equal(evidence.original.gapMs,evidence.original.inspectionMs-evidence.original.completionMs);
});
