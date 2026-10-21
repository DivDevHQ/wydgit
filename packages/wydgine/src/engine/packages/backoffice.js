import {loadRepository} from '../repository.js';
import {ExecutionContext,checkContext} from '../seam/context.js';
import {clean,freeze,record,WydgitError,requireThat as check} from '../object-model/validation.js';
import {effectiveLimits,SERVICE_DEFAULTS,checkJsonBudget} from '../libraries/limits.js';
import {authorizeLifecycle} from './budget.js';
import {acquirePackageExecution,activatePackages} from './index.js';
import {actionDeclarations,matchesContract,ACTION_LIMITS} from './backoffice-contract.js';
import {readInstalledState} from './state.js';
import {admitBackOffice,sameBackOffice} from './backoffice-enforcement.js';
import {renderSite,escapeHtml,pagePath} from '../index.js';
import {executePage} from '../execution/page.js';
import {checkPlacement} from '../execution/placement.js';
import {createCompletion} from '../execution/completion.js';
import {registerAppExecution} from '../execution/maintenance.js';
import {createExecutionBudget,executionBudget} from '../sewn/budget.js';

const equal=(a,b)=>JSON.stringify(clean(a))===JSON.stringify(clean(b));
const fail=code=>Object.freeze({ok:false,code,message:'BackOffice action request failed',details:Object.freeze({})});
const fields=(value,required,optional=[])=>check(record(value)&&required.every(k=>Object.hasOwn(value,k))&&Object.keys(value).every(k=>[...required,...optional].includes(k)),'ACTION.INVALID_REQUEST','Invalid request');
function valueFor(value,limits,contract,code) {
  try{checkJsonBudget(value,limits,code);const copy=clean(value);check(matchesContract(copy,contract),code,'Contract mismatch');return freeze(copy);}
  catch{throw new WydgitError(code,'Invalid action value');}
}

// Native adapter only. No mutable registration, callback, principal or service
// selector crosses this facade. Rebuild after stopped-App lifecycle transitions.
export function createBackOfficeActions({root,libraries,installationContext,verifiedPackages={}}) {
  const state=readInstalledState(root),model=loadRepository(root,{verifiedPackages}),app=model.runtime.rootId;
  authorizeLifecycle(installationContext,app);installationContext.require('packages.placement.manage');
  check(!state?.manualReplacement&&!state?.policyReconciliation,'PACKAGE.PENDING','App unavailable');
  activatePackages(model,libraries,root); // Reuse accepted library/mapping/ownership validation.
  const admitted=admitBackOffice({root,model,libraries}),records=new Map();
  const acquire=(entry,a,identity)=>{
    const context=acquirePackageExecution({root,app,package:entry.manifest.id,installation:entry.receipt.id,
      generation:entry.executionPlacement.generation,self:a.owner,installationContext,identity,verifiedPackages});
    return new ExecutionContext({...context,placement:context,limits:installationContext.limits});
  };
  for(const entry of state?.packages??[]) {
    const declarations=actionDeclarations(entry.manifest.backofficeActions??[],entry.manifest);
    if(entry.executionPlacement?.context!=='BackOffice'||entry.executionPlacement.status!=='active')continue;
    for(const a of declarations) {
      acquire(entry,a,null); // Full accepted package, tree and inherited placement validation.
      const service=libraries.administrativeOperation(a.service.library,a.service.operation);
      check(service&&service.apiVersion===a.service.apiVersion&&service.capability===a.capability&&service.effect===a.effect,
        'ACTION.SERVICE','Operation has not opted into this action contract');
      const id=`${entry.manifest.id}#${a.owner}/${a.id}`;
      check(!records.has(id)&&records.size<256,'ACTION.DECLARATION','Duplicate or excessive active actions');
      const approved=admitted.actions.get(id),reference=freeze(clean(approved.reference));
      const {service:implementation,owner,id:localId,...metadata}=a;
      const descriptor=freeze({schema:'wydgit.backoffice-action/1',id,name:localId,package:entry.manifest.id,version:entry.manifest.version,instance:owner,...metadata,reference});
      records.set(id,{entry,a,reference,descriptor,scope:approved.scope});
    }
  }
  // Session resolution is a narrow native authentication operation, never the
  // execution identity of the contributed action or a grant to package code.
  const authentication=libraries.bind(new ExecutionContext({context:'BackOffice',publisher:'wydgit.core',self:app,app,
    capabilities:['gate.sessions.use'],scopes:{wydgate:[app]}}));
  const identityFor=async request=>{
    checkContext(installationContext);
    check(request.app===app&&typeof request.session==='string'&&request.session.length<=256,'ACTION.DENIED','Wrong site or authentication');
    const result=await authentication.call('wydgate','resolve-session',{token:request.session});
    check(result.ok===true||result.code==='GATE.SESSION_INVALID','SERVICE.FAILED','Session verification unavailable');
    check(result.ok===true&&result.value?.authenticated===true&&result.value.app===app,'ACTION.DENIED','Authentication required');
    return result.value;
  };
  const authorize=async(record,identity,initiating)=>{
    admitted.checkCurrent();
    const {entry,a,scope}=record;
    let context=acquire(entry,a,identity);
    if(initiating){
      checkContext(initiating);
      check(initiating.app===app&&initiating.package===entry.manifest.id&&initiating.installation===entry.receipt.id&&
        sameBackOffice(initiating.identity,identity)&&initiating.capabilities.includes(a.capability)&&
        Object.entries(scope).every(([id,values])=>values.every(v=>(initiating.scopes[id]??[]).some(x=>sameBackOffice(x,v)))),
        'ACTION.DENIED','Initiating authority cannot be widened');
      context=initiating;
    }
    const nonResource=Object.fromEntries(Object.entries(context.scopes).filter(([key])=>['prototypes','events'].includes(key)));
    context=new ExecutionContext({...context,self:a.owner,placement:context,scopes:{...nonResource,...scope}});
    context.require(a.capability);
    check(Object.entries(a.scopes).every(([key,values])=>values.every(v=>entry.approved.scopes[key]?.includes(v))),
      'ACTION.DENIED','Required scope not approved');
    await libraries.authorizeSitePolicy(context,{contexts:['BackOffice'],permission:a.permission});
    const provider=a.service.library,resources=provider==='wydstore'
      ? a.scopes.wydstore.map(name=>entry.storageMappings[name])
      : libraries.resolvePackageScopes(provider,a.scopes[provider],app);
    await libraries.authorizeAdministrativeOperation(context,provider,a.service.operation,resources);
    checkContext(context);return context;
  };
  const lookup=ref=>{
    check(record(ref)&&typeof ref.package==='string'&&typeof ref.instance==='string'&&typeof ref.action==='string','ACTION.STALE','Invalid reference');
    const found=records.get(`${ref.package}#${ref.instance}/${ref.action}`);
    check(found&&equal(ref,found.reference),'ACTION.STALE','Unknown or obsolete action reference');return found;
  };
  const pageFor=key=>{admitted.checkCurrent();const page=admitted.pages.get(key);check(page,'PAGE.NOT_FOUND','Unknown Page entry');return page;};
  const authorizePage=async(page,identity)=>{
    admitted.checkCurrent();const {entry,proposal:p}=page,base=acquire(entry,{owner:p.owner},identity);
    await libraries.authorizeSitePolicy(base,{contexts:['BackOffice'],permission:p.permission});
    checkContext(base);admitted.checkCurrent();return new ExecutionContext({...base,self:p.page,placement:base});
  };
  const bind=pageBinding=>{
    fields(pageBinding,['schema','page','name','reference']);
    check(pageBinding.schema==='wydgit.backoffice-page-binding/1','ACTION.STALE','Unknown Page binding version');
    const page=pageFor(pageBinding.page?.key);
    check(equal(pageBinding.page,page.reference),'ACTION.STALE','Obsolete Page binding');
    const binding=page.proposal.bindings.find(b=>b.name===pageBinding.name);
    check(binding&&equal(binding.reference,pageBinding.reference),'ACTION.STALE','Unknown Page action');
    return {page,binding,registered:lookup(binding.reference)};
  };
  const bindingInput=(binding,input)=>{
    checkJsonBudget(input,ACTION_LIMITS,'ACTION.INVALID_INPUT');check(record(input),'ACTION.INVALID_INPUT','Object required');
    input=clean(input);
    for(const [key,value] of Object.entries(binding.fixedInput))check(!Object.hasOwn(input,key)||equal(input[key],value),'ACTION.INVALID_INPUT','Fixed input cannot be changed');
    const value={...input,...binding.fixedInput};
    check(binding.constraints.every(c=>matchesContract(value,c.input)),'ACTION.INVALID_INPUT','Consumer input constraint');return value;
  };
  const run=async(registered,identity,input,confirmed,{checkRequest,deadline,onStart,initiating,ledger:sharedLedger,completion:sharedCompletion}={})=>{
    const context=await authorize(registered,identity,initiating),{a}=registered,limits=effectiveLimits(SERVICE_DEFAULTS,context);
    checkRequest();input=valueFor(input,limits.request,a.input,'ACTION.INVALID_INPUT');
    check(confirmed===undefined||typeof confirmed==='boolean','ACTION.INVALID_REQUEST','Invalid confirmation');
    check(!a.confirmation||confirmed===true,'ACTION.CONFIRMATION','Confirmation required');
    const ledger=sharedLedger??executionBudget(createExecutionBudget(context,{guard:checkRequest,deadline}),context);
    const completion=sharedCompletion??createCompletion(()=>ledger.check());
    try{
      ledger.take('serviceCalls');
      const result=await completion.run(operation=>libraries.bind(context,Object.freeze({...operation,begin(){checkRequest();admitted.checkCurrent();checkContext(context);operation.begin();onStart?.();}})).invoke(a.service.library,a.service.apiVersion,a.service.operation,input));
      ledger.check();await authorize(registered,identity,initiating);ledger.check();
      if(!result.ok)return fail(result.code);
      const value=valueFor(result.value,limits.response,a.output,'ACTION.INVALID_RESULT');ledger.check();return {ok:true,value};
    }finally{if(!sharedLedger)ledger.close();if(!sharedCompletion)await completion.settle();}
  };
  const boundary=(work,enveloped=false)=>async (request,{guard=()=>{},deadline=Infinity,onStart=()=>{}}={})=>{
    let release;
    try{
      guard();check(Date.now()<deadline,'SEWN.LIMIT','Request deadline');
      release=registerAppExecution(root);
      checkJsonBudget(request,{...ACTION_LIMITS,maxBytes:49152},'ACTION.INVALID_REQUEST');
      const checkRequest=()=>{guard();check(Date.now()<deadline,'SEWN.LIMIT','Request deadline');};
      const value=await work(freeze(clean(request)),{checkRequest,deadline,onStart});checkRequest();return freeze(enveloped?value:{ok:true,value});
    }
    catch(error){return fail(['ACTION.INVALID_REQUEST','ACTION.INVALID_INPUT','ACTION.INVALID_RESULT','ACTION.CONFIRMATION','ACTION.STALE','SEWN.LIMIT','SERVICE.FAILED'].includes(error?.code)?error.code:'ACTION.DENIED');}
    finally{release?.();}
  };
  return Object.freeze({
    discover:boundary(async (request,{checkRequest})=>{
      const identity=await identityFor(request);checkRequest();fields(request,['app','session'],['offset','limit']);
      const offset=request.offset??0,limit=request.limit??10;
      check(Number.isSafeInteger(offset)&&offset>=0&&offset<=256&&Number.isSafeInteger(limit)&&limit>=1&&limit<=10,'ACTION.INVALID_REQUEST','Invalid page');
      const available=[];
      for(const record of records.values()) {
        checkRequest();
        try{await authorize(record,identity);available.push(record.descriptor);}catch{/* No metadata or denial details for unavailable actions. */}
        checkRequest();
      }
      const value={schema:'wydgit.backoffice-discovery/1',app,actions:available.slice(offset,offset+limit),offset,limit,total:available.length};
      checkJsonBudget(value,{maxBytes:65536,maxDepth:20,maxNodes:8192},'ACTION.INVALID_RESULT');return value;
    }),
    invoke:boundary(async (request,{checkRequest,deadline,onStart})=>{
      const identity=await identityFor(request);checkRequest();fields(request,['app','session','input'],['reference','pageBinding','confirmed']);
      check(Object.hasOwn(request,'reference')!==Object.hasOwn(request,'pageBinding'),'ACTION.INVALID_REQUEST','Choose one action envelope');
      let selected,linked;
      if(Object.hasOwn(request,'pageBinding')){
        linked=bind(request.pageBinding);check(linked.binding.usage==='intent','ACTION.DENIED','Preparation is not a browser intent');
        await authorizePage(linked.page,identity);selected=linked.registered;
      }else selected=lookup(request.reference);
      const result=await run(selected,identity,linked?bindingInput(linked.binding,request.input):request.input,request.confirmed,{checkRequest,deadline,onStart});
      if(linked){await authorizePage(linked.page,identity);if(result.ok)check(linked.binding.constraints.every(c=>matchesContract(result.value,c.output)),'ACTION.INVALID_RESULT','Consumer output constraint');}
      const fresh=await identityFor(request);check(fresh.userId===identity.userId&&fresh.sessionId===identity.sessionId,'ACTION.DENIED','Caller changed');
      return result;
    },true),
    // Native Page adapter uses the canonical executor. The only service surface
    // supplied to package Page code is a named read binding; no provider shortcut.
    async renderPage(request,{session,input,runtimeSettings,csrf,guard=()=>{},deadline=Infinity}={}){
      const release=registerAppExecution(root);let result;
      const checkRequest=()=>{guard();admitted.checkCurrent();check(Date.now()<deadline,'SEWN.LIMIT','Request deadline');};
      try{
        checkRequest();checkJsonBudget(request,ACTION_LIMITS,'ACTION.INVALID_REQUEST');request=freeze(clean(request));fields(request,['app','session','key']);
        const identity=await identityFor(request),page=pageFor(request.key),context=await authorizePage(page,identity);
        check(session.identity?.sessionId===identity.sessionId&&session.identity?.userId===identity.userId,'PAGE.DENIED','Wrong Session');
        const ids=page.facts.nodes.filter(n=>n.page===page.proposal.page).map(n=>n.id);
        for(const id of ids)checkPlacement(model.runtime.get(id),model.registry.get(model.runtime.get(id).prototype),context);
        const reauthorize=async()=>{checkRequest();await session.authorize();await authorizePage(page,identity);checkRequest();};
        const prepare=async({name,consumer,input,runtime,ledger,completion,guard:invocation})=>{
          invocation();await reauthorize();
          const binding=page.proposal.bindings.find(b=>b.name===name);
          check(binding&&binding.usage==='prepare','ACTION.DENIED','Only reviewed preparation bindings may execute');
          // An actual receiver is supplied by the executor, never by package input.
          // Newly constructed IDs do not acquire an accepted consumer's binding.
          check(consumer===binding.consumer&&ids.includes(consumer),'ACTION.DENIED','Unapproved runtime consumer');
          const actual=runtime.get(consumer),accepted=model.runtime.get(consumer),ancestry=[actual.prototype,...model.registry.get(actual.prototype).ancestors];
          check(actual.prototype===accepted.prototype&&binding.constraints.every(c=>ancestry.includes(c.type)), 'ACTION.DENIED','Runtime ancestry mismatch');
          const registered=lookup(binding.reference);check(registered.a.effect==='read','ACTION.DENIED','Preparation cannot mutate');
          const result=await run(registered,identity,bindingInput(binding,input),undefined,{checkRequest:()=>{invocation();checkRequest();},deadline,initiating:context,ledger,completion});
          await reauthorize();if(result.ok)check(binding.constraints.every(c=>matchesContract(result.value,c.output)),'ACTION.INVALID_RESULT','Consumer output constraint');return result;
        };
        const intents=[],consumers=new Map();
        for(const binding of page.proposal.bindings.filter(b=>b.usage==='intent')){
          if(!consumers.has(binding.consumer))consumers.set(binding.consumer,{id:binding.consumer,actions:[]});
          try{
            const registered=lookup(binding.reference);await authorize(registered,identity);
            const intent={schema:'wydgit.backoffice-page-binding/1',page:page.reference,name:binding.name,reference:binding.reference};intents.push(intent);
            const {a}=registered;
            // Presentation uses the most-derived reviewed input constraint. Fixed
            // top-level keys are supplied only by the server binding, never fields.
            const input=clean(binding.constraints.at(-1)?.input??a.input);
            for(const key of Object.keys(binding.fixedInput)){delete input.fields[key];if(input.optional)input.optional=input.optional.filter(k=>k!==key);}
            consumers.get(binding.consumer).actions.push({title:a.title,effect:a.effect,confirmation:a.confirmation??'',operation:a.service.operation,
              input,output:a.output,fixedInput:binding.fixedInput,binding:intent});
          }catch{/* Page admission grants no action visibility. */}
        }
        result=await executePage({model,pageId:page.proposal.page,session,input,context,runtimeSettings,handlers:activatePackages(model,libraries,root).handlers,
          libraries,csrf,backoffice:{prepare},render:async(projection,route,options)=>{
            const controls={schema:'wydgit.backoffice-controls/1',consumers:[...consumers.values()]};
            checkJsonBudget(controls,{maxBytes:262144,maxDepth:24,maxNodes:32768},'ACTION.INVALID_RESULT');
            const output=await renderSite(projection,pagePath(model.pages.get(page.proposal.page),model.site),options);
            output.html=output.html.replace('</head>',`<meta name="wydgit-backoffice-csrf" content="${escapeHtml(csrf)}"><meta name="wydgit-backoffice-bindings" content="${escapeHtml(JSON.stringify(intents))}"><meta name="wydgit-backoffice-controls" content="${escapeHtml(JSON.stringify(controls))}"><link rel="stylesheet" href="/backoffice/assets/shell.css"><script type="module" src="/runtime/wydclient/backoffice-controls.js"></script></head>`);return output;
          },cancelled:()=>{try{checkRequest();return false;}catch{return true;}}});
        await reauthorize();
        // Publication rechecks happen immediately before any success bytes.
        return {result,async send(res){await reauthorize();res.setHeader('Cache-Control','no-store');res.setHeader('X-Wydgit-Operation-Outcome',result.outcome);await result.response.send(res);},async close(){try{await result.response.close();}finally{release();}}};
      }catch(error){await result?.response.close();release();throw error;}
    }
  });
}
