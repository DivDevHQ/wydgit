import {loadRepository} from '../repository.js';
import {ExecutionContext,checkContext} from '../seam/context.js';
import {clean,freeze,record,WydgitError,requireThat as check} from '../object-model/validation.js';
import {effectiveLimits,SERVICE_DEFAULTS,checkJsonBudget} from '../libraries/limits.js';
import {authorizeLifecycle} from './budget.js';
import {acquirePackageExecution,activatePackages} from './index.js';
import {actionDeclarations,matchesContract,ACTION_LIMITS} from './backoffice-contract.js';
import {digest,readInstalledState} from './state.js';
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
  const records=new Map();
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
      const reference=freeze({schema:'wydgit.backoffice-reference/1',app,package:entry.manifest.id,installation:entry.receipt.id,
        instance:a.owner,action:a.id,generation:entry.executionPlacement.generation,
        revision:digest(JSON.stringify(clean({action:a,receipt:entry.receipt,policyRevision:entry.policyRevision??0})))});
      const {service:implementation,owner,id:localId,...metadata}=a;
      const descriptor=freeze({schema:'wydgit.backoffice-action/1',id,name:localId,package:entry.manifest.id,version:entry.manifest.version,instance:owner,...metadata,reference});
      records.set(id,{entry,a,reference,descriptor});
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
  const authorize=async(record,identity)=>{
    const {entry,a}=record,context=acquire(entry,a,identity);
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
      const identity=await identityFor(request);checkRequest();fields(request,['app','session','reference','input'],['confirmed']);
      const ref=request.reference;
      check(record(ref)&&typeof ref.package==='string'&&typeof ref.instance==='string'&&typeof ref.action==='string','ACTION.STALE','Invalid reference');
      const registered=records.get(`${ref.package}#${ref.instance}/${ref.action}`);
      check(registered&&equal(ref,registered.reference),'ACTION.STALE','Unknown or obsolete action reference');
      const context=await authorize(registered,identity),{a}=registered,limits=effectiveLimits(SERVICE_DEFAULTS,context);
      checkRequest();
      const input=valueFor(request.input,limits.request,a.input,'ACTION.INVALID_INPUT');
      check(request.confirmed===undefined||typeof request.confirmed==='boolean','ACTION.INVALID_REQUEST','Invalid confirmation');
      check(!a.confirmation||request.confirmed===true,'ACTION.CONFIRMATION','Confirmation required');
      // Invoke only the installed fixed binding, with the genuine principal and
      // exact approved package context. The service owns operation authorization.
      const ledger=executionBudget(createExecutionBudget(context,{guard:checkRequest,deadline}),context);
      const completion=createCompletion(()=>ledger.check());
      try{
        ledger.take('serviceCalls');
        const result=await completion.run(operation=>libraries.bind(context,Object.freeze({...operation,begin(){operation.begin();onStart();}})).invoke(a.service.library,a.service.apiVersion,a.service.operation,input));
        ledger.check();
        await libraries.authorizeSitePolicy(context,{contexts:['BackOffice'],permission:a.permission});ledger.check();
        if(!result.ok)return fail(result.code);
        const value=valueFor(result.value,limits.response,a.output,'ACTION.INVALID_RESULT');ledger.check();
        return {ok:true,value};
      }finally{ledger.close();await completion.settle();}
    },true)
  });
}
