import { loadRepository } from '../repository.js';
import { executePage } from '../execution/page.js';
import { createLifecycle,createSessionResolver } from '../execution/lifecycle.js';
import { parseCookies,parseMap } from './input.js';
import { ExecutionContext } from '../seam/context.js';
import { createGate } from '@wydgit/gate/client';
import { errorDocument,pagePath } from '../index.js';
export function createPipeline({root,libraries,execution={},lifecycle}) {
  const model=loadRepository(root),app=model.runtime.rootId;
  lifecycle??=createLifecycle({app,handlers:execution.lifecycleHandlers,context:execution.lifecycleContext});
  const ready=lifecycle.start();
  const gate=libraries?.list().some(item=>item.id==='wydgate')&&execution.gateContext?createGate(libraries.bind(execution.gateContext)):null;
  const sessions=createSessionResolver({app,gate,lifecycle});
  // Plain transport input and kernel output port only; no host request/context.
  return {lifecycle,ready,async request(req,res){
    await ready;
    let result;
    try {
      const model=loadRepository(root),route=req.path.replace(/\/$/,'')||'/';
      const page=[...model.pages.values()].find(page=>(pagePath(page,model.site).replace(/\/$/,'')||'/')===route);
      if(!page){res.statusCode=404;res.setHeader('Content-Type','text/html; charset=utf-8');res.end(errorDocument(404));return;}
      if(!['GET','HEAD','POST'].includes(req.method)||req.method==='POST'&&!(execution.actions??[]).some(a=>a.page===page.id)){res.statusCode=405;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Allow','GET, HEAD');res.end('Method not allowed');return;}
      const cookies=parseCookies(req.cookie??''),session=await sessions.resolve(cookies);
      if(session.cookie)res.setHeader('Set-Cookie',[session.cookie]);
      const ids=[];const walk=id=>{ids.push(id);Object.values(model.runtime.get(id).slots).flat().forEach(walk);};walk(page.id);
      const context=execution.context?await execution.context({session:session.view,pageId:page.id,ids}):new ExecutionContext({publisher:'wydgit.core',app,self:page.id,visible:ids,identity:session.identity});
      const form=req.form,values=parseMap(form);
      const single=name=>{if(values[name]?.length!==1)throw new Error('Invalid action');return values[name][0];};
      const input={method:req.method,path:req.path,query:req.query,form,cookies};
      if(req.method==='POST'){
        input.action={target:single('_target'),type:single('_action'),csrf:single('_csrf'),payload:{}};
        if(input.action.type==='Change')input.action.payload={OldValue:model.runtime.get(input.action.target).properties.value,NewValue:single('value')};
      }
      result=await executePage({model,pageId:page.id,session,input,context,handlers:execution.handlers,actions:execution.actions,files:execution.files,libraries,csrf:session.csrf});
      await result.response.send(res,req.method==='HEAD');
    }catch{if(!res.headersSent){res.statusCode=400;res.setHeader('Content-Type','text/html; charset=utf-8');res.end(errorDocument());}else res.destroy();}
    finally{await result?.response.close();}
  }};
}
