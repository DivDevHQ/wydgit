import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=new URL('../test-support/',import.meta.url);
const evidence=JSON.parse(fs.readFileSync(new URL('http-production-observer-spike-j-evidence-2026-10-20.json',root)));
const bytes=fs.readFileSync(new URL(evidence.archive.file,root)),archive=JSON.parse(gunzipSync(bytes));
const hash=s=>createHash('sha256').update(s).digest('hex');
test('Spike J pins raw evidence and diagnostic sources while retaining identical shipped runtime',()=>{
  assert.equal(hash(bytes),evidence.archive.sha256);assert.equal(evidence.issue.status,'OPEN');
  for(const suffix of ['Before','After'])for(const [name,source]of Object.entries(archive['sources'+suffix]))assert.equal(hash(source),archive['hashes'+suffix][name]);
  for(const [name,source]of Object.entries(archive.sourcesBefore))if(name.startsWith('packages/'))assert.equal(archive.sourcesAfter[name],source);
  assert.equal(archive.series.length,3);assert.equal(archive.baseline,'d97b06c37c9363f9652e1eebd1879dfaf412a029');
});
test('Spike J preserves all HTTP uncertainty, independent record counts, off unknowns and process status',()=>{
  let windows=0,requests=0,records=0;
  for(const series of archive.series)for(const c of series.captures){
    windows++;const v=c.value;requests+=v.requests.length;records+=v.reconciliation.records;
    assert.equal(c.status.code,0);assert.equal(c.status.signal,null);assert.equal(c.status.reason,null);
    assert.equal(v.cleanupComplete,true);assert.equal(v.fixtureFailure,null);assert.equal(v.clientProcess.exitCode,0);assert.equal(v.clientProcess.reaped,true);
    assert.equal(v.setup.client.status,200);assert.equal(v.reconciliation.records,v.concurrency);assert.equal(v.reconciliation.complete,true);
    assert.equal(c.summary.http200+c.summary.http500,v.concurrency);assert.equal(c.summary.http500,c.summary.indeterminate);assert.equal(c.summary.unexpected,0);
    assert.equal(c.summary.dropped,0);assert.equal(c.summary.observerErrors,0);
    if(c.observer==='off'){
      assert.equal(v.traces.length,0);assert.equal(v.resourceCorrelation,undefined);assert.equal(v.synchronousAttribution,undefined);
      assert.equal(c.summary.reportedCommits,null);assert.equal(c.summary.completedNative,null);assert.equal(c.summary.exhausted,null);
    }else{
      assert.equal(c.summary.reportedCommits,v.concurrency);assert.equal(c.summary.completedNative,2*v.concurrency);
      if(c.observer==='loop'){assert.equal(v.resourceCorrelation.enabled,false);assert.equal(v.resourceCorrelation.scheduling.callbackCount,0);}
    }
  }
  assert.equal(windows,95);assert.equal(requests,909);assert.equal(records,909);
  for(const name of ['baseline','repeat']){
    const captures=archive.series.find(s=>s.name===name).captures;
    assert.equal(captures.length,37);assert.ok(captures.slice(0,10).every(c=>c.observer==='off'&&c.provider==='SQLite'));
    assert.equal(captures.filter(c=>c.observer==='off'&&c.provider==='SQLite').length,13);
  }
});
test('Spike J calibration preserves identical work and bounded records across alternating controls',()=>{
  for(const label of ['before','candidate'])for(const c of archive.calibrations[label]){
    assert.equal(c.rows.length,36);assert.equal(c.synchronous.length,18);
    for(const r of c.rows){assert.equal(r.sum,30000);assert.equal(r.errors,0);assert.ok(Number.isFinite(r.elapsedMs));}
    for(const r of c.synchronous)assert.equal(r.sum,70000);
  }
  for(const c of archive.calibrations.paired){assert.equal(c.warmupPairs,20);assert.equal(c.measuredPairs,9);assert.equal(c.rows.length,18);
    for(const r of c.rows){assert.equal(r.calls,70000);assert.equal(r.metadata,1);assert.equal(r.spans,2);}}
});
