import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {cases,password} from './cases.js';
export const stamp=()=>({utc:new Date().toISOString(),local:new Date().toString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});
export async function readJSON(file){const h=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW);try{if(!(await h.stat()).isFile())throw Error('Expected a regular evidence file');return JSON.parse(await h.readFile('utf8'));}finally{await h.close();}}
async function atomicWrite(file,data){
  try{if(!(await fs.lstat(file)).isFile())throw Error('Refusing non-regular evidence file');}catch(e){if(e.code!=='ENOENT')throw e;}
  const temp=file+'.'+randomUUID()+'.pending';const h=await fs.open(temp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  try{await h.writeFile(data);await h.sync();}finally{await h.close();}
  await fs.rename(temp,file);
}
export async function writeJSON(file,value){await atomicWrite(file,JSON.stringify(value,null,2)+'\n');}
export function validateResult(data){
 const allowed=['caseId','provider','outcome','notes','kind'];
 if(Object.keys(data).some(k=>!allowed.includes(k))||!cases.some(c=>c.id===data.caseId)||!['json','sqlite'].includes(data.provider)||!['pass','fail','could-not-test'].includes(data.outcome)||typeof data.notes!=='string'||data.notes.length>4000||!['observation','product-defect','environmental-blocker'].includes(data.kind))throw Error('Invalid result');
 return Object.fromEntries(allowed.map(k=>[k,data[k]]));
}
export async function evidenceStore(directory){
 const file=path.join(directory,'events.jsonl');let queue=Promise.resolve();
 const events=[];try{const h=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW);try{const lines=(await h.readFile('utf8')).trim().split('\n').filter(Boolean);for(const line of lines)events.push(JSON.parse(line));}finally{await h.close();}}catch(e){if(e.code!=='ENOENT')throw e;}
 return {events,async append(event){const work=queue.then(async()=>{const entry={...event,time:stamp()};const h=await fs.open(file,constants.O_APPEND|constants.O_WRONLY|constants.O_CREAT|constants.O_NOFOLLOW,0o600);try{await h.writeFile(JSON.stringify(entry)+'\n');await h.sync();}finally{await h.close();}events.push(entry);return entry;});queue=work.catch(()=>{});return work;},flush:()=>queue};
}
export function latestResults(events){const result={};for(const e of events)if(e.type==='result')result[e.provider+':'+e.caseId]=e;return result;}
export function redact(text){return String(text).replaceAll(password,'[sample credential removed]').replace(/(?:\b(?:password|cookie|authorization|token|secret)\s*[:=]\s*)\S+/gi,'[credential removed]').replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email removed]').replace(/https?:\/\/[^\s)]+/g,'[URL removed]').replace(/\/(?:home|Users|tmp|run|var)\/[^\s,)]+/g,'[local path removed]').replace(/\b[A-Za-z0-9_-]{40,}\b/g,'[opaque value removed]');}
export function report(metadata,events){
 const latest=latestResults(events),rows=[];
 for(const provider of ['json','sqlite'])for(const c of cases){const r=latest[provider+':'+c.id];rows.push({provider,id:c.id,criterion:c.criterion,group:c.group,title:c.title,outcome:r?.outcome??'not-completed',kind:r?.kind??'',notes:redact(r?.notes??'')});}
 const counts=Object.fromEntries(['pass','fail','could-not-test','not-completed'].map(s=>[s,rows.filter(r=>r.outcome===s).length]));
 const observations=events.filter(e=>e.type==='result').map(e=>({provider:e.provider,caseId:e.caseId,outcome:e.outcome,kind:e.kind,notes:redact(e.notes),time:e.time,browser:e.browser??'unknown'}));
 const diagnostics=events.filter(e=>['focus','http','server-error','operator','launch','browser','startup-failure'].includes(e.type)).map(e=>{
  const out={type:e.type,time:e.time};for(const k of ['provider','status','method','route','code','action','diagnostic','browser','commit','dirty','environment'])if(e[k]!==undefined)out[k]=e[k];return out;
 });
 const result={schema:'wydgit.backoffice-human-report/1',session:metadata.id,purpose:metadata.purpose??'human-acceptance',created:metadata.created,generated:stamp(),commit:metadata.commit,environment:metadata.environment,installations:metadata.installations,counts,rows,attempts:observations,diagnostics,acceptance:{'BO-HTTP-12':'Partial — human review required',qualifiedEvaluatorRequired:true,independentEvaluator:'No separate independent-evaluator requirement found in the governing B5/B6 protocol; B6 explicitly requires a qualified human. Record evaluator qualifications privately for reviewer assessment.',automationResolved:false,wcagConformanceClaim:false,httpLimit:'WYDGINE-0.3-HTTP-LIMIT OPEN; 1000 ms unchanged'}};
 const lines=['# BackOffice human acceptance report',`Session: ${metadata.id}`,`Purpose: ${metadata.purpose??'human-acceptance'}`,`Commit at creation: ${metadata.commit}`,`Generated: ${result.generated.local}`,`Passed: ${counts.pass}; Failed: ${counts.fail}; Could not test: ${counts['could-not-test']}; Not completed: ${counts['not-completed']}.`, '', 'BO-HTTP-12 remains Partial. A qualified human must review the complete promised interaction evidence. No WCAG claim. No automated Firefox resolution. HTTP-LIMIT remains OPEN.', '', 'Evidence: metadata.json and append-only events.jsonl beside this export. All attempts, including failed attempts, remain in report.json. Notes are redacted heuristically; inspect before sharing.', '', '## Latest observations'];
 for(const r of rows)lines.push(`- ${r.provider} ${r.id} (${r.criterion}) ${r.title}: ${r.outcome}${r.kind?' ['+r.kind+']':''}${r.notes?' — '+r.notes.replace(/\n/g,' '):''}`);
 for(const [title,filter]of [['Browser focus findings',r=>r.id==='ENV-01'||r.id.startsWith('KEY-')],['Screen-reader findings',r=>r.id.startsWith('AT-')],['Reproducible defects',r=>r.kind==='product-defect'],['Environmental blockers',r=>r.kind==='environmental-blocker'],['Remaining acceptance work',r=>r.outcome!=='pass']]){lines.push('',`## ${title}`);for(const r of rows.filter(filter))lines.push(`- ${r.provider} ${r.id}: ${r.outcome}${r.notes?' — '+r.notes.replace(/\n/g,' '):''}`);}
 return {json:result,markdown:lines.join('\n')+'\n'};
}
export async function exportReport(directory,metadata,events){const r=report(metadata,events);await writeJSON(path.join(directory,'report.json'),r.json);await atomicWrite(path.join(directory,'report.md'),r.markdown);return r;}
