import { submissionToken } from './submission-authority.js';
import { evaluate } from '../components.js';
import { sendTransfer } from './transfers.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { validateConfig } from '../libraries/contracts.js';
import { presentationPolicy } from '../presentation-policy.js';
import { prepareHandlers,prepareAction } from '../events/index.js';
import { activatePackages } from '../packages/index.js';
import { stateFingerprint } from '../packages/state.js';
import { requireThat as check } from '../object-model/validation.js';
import { loadRepository } from '../repository.js';
import { executePage } from '../execution/page.js';
import { createLifecycle,createSessionResolver } from '../execution/lifecycle.js';
import { parseCookies,parseMap } from './input.js';
import { ExecutionContext } from '../seam/context.js';
import { createGate } from '@wydgit/gate/client';
import { errorDocument,pagePath,escapeHtml } from '../index.js';
export function createPipeline({root,libraries,execution={},lifecycle}) {
  execution={...execution,handlers:prepareHandlers(execution.handlers??[],execution.events),actions:(execution.actions??[]).map(record=>prepareAction(record,execution.events))};
  let runtimeSettings;
  try{runtimeSettings=presentationPolicy(validateConfig(readFileSync(path.join(root,'wydgit.config.json'),'utf8')).runtime);}catch(error){if(error.code!=='ENOENT')throw error;runtimeSettings=presentationPolicy();} // Legacy createApp may render without a library host config; createHostApp still requires it.
  const model=loadRepository(root),app=model.runtime.rootId;
  if(execution.authenticatedPages!==undefined)check(Array.isArray(execution.authenticatedPages)&&execution.authenticatedPages.every(id=>model.pages.has(id)),'SEAM.CONTEXT','Invalid authenticated Page policy');
  const catalogHead=stateFingerprint(root);
  const packages=model.installed?activatePackages(model,libraries,root):null;
  if(packages){check(!execution.context&&!execution.handlers.length&&!execution.actions.length,'PACKAGE.PRINCIPALS','Package Page authority cannot be combined with independently authorized host execution');execution={...execution,context:packages.context,handlers:packages.handlers,actions:packages.actions};}
  lifecycle??=createLifecycle({app,handlers:execution.lifecycleHandlers,context:execution.lifecycleContext});
  const ready=lifecycle.start();
  const gate=libraries?.list().some(item=>item.id==='wydgate')&&execution.gateContext?createGate(libraries.bind(execution.gateContext)):null;
  const sessions=createSessionResolver({app,gate,lifecycle});
  // Plain transport input and kernel output port only; no host request/context.
  return {lifecycle,ready,httpPolicy:runtimeSettings.http,async request(req,res){
    await ready;
    let result,transferOutput;
    try {
      res.setHeader('Cache-Control','no-store');
      check(stateFingerprint(root)===catalogHead,'PACKAGE.STALE','Installed packages changed; restart host');
      const model=loadRepository(root),transfer=/^\/_transfer\/([a-z][a-z0-9-]*)\/([a-z][a-z0-9-]*)\/([\w-]+)\/([\w-]+)$/.exec(req.path),route=req.path.replace(/\/$/,'')||'/';
      const page=transfer?model.pages.get(transfer[3]):[...model.pages.values()].find(page=>(pagePath(page,model.site).replace(/\/$/,'')||'/')===route);
      if(!page){res.statusCode=404;res.setHeader('Content-Type','text/html; charset=utf-8');res.end(errorDocument(404));return;}
      if(!transfer&&(!['GET','HEAD','POST'].includes(req.method)||req.method==='POST'&&!(execution.actions??[]).some(a=>a.page===page.id))){res.statusCode=405;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Allow','GET, HEAD');res.end('Method not allowed');return;}
      const cookies=parseCookies(req.cookie??''),session=await sessions.resolve(cookies);
      if(execution.authenticatedPages?.includes(page.id))check(session.identity?.authenticated===true,'SEAM.DENIED','Authentication required');
      if(session.cookie)res.setHeader('Set-Cookie',[session.cookie]);
      const ids=[];const walk=id=>{ids.push(id);Object.values(model.runtime.get(id).slots).flat().forEach(walk);};walk(page.id);
      const context=execution.context?await execution.context({session:session.view,pageId:page.id,ids}):new ExecutionContext({publisher:'wydgit.core',app,self:page.id,visible:ids,identity:session.identity});
      if(transfer){
        res.setHeader('Cache-Control','no-store');
        const [,library,operation,,target]=transfer;
        check(ids.includes(target)&&context.visible.some(grant=>grant===target||grant.endsWith('-*')&&target.startsWith(grant.slice(0,-1))),'SEAM.DENIED','Invisible transfer target');
        const query=parseMap(req.query??''),node=model.runtime.get(target),spec=model.registry.get(node.prototype).presentation;
        const binding=req.method==='POST'?spec?.submission:['GET','HEAD'].includes(req.method)?spec?.delivery:null;
        check(binding&&binding.library===library&&binding.operation===operation&&binding.apiVersion===libraries?.get(library).apiVersion,'SEAM.DENIED','Unapproved transfer');
        if(req.method==='POST')check(query._csrf?.length===1&&query._csrf[0]===submissionToken(session.csrf,app,page.id,target,binding),'SEAM.DENIED','CSRF denied');
        await session.authorize();
        const request=evaluate(binding.input,{properties:node.properties,id:target,query});
        let transitioned=false;
        const authentication=gate?{token:cookies['__Host-wydgit-auth'],verify:()=>gate.resolveSession(cookies['__Host-wydgit-auth']),async establish(token){const fresh=await gate.resolveSession(token);check(fresh.app===app,'SEAM.DENIED','Wrong App');await session.retire();transitioned=true;res.setHeader('Set-Cookie',[`__Host-wydgit-auth=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${Math.max(1,Math.floor((fresh.expiresAt-Date.now())/1000))}`, '__Host-wydgit-session=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0']);},async clear(){await session.retire();transitioned=true;res.setHeader('Set-Cookie',['__Host-wydgit-auth=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0','__Host-wydgit-session=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0']);}}:undefined;
        const output=transferOutput=await libraries.transfer(context,library,operation,request,{...req.transfer,method:req.method,sessionId:session.view.id,...(library==='wydgate'?{authentication}:{}),authorize:()=>session.authorize()});
        if(!transitioned)await session.authorize();
        if(session.cookie&&output.headers?.['Cache-Control']?.startsWith('public'))output.headers['Cache-Control']='private, no-store';
        if(req.method==='POST'&&req.transfer.headers.accept?.includes('text/html')&&(output.status??200)<400&&!output.stream&&output.headers?.['Content-Type']?.startsWith('application/json')){
          output.body=`<!doctype html><html lang="en"><title>Submission complete</title><main><h1>Submission complete</h1><p role="status">Your submission was accepted.</p><p><a href="${escapeHtml(pagePath(page,model.site))}">Return to the page</a></p></main></html>`;
          output.headers['Content-Type']='text/html; charset=utf-8';
        }
        await sendTransfer(output,res,req.method);return;
      }
      const form=req.form,values=parseMap(form);
      const single=name=>{if(values[name]?.length!==1)throw new Error('Invalid action');return values[name][0];};
      const input={method:req.method,path:req.path,query:req.query,form,cookies};
      if(req.method==='POST'){
        input.action={target:single('_target'),type:single('_action'),csrf:single('_csrf'),payload:{}};
        if(input.action.type==='Change')input.action.payload={OldValue:model.runtime.get(input.action.target).properties.value,NewValue:single('value')};
      }
      result=await executePage({model,pageId:page.id,session,input,context,runtimeSettings,handlers:execution.handlers,actions:execution.actions,events:execution.events,files:execution.files,libraries,serviceMappings:packages?.pages.get(page.id)?.storageMappings,csrf:session.csrf});
      await result.response.send(res,req.method==='HEAD');
    }catch(error){if(!res.headersSent){if(error.code==='GATE.SESSION_INVALID')res.setHeader('Set-Cookie',['__Host-wydgit-auth=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0']);res.statusCode=req.path.startsWith('/_transfer/')?(/DENIED|FORGERY|GATE\.SESSION_INVALID/.test(error.code??'')?403:/LIMIT|QUOTA/.test(error.code??'')?413:/UNSUPPORTED_MEDIA|INVALID_MEDIA/.test(error.code??'')?415:/CONFLICT|STATE/.test(error.code??'')?409:/NOT_FOUND/.test(error.code??'')?404:400):(/DENIED|FORGERY|GATE\.SESSION_INVALID/.test(error.code??'')?403:400);res.setHeader('Content-Type','text/html; charset=utf-8');res.end(errorDocument());}else res.destroy();}
    finally{transferOutput?.stream?.destroy();await transferOutput?.close?.();await result?.response.close();}
  }};
}
