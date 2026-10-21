// Disposable installed applications. All provisioning/review uses native host APIs;
// browser intents use only the published Page metadata and ordinary HTTP admission.
import fs from 'node:fs/promises';
import path from 'node:path';
import {once} from 'node:events';
import {createApp} from '../app.js';
import {twoResourceActionFixture,installedTaskboardFixture} from './backoffice-preflight.js';
import {adoptionFixture} from './backoffice-adoption.js';
import {actionReference} from '../packages/wydgine/src/engine/packages/backoffice-preflight-contract.js';
import {ExecutionContext} from '../wydgine/seam/context.js';
import {installMembershipLogin} from './backoffice.js';
import {executionPlacement} from '../wydgine/packages/index.js';
import {configuration} from './wydgate.js';
import {createGate} from '@wydgit/gate/client';
import {manifest as gateManifest} from '@wydgit/gate';

export function b5Binding(f,id,name=id,usage='intent',fixedInput={}){
  const e=f.entry(),a=e.manifest.backofficeActions.find(a=>a.id===id);
  const consumer=f.pageFacts().nodes.find(n=>n.id===e.instance);
  return {name,consumer:e.instance,reference:actionReference(e,a,e.executionPlacement.app),usage,fixedInput,
    constraints:[{type:consumer.ancestors.at(-1),targets:[`${a.owner}/${a.id}`],effect:a.effect,input:a.input,output:a.output}]};
}
export async function b5Publish(f,key,bindings=[]){
  const p={...f.proposal(),key,bindings};await f.adopt(f.payload(undefined,[p]));return p;
}
const node=(id,type,properties={},slots={})=>({schema:'wydgit/0.2',id,prototype:'wydgit.core/'+type,properties,slots,provenance:{}});
export async function b5RecordsFixture(t,provider='json'){
  const ids=['b5-heading','b5-records','b5-create','b5-id','b5-text','b5-confirm'];
  const f=adoptionFixture(await twoResourceActionFixture(t,provider,{
    edit(m){
      const get=m.backofficeActions.find(a=>a.id==='get'),transaction=m.backofficeActions.find(a=>a.id==='transaction');
      m.backofficeActions.push({...structuredClone(get),id:'list',service:{...get.service,operation:'query'},
        input:{type:'object',fields:{store:get.input.fields.store,collection:get.input.fields.collection,limit:{type:'integer',min:1,max:10},offset:{type:'integer',min:0,max:100}},optional:['offset']},
        output:{type:'array',maxItems:10,items:get.output}});
      transaction.scopes.wydstore.push('archive');
      m.permissions.visible.push(...ids);m.permissions.editable=ids;
      m.permissions.capabilities.push('object.instances.edit');m.permissions.traversal=['children'];
      m.resources.sources.prepare='prepare.bas';m.bindings.push({owner:'backoffice-members',event:'Page.PreRender',source:'prepare',kind:'handler'});
    },
    async configure(f){
      f.operator=new ExecutionContext({...f.operator,visible:[...f.operator.visible,...ids],editable:[...f.operator.editable,...ids]});
      const store=f.config.libraries.find(l=>l.id==='wydstore').options.stores.find(s=>s.id==='records');
      store.authorization.collections.records.query={contexts:['BackOffice'],permission:'content.records.read'};
      // Keep the transaction envelope independent from the second member's
      // create permission, so revocation reaches actual member authorization.
      store.authorization.collections.archive.transaction={contexts:['BackOffice'],permission:'content.records.write'};
      const file=path.join(f.candidate.packagePath,'section.json'),section=JSON.parse(await fs.readFile(file));
      section.slots.blocks=[
        node('b5-heading','block',{content:{type:'markdown',value:'# Records administration\n\nRead the current records before changing them. [List records](/backoffice/pages/records) · [New record](/backoffice/pages/records#b5-create)'}}),
        node('b5-records','block',{content:{type:'markdown',value:'## Current records'}}),
        node('b5-create','form',{label:'Create record',content:{type:'markdown',value:'## New record\n\nUse a unique record ID and at most 128 characters of text. Confirm each change.'}},{blocks:[
          node('b5-id','text-input',{name:'id',label:'Record ID',required:true,maxLength:64}),
          node('b5-text','text-input',{name:'text',label:'Record text',required:true,maxLength:128}),
          node('b5-confirm','checkbox',{name:'confirmed',label:'Confirm record creation',required:true})
        ]})
      ];
      await fs.writeFile(file,JSON.stringify(section));
      await fs.writeFile(path.join(f.candidate.packagePath,'prepare.bas'),'EVENT Page.PreRender\nDIM result AS Object\nDIM text AS String\ntext = "Current records: "\nresult = SERVICES.Call("backoffice", "load", {})\nIF result.ok THEN\nFOR EACH row IN result.value\ntext = text & " " & row.id & ": " & row.data.text & ";"\nNEXT row\nELSE\ntext = text & "unavailable"\nEND IF\nFOR EACH child IN ME.related("children", "blocks")\nIF child.Id = "b5-records" THEN\nCALL child.Set("content", {"type":"markdown", "value":text})\nEND IF\nNEXT child\nEND EVENT');
    }
  }));
  // Install all authored content before review: accepted tree changes stale evidence.
  await installMembershipLogin(f);
  f.permissions=[...f.storePermissions,'archive.action.read','archive.records.read','archive.records.write','content.pages.view'];
  f.grant=permissions=>f.gate.assignUser({userId:f.user.account.id,roles:[],permissions});
  await f.grant(f.permissions);
  f.publish=async()=>{
    const load=b5Binding(f,'list','load','prepare',{store:'records',collection:'records',limit:10});
    const intent=id=>b5Binding(f,id,id,'intent',{store:'records',collection:'records'});
    // Keep each entry's allowlist intentional and within the existing 64 KiB
    // complete policy-plan ceiling. Raw shell actions remain independently useful.
    const proposals=[{...f.proposal(),key:'records',bindings:[load,intent('create'),intent('list'),intent('get')]}];
    await f.adopt(f.payload(undefined,proposals));
  };
  await f.publish();return f;
}
export async function b5Http(t,f){
  const app=createApp({root:f.root,libraries:f.libraries,localHostname:'127.0.0.1',execution:{verifiedPackages:f.verifiedPackages??{}},logger:{error(){}}});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');let closed=false;
  const stop=async()=>{if(!closed){closed=true;await app.shutdown(server);}};t.after(stop);
  const base='http://127.0.0.1:'+server.address().port;
  const get=(route='/backoffice/pages/records',headers={})=>fetch(base+route,{headers:{Cookie:'wydgit-auth='+f.login.token,...headers}});
  const post=(body,csrf)=>fetch(base+'/backoffice/api/actions/invoke',{method:'POST',headers:{Cookie:'wydgit-auth='+f.login.token,Origin:base,'Content-Type':'application/json','X-Wydgit-CSRF':csrf},body:JSON.stringify(body)});
  return {base,get,post,stop};
}
export async function b5TaskboardFixture(t){
  const f=adoptionFixture(await installedTaskboardFixture(t,{async configure(f){
    const root=path.join(f.root,'gate');await fs.mkdir(root);f.config=configuration(root,'json',{registration:'open'});
    f.config.libraries[0].options.app='boilerplate';f.config.libraries[0].bindings[0].app='boilerplate';f.config.libraries[1].options.stores[0].app='boilerplate';
    await fs.writeFile(path.join(f.root,'wydgit.config.json'),JSON.stringify(f.config));
  }}));
  const e=f.entry();await executionPlacement({root:f.root,app:f.app,package:f.manifest.id,installation:e.receipt.id,revision:f.state().revision,action:'relocate',context:'BackOffice',installationContext:f.operator,verifiedPackages:f.verifiedPackages});
  await installMembershipLogin(f);
  f.gate=createGate(f.libraries.bind(new ExecutionContext({context:'FrontEnd',publisher:'host',package:'host:gate',self:'home',app:f.app,capabilities:gateManifest.capabilities,scopes:{wydgate:[f.app],wydgateBootstrap:[f.app]}})));
  f.password='Disposable-B5-taskboard-2026!';f.user=await f.gate.register({username:'alice',password:f.password});
  await f.gate.manageMember({id:f.user.membership.id,role:'administrator'});await f.gate.assignUser({userId:f.user.account.id,roles:[],permissions:['content.pages.view']});
  f.login=await f.gate.login('alice',f.password);await b5Publish(f,'taskboard');return f;
}
