// Offline packaging only. Preserve exploratory failures and all fresh windows.
import fs from 'node:fs/promises';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {summarizePostCommit} from './post-commit-analysis.js';
import {distribution} from './scheduling-attribution.js';
const [scratch,evidenceFile,archiveFile]=process.argv.slice(2);
if(!archiveFile)throw Error('Usage: post-commit-evidence.mjs SCRATCH EVIDENCE_JSON SOURCE_GZ');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const series={};
for(const name of ['baseline','baseline-final','baseline-tail','primary-before','primary-after']){
  const directory=path.join(scratch,name),summary=JSON.parse(await fs.readFile(path.join(directory,'summary.json')));
  const windows=[];for(const row of summary.windows)windows.push({...row,...JSON.parse(await fs.readFile(path.join(directory,row.file)))});
  series[name]={summary,windows};
}
const artifacts={};
for(const name of (await fs.readdir(scratch)).filter(n=>/^(control-\d+\.json|.*preflight.*\.json|.*\.log|packages-before\.js|page-before\.js)$/.test(n))){
  artifacts[name]=await fs.readFile(path.join(scratch,name),'utf8');
}
const sources={};
for(const name of ['packages/wydgine/src/engine/packages/index.js','test-support/deadline-ledger.js','test-support/deadline-ledger-hooks.mjs','test-support/post-commit-probe.mjs','test-support/post-commit-control.mjs',
  'test-support/post-commit-analysis.js','test-support/post-commit-evidence.mjs','test-support/post-commit-scenarios.mjs','test-support/http-concurrency.js','test-support/production-observer-worker.mjs',
  'test/deadline-ledger.test.js','test/post-commit-scenarios.test.js','test/installation-stamp.test.js'])sources[name]={text:await fs.readFile(name,'utf8')};
for(const value of Object.values(sources))value.sha256=digest(value.text);
const primary={};
for(const name of ['primary-before','primary-after']){
  const windows=series[name].windows;if(!series[name].summary.complete||windows.some(w=>w.status.code||w.value?.fixtureFailure||!w.value?.cleanupComplete))throw Error('Incomplete primary');
  const groups=[...new Set(windows.map(w=>w.provider+'/'+w.mode))];
  primary[name]={total:summarizePostCommit(windows),groups:Object.fromEntries(groups.map(key=>[key,summarizePostCommit(windows.filter(w=>w.provider+'/'+w.mode===key))]))};
  delete primary[name].total.requestsDetail;
}
const controls=[1,2,3].map(i=>JSON.parse(artifacts['control-'+i+'.json']));
const controlSummary=controls.map(c=>({reference:distribution(c.rows.filter(r=>r.mode==='reference').map(r=>r.elapsedMs)),candidate:distribution(c.rows.filter(r=>r.mode==='candidate').map(r=>r.elapsedMs)),
  observerOff:distribution(c.observer.filter(r=>!r.enabled).map(r=>r.elapsedMs)),observerOn:distribution(c.observer.filter(r=>r.enabled).map(r=>r.elapsedMs))}));
const archive=gzipSync(JSON.stringify({schema:'wydgine.post-commit-source/1',series,artifacts,sources}));await fs.writeFile(archiveFile,archive);
const evidence={schema:'wydgine.post-commit-spike-k-evidence/1',date:'2026-10-20',baseline:'1277d456dcc600f076c88efc68a26e1f8fb7eec0',
  issue:{id:'WYDGINE-0.3-HTTP-LIMIT',status:'OPEN'},correction:'Resolve seven immutable installed artifact paths once per bound execution context; every existing fresh metadata/integrity/authority check remains.',
  archive:{file:path.basename(archiveFile),sha256:digest(archive),bytes:archive.length},sources:Object.fromEntries(Object.entries(sources).map(([p,v])=>[p,v.sha256])),primary,controlSummary,
  exploratory:Object.fromEntries(['baseline','baseline-final','baseline-tail'].map(name=>[name,{complete:series[name].summary.complete,windows:series[name].windows.length,
    validWindows:series[name].windows.filter(w=>w.value?.requests?.length>0).length,requests:series[name].windows.reduce((n,w)=>n+(w.value?.requests.length??0),0),
    http500:series[name].windows.reduce((n,w)=>n+(w.summary?.http500??0),0)}])),
  limitations:['Off-mode per-request commit/deadline stages are unknown; aggregate reconciliation is not a per-record identifier join.',
    'Bounded test-support hooks are disabled by default and absent from shipped imports. Extended observers materially perturb the event loop.',
    'Absolute intervals include native wait, callback delivery and OS scheduling. No independent span maxima are added; unobserved time is not CPU attribution.',
    'Sequential fresh-process series and local host variance cannot establish a reliability improvement from response counts alone.',
    'Exploratory diagnostic schema evolution, one source-hook composition failure, and restricted-sandbox preflight/test failures are preserved, excluded from primary comparisons.',
    'No automatic retry, deadline/status/client/version/protocol change, production deployment or general outcome-reconciliation implementation.']};
await fs.writeFile(evidenceFile,JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({archiveBytes:archive.length,before:primary['primary-before'].total.http200,after:primary['primary-after'].total.http200}));
