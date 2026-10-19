import {timingSafeEqual} from 'node:crypto';
import {ExecutionContext} from '../seam/context.js';
import {createBackOfficeActions} from '../packages/backoffice.js';
import {checkJsonBudget} from '../libraries/limits.js';
import {stateFingerprint} from '../packages/state.js';
import {credentialCookies} from './credential-cookies.js';
import {parseCookies,parseMap} from './input.js';
import {submissionToken} from './submission-authority.js';
import {escapeHtml} from '../index.js';
import {skinAttribute} from '../skins.js';

export const backofficePath=path=>path==='/backoffice'||path.startsWith('/backoffice/');
const binding=Object.freeze({library:'backoffice',apiVersion:'1',operation:'invoke'});
const messages=Object.freeze({
  'HTTP.AUTHENTICATION':'Sign in to this site before opening BackOffice.',
  'HTTP.ORIGIN':'Request origin rejected.', 'HTTP.CSRF':'Session verification failed. Reload BackOffice.',
  'HTTP.REQUEST':'Invalid BackOffice request.', 'HTTP.MEDIA':'Use UTF-8 application/json without compression.',
  'HTTP.LIMIT':'BackOffice request limit exceeded.', 'HTTP.UNAVAILABLE':'BackOffice requires a trusted origin and configured WydGate.',
  'HTTP.METHOD':'Method not allowed.', 'HTTP.NOT_FOUND':'BackOffice route not found.',
  'ACTION.STALE':'This action is no longer available. Refresh actions and select it again.',
  'ACTION.DENIED':'This action is not authorized. Refresh actions to see current access.',
  'ACTION.CONFIRMATION':'Explicit confirmation is required.',
  'ACTION.INVALID_INPUT':'Input does not match the action contract.',
  'ACTION.INVALID_REQUEST':'Invalid action request.',
  'ACTION.INVALID_RESULT':'The action result could not be displayed.',
  'STORE.CONFLICT':'The record changed. Inspect its current revision before submitting again.',
  'SERVICE.FAILED':'The service could not complete this request.',
  'SEWN.LIMIT':'The action exceeded its execution budget.'
});
const statusFor=code=>['ACTION.STALE','STORE.CONFLICT'].includes(code)?409:code==='ACTION.DENIED'?403:['SEWN.LIMIT','SERVICE.FAILED'].includes(code)?503:400;
const failure=(code)=>({ok:false,code,message:messages[code]??'BackOffice action failed.',details:{}});
const equal=(a,b)=>typeof a==='string'&&/^[a-f0-9]{64}$/.test(a)&&typeof b==='string'&&timingSafeEqual(Buffer.from(a),Buffer.from(b));

function shell(model,csrf){
  return `<!doctype html><html lang="en" data-wyd-theme="system"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="wydgit-backoffice-csrf" content="${escapeHtml(csrf)}"><title>BackOffice · ${escapeHtml(model.site.title)}</title><link rel="stylesheet" href="/css/site.css"><link rel="stylesheet" href="/css/skins.css"><link rel="stylesheet" href="/backoffice/assets/shell.css"><script type="module" src="/runtime/wydclient/backoffice.js"></script></head><body${skinAttribute(model.site,model)}><a class="skip" href="#backoffice-content">Skip to content</a><header class="bo-header"><div><a class="bo-brand" href="/backoffice">Wydgine <strong>BackOffice</strong></a><p>${escapeHtml(model.site.title)} <span class="bo-muted">· ${escapeHtml(model.runtime.rootId)}</span></p></div><div class="bo-tools"><label>Appearance <select id="bo-theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><a href="/">View site</a></div></header><div class="bo-layout"><aside><div class="bo-nav-heading"><h2>Installed actions</h2><button type="button" id="bo-refresh">Refresh</button></div><nav id="bo-navigation" aria-label="BackOffice actions"></nav></aside><main id="backoffice-content" tabindex="-1"><p id="bo-status" role="status" aria-live="polite">Loading available actions…</p><section id="bo-action"><h1>Site administration</h1><p>Select an installed action to begin.</p></section></main></div><noscript>BackOffice needs JavaScript to discover and invoke installed actions.</noscript></body></html>`;
}

// Trusted host adapter only. The private acquisition context can select installed
// execution, but never becomes the contributed caller or crosses HTTP. It has no
// object edit, policy review, relocation or library-service authority.
export function createBackOfficeHttp({root,model,libraries,sessions,contextPolicy,ready,alive,parking,readJson,verifiedPackages,requestMs}){
  const app=model.runtime.rootId,head=stateFingerprint(root);
  const hasGate=!parking&&libraries?.list().some(l=>l.id==='wydgate');
  const actions=hasGate?createBackOfficeActions({root,libraries,verifiedPackages,
    installationContext:contextPolicy(new ExecutionContext({context:'BackOffice',publisher:'wydgit.core',self:app,app,
      capabilities:['packages.lifecycle.manage','packages.placement.manage']}))}):null;
  return async(req,res)=>{
    const deadline=Date.now()+requestMs;
    const checkDeadline=()=>{if(Date.now()>=deadline)throw Object.assign(Error(),{code:'HTTP.LIMIT'});alive();};
    const json=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data));};
    const reject=(status,code)=>json(status,failure(code));
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy','same-origin');
    try{
      alive();await ready();alive();
      const invoke=req.path==='/backoffice/api/actions/invoke',discovery=req.path==='/backoffice/api/actions';
      const isShell=req.path==='/backoffice'||req.path==='/backoffice/';
      if(!invoke&&!discovery&&!isShell)return reject(404,'HTTP.NOT_FOUND');
      if(req.method!==(invoke?'POST':'GET')){res.setHeader('Allow',invoke?'POST':'GET');return reject(405,'HTTP.METHOD');}
      if(!actions||!req.transport||req.transport.parking||req.transport.app!==app)return reject(503,'HTTP.UNAVAILABLE');
      const {origin,secure}=req.transport,h=req.headers;
      if((h.origin!==null&&h.origin!==origin)||(!isShell&&['cross-site','same-site'].includes(h.fetchSite)))return reject(403,'HTTP.ORIGIN');
      if(invoke&&h.origin!==origin)return reject(403,'HTTP.ORIGIN');
      const policy=credentialCookies(secure),cookies=parseCookies(req.cookie);
      // No bearer header, alternate-scheme auth cookie, query or body credentials.
      if(h.authorization!==null||Object.keys(cookies).some(k=>/^(?:__Host-|__Secure-)?wydgit-auth$/i.test(k)&&k!==policy.auth))return reject(400,'HTTP.REQUEST');
      if(!cookies[policy.auth])return reject(401,'HTTP.AUTHENTICATION');
      let session;
      try{session=await sessions.resolve(cookies,{secure});if(!session.identity?.authenticated)throw Error();}
      catch{res.setHeader('Set-Cookie',[policy.serialize('auth','',0)]);return reject(401,'HTTP.AUTHENTICATION');}
      checkDeadline();
      const csrf=submissionToken(session.csrf,app,'backoffice','actions',binding);
      if(stateFingerprint(root)!==head)return reject(409,'ACTION.STALE');
      if(isShell){if(req.query)return reject(400,'HTTP.REQUEST');res.setHeader('Content-Type','text/html; charset=utf-8');res.end(shell(model,csrf));return;}
      let result;
      if(discovery){
        const query=parseMap(req.query),keys=Object.keys(query);
        if(keys.some(k=>!['offset','limit'].includes(k)||query[k].length!==1||!/^\d{1,3}$/.test(query[k][0])))return reject(400,'HTTP.REQUEST');
        result=await actions.discover({app,session:cookies[policy.auth],...Object.fromEntries(keys.map(k=>[k,Number(query[k][0])]))});
      }else{
        if(req.query)return reject(400,'HTTP.REQUEST');
        if(!equal(h.csrf,csrf))return reject(403,'HTTP.CSRF');
        if(!/^application\/json(?:\s*;\s*charset=(?:utf-8|"utf-8"))?\s*$/i.test(h.type??'')||!['identity',''].includes(h.encoding??''))return reject(415,'HTTP.MEDIA');
        const body=await readJson(req.body);
        checkDeadline();
        checkJsonBudget(body,{maxBytes:48000,maxDepth:12,maxNodes:2048},'HTTP.REQUEST');
        if(!body||Array.isArray(body)||typeof body!=='object'||!Object.hasOwn(body,'reference')||!Object.hasOwn(body,'input')||Object.keys(body).some(k=>!['reference','input','confirmed'].includes(k)))return reject(400,'HTTP.REQUEST');
        result=await actions.invoke({...body,app,session:cookies[policy.auth]});
      }
      checkDeadline();
      if(!result.ok)return reject(statusFor(result.code),Object.hasOwn(messages,result.code)?result.code:'ACTION.DENIED');
      await session.authorize();checkDeadline();
      const output=discovery?{...result,csrf}:result;
      checkJsonBudget(output,{maxBytes:66560,maxDepth:24,maxNodes:10000},'ACTION.INVALID_RESULT');
      json(200,output);
    }catch(error){
      if(res.headersSent||res.destroyed){res.destroy();return;}
      if(error.code==='GATE.SESSION_INVALID')return reject(401,'HTTP.AUTHENTICATION');
      const code=Object.hasOwn(messages,error.code)?error.code:'HTTP.REQUEST';
      reject(code==='HTTP.LIMIT'?413:400,code);
    }finally{
      // Release bodies rejected before collection without reading attacker data.
      void req.body?.cancel().catch(()=>{});
    }
  };
}
