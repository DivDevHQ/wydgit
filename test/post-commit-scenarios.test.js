import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
test('ledger hooks preserve Page statuses, bodies, Clear values, deadlines and uncertain writes against baseline and disabled observers',async()=>{
  const captures=[];
  for(const [runtime,observation]of [['baseline','on'],['candidate','on'],['candidate','off']]){
    const {stdout}=await exec(process.execPath,['test-support/post-commit-scenarios.mjs',runtime,observation],{timeout:30000,maxBuffer:1024*1024});
    captures.push(JSON.parse(stdout));
  }
  assert.deepEqual(captures[0].results.map(r=>r.outcome),captures[1].results.map(r=>r.outcome));
  assert.deepEqual(captures[1].results.map(r=>r.outcome),captures[2].results.map(r=>r.outcome));
  for(const capture of captures.slice(0,2)){
    const rows=capture.results.find(r=>r.outcome.mode==='success').ledger.rows;
    assert.ok(rows.find(r=>r.name==='budgetStart'));assert.ok(rows.find(r=>r.name==='nativeCommit'));
    assert.ok(rows.find(r=>r.name==='clearEntry'));assert.ok(rows.find(r=>r.name==='clearExit'));
    assert.ok(rows.find(r=>r.name==='canonicalPublication'));assert.ok(rows.find(r=>r.name==='pageComplete'));
    const late=capture.results.find(r=>r.outcome.mode==='deadline-after');
    assert.ok(late.ledger.firstExhaustedCheck);assert.equal(late.ledger.firstExhaustedCheck.remainingMs,-1);
    assert.ok(late.ledger.rows.find(r=>r.name==='nativeCommit').remainingMs>0);
    assert.equal(late.ledger.dropped,0);
  }
});
