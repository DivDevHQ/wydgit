// Non-authoritative candidate validation. No context, grant, approval, service
// dispatch or durable mutation is created here. Live admission remains separate.
import {clean,freeze,record} from '../object-model/validation.js';
import {validId} from '../object-model/schema.js';
import {isCapability} from '../seam/capabilities.js';
import {checkJsonBudget} from '../libraries/limits.js';
import {localName,validatePackageManifest,permissions} from './manifest.js';
import {actionDeclarations,valueContract,matchesContract} from './backoffice-contract.js';
import {policyHash,approvedPolicyHash} from './policy-contract.js';

export const PREFLIGHT_LIMITS=Object.freeze({maxBytes:4*1024*1024,maxDepth:64,maxNodes:131072});
const same=(a,b)=>JSON.stringify(clean(a))===JSON.stringify(clean(b));
const has=(xs,x)=>(xs??[]).some(v=>same(v,x));
const subset=(a,b)=>a.every(x=>has(b,x));
const closed=(x,keys)=>record(x)&&keys.every(k=>Object.hasOwn(x,k))&&Object.keys(x).every(k=>keys.includes(k));
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
// Store physical identifiers use the existing provider grammar, distinct from
// package logical localName. Ownership/policy still come from validated facts.
const storeName=x=>typeof x==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(x)&&!['constructor','prototype','__proto__'].includes(x);
const uuid=x=>typeof x==='string'&&/^[a-f0-9-]{36}$/.test(x);
export const candidateHash=policyHash;
export const actionReference=(entry,action,app)=>({schema:'wydgit.backoffice-reference/1',app,package:entry.manifest.id,
  installation:entry.receipt.id,instance:action.owner,action:action.id,generation:entry.executionPlacement?.generation??null,
  revision:policyHash({action,receipt:entry.receipt,policyRevision:entry.policyRevision??0})});
function input(value,keys){checkJsonBudget(value,PREFLIGHT_LIMITS,'BACKOFFICE.INVALID_CANDIDATE');if(!record(value)||Object.keys(value).some(k=>!keys.includes(k)))throw Error();return clean(value);}
function reporter(identity,requirement,source){
  const findings=[];
  const add=(code,contract,remediation,{severity='error',reviewRequired=true,reject=true}={})=>findings.push({
    code,severity,...identity,requirement,contract,evidenceSource:source,remediation,reviewRequired,enforcementWouldReject:reject});
  return {findings,add,result(value={}){return freeze({schema:'wydgit.backoffice-validation/1',valid:!findings.some(f=>f.severity==='error'),
    authority:false,liveAuthorization:'not-checked',...value,findings});}};
}
function reviewCandidate(review,subject,contractHash,entry,app,r){
  if(review===undefined){r.add('BO.REVIEW_REQUIRED','Explicit reviewed migration/publication is required.',
    'Submit the exact candidate to the future native reviewed-policy workflow.',{severity:'warning'});return 'missing';}
  const keys=['schema','app','package','installation','generation','policyRevision','subject','contractHash','status'];
  if(!closed(review,keys)||review.schema!=='wydgit.backoffice-review-candidate/1'||!['reviewed','revoked'].includes(review.status)||!sha(review.contractHash)){
    r.add('BO.REVIEW_INVALID','Review candidate has a closed versioned representation.','Rebuild review evidence for this exact candidate.');return 'invalid';}
  if(review.status==='revoked'){
    r.add('BO.REVIEW_REVOKED','Represented revocation cannot satisfy review.','Obtain fresh independent native review.');return 'revoked';}
  if(review.app!==app||review.package!==entry.manifest.id||review.installation!==entry.receipt.id||
    review.generation!==entry.executionPlacement?.generation||review.policyRevision!==(entry.policyRevision??0)||
    review.subject!==subject||review.contractHash!==contractHash){
    r.add('BO.REVIEW_STALE','Review must bind exact identity, generation, policy and candidate.','Review the current exact candidate.');return 'stale';}
  r.add('BO.REVIEW_UNPUBLISHED','Matching review candidate is not authenticated durable approval.',
    'B4 must publish and verify adoption using native policy authority.',{severity:'warning'});return 'matching-candidate';
}
function entryChecks(entry,app,r){
  const m=validatePackageManifest(entry.manifest);
  permissions(entry.approved);
  if(!validId(app)||entry.receipt?.package!==m.id||entry.receipt.publisher!==m.publisher||entry.receipt.version!==m.version||
    entry.receipt.schema!=='wydgit-install-receipt/0.1'||!uuid(entry.receipt.id))
    r.add('BO.INSTALLATION_IDENTITY','Exact accepted installation identity is required.','Restore a valid accepted receipt; do not edit mirrored identities.');
  for(const key of ['approved','storageMappings','instanceIds','placement'])if(!same(entry[key],entry.receipt[key]))
    r.add('BO.RECEIPT_DRIFT','Receipt and installation metadata must agree.','Restore exact accepted metadata before review.');
  if(!same(entry.executionPlacement??null,entry.receipt.executionPlacement??null)||
    entry.policyRevision!==entry.receipt.policyRevision||entry.policyRevision!==undefined&&entry.receipt.policyHash!==approvedPolicyHash(entry,app))
    r.add('BO.RECEIPT_DRIFT','Placement and policy evidence must match the receipt.','Restore accepted policy and placement integrity.');
  if(entry.state!=='installed'||entry.executionPlacement?.app!==app||entry.executionPlacement.context!=='BackOffice'||
    entry.executionPlacement.status!=='active'||!uuid(entry.executionPlacement.generation))
    r.add('BO.PLACEMENT','Only this App\'s exact active BackOffice installation is eligible.','Review placement/reactivation separately; retain data without execution.');
  for(const [provider,values] of Object.entries(entry.approved.scopes))if(!subset(values,m.permissions.scopes[provider]??[]))
    r.add('BO.RECEIPT_AUTHORITY','Approved resource grants must remain within package requirements.','Use reviewed receipt reconciliation.');
  const expectedStoreScope=m.storage.filter(s=>entry.approved.scopes.wydstore.includes(s.name)).map(s=>entry.storageMappings[s.name]).filter(Boolean);
  if(!same(entry.storageScopes??[],expectedStoreScope)||!same(entry.libraryScopes??{},entry.receipt.libraryScopes??{})||Object.keys(entry.libraryScopes??{}).some(k=>['wydstore','prototypes','events'].includes(k)))
    r.add('BO.RECEIPT_DRIFT','Concrete scope must match approved mappings and mirrored library evidence.','Restore exact accepted scope evidence.');
  if(!subset(entry.approved.capabilities,m.permissions.capabilities))
    r.add('BO.RECEIPT_AUTHORITY','Approved capabilities must remain within package requirements.','Use reviewed receipt reconciliation.');
  return m;
}
const serviceRule=(store,collection,op)=>store.authorization===undefined?null:store.authorization.collections?.[collection]?.[op];
// The registry supplies fixed-operation availability/capability/effect. Store
// ownership and policies below are structural predicates, never caller policy.
export function validateBackOfficeActionScope(raw){
  const r=reporter({},'BO-ACT-10','candidate');
  try{
    const {entry,app,action,operation,stores=[],resolvedScopes={},initiating,review}=input(raw,['entry','app','action','operation','stores','resolvedScopes','initiating','review']);
    const m=entryChecks(entry,app,r),identity={app,package:m.id,installation:entry.receipt.id,action:action?.id??null};
    const detail=reporter(identity,'BO-ACT-10','candidate/action');
    detail.findings.push(...r.findings.map(f=>({...f,...identity})));r.findings.length=0;
    const a=action;
    if(!record(a?.scopes)||Object.keys(a.scopes).length===0)detail.add('BO.SCOPE_MISSING','Every action needs nonempty required resources/maxima.','Publish an explicit versioned action declaration; absence never means receipt-wide.');
    for(const [provider,names] of Object.entries(a?.scopes??{})){
      if(!localName(provider)||!Array.isArray(names)||names.length===0||new Set(names).size!==names.length||!names.every(v=>typeof v==='string'&&v.length<=128&&!/[*?]/.test(v)))
        detail.add('BO.SCOPE_INVALID','Resources are finite, unique exact logical names.','Remove empty, duplicate, malformed or wildcard requirements.');
      else if(!subset(names,m.permissions.scopes[provider]??[]))detail.add('BO.RESOURCE_UNKNOWN','Action resources must be package-declared requirements.','Publish valid package requirements and mappings.');
    }
    try{actionDeclarations([a],m);}catch{detail.add('BO.ACTION_DECLARATION','Action must satisfy the existing closed declaration contract.','Correct required fields, capability, operation binding and value contracts.');}
    if(!entry.instanceIds.includes(a?.owner))detail.add('BO.ACTION_OWNER','Action owner must be an exact managed instance.','Select an accepted managed owner.');
    if(!operation||operation.apiVersion!==a?.service?.apiVersion||operation.capability!==a?.capability||operation.effect!==a?.effect)
      detail.add('BO.OPERATION','Only the installed trusted fixed operation/API/effect is supported.','Select an opted-in operation and its exact capability/effect.');
    if(!entry.approved.capabilities.includes(a?.capability))detail.add('BO.CAPABILITY_APPROVAL','Operation capability must be independently approved.','Obtain reviewed capability approval within declared package requirements.');
    const declared={},approved={wydstore:entry.storageScopes??[],...entry.libraryScopes},effective={},policyRequirements=[];
    for(const [provider,names] of Object.entries(a?.scopes??{})){
      if(!Array.isArray(names)||!names.every(v=>typeof v==='string'&&v.length<=128&&!/[*?]/.test(v)))continue;
      if(!subset(names,entry.approved.scopes[provider]??[]))detail.add('BO.SCOPE_UNAPPROVED','All required logical resources must be approved.','Reconcile the receipt through explicit native review.');
      if(provider==='wydstore'){
        declared[provider]=names.map(name=>entry.storageMappings[name]).filter(Boolean);
        if(declared[provider].length!==names.length)detail.add('BO.MAPPING_MISSING','Every required Store resource needs an accepted mapping.','Supply reviewed exact mappings, never infer from input.');
        for(const resource of declared[provider]){
          if(!closed(resource,['store','collection'])||!storeName(resource.store)||!storeName(resource.collection)){
            detail.add('BO.MAPPING_INVALID','Store resource scope is an exact store/collection pair.','Restore valid accepted mappings.');continue;}
          const store=stores.find(s=>s.id===resource.store),collection=store?.collections?.find(c=>c.id===resource.collection);
          if(!store||!collection){detail.add('BO.RESOURCE_UNKNOWN','Mapped Store resource must exist in trusted configuration.','Review resource configuration.');continue;}
          if(store.app!==app||store.publisher!==m.publisher||store.package!==m.id||
            (store.principal??store.package)!==m.id||store.installation!==undefined&&store.installation!==entry.receipt.id)
            detail.add('BO.RESOURCE_OWNER','Exact site/publisher/package/principal/optional installation ownership is required.','Use this installation\'s own approved resources; cross-owner sharing is unsupported.');
          const rule=serviceRule(store,resource.collection,a.service.operation);
          if(store.authorization!==undefined&&(!rule||!rule.contexts.includes('BackOffice')))
            detail.add('BO.REQUIRED_POLICY','All declared resources need the fixed operation\'s BackOffice policy.','Review every required operation rule; keep conservative preflight.');
          policyRequirements.push({resource,operation:a.service.operation,permission:rule?.permission??null,
            policy:store.authorization===undefined?'unprotected':rule?.public===true?'public':'protected',contexts:rule?.contexts??[],liveCheckRequired:true});
        }
      }else if(provider==='wydgate'&&provider===a?.service?.library){
        declared[provider]=resolvedScopes[provider]??[];
        if(names.length!==1||names[0]!=='current-app'||!same(declared[provider],[app]))
          detail.add('BO.RESOLUTION','Gate scope must resolve current-app to the exact canonical site.','Use the trusted canonical library scope resolver.');
      }else{
        declared[provider]=resolvedScopes[provider]??[];
        detail.add('BO.RESOLVER_UNSUPPORTED','Additional resource providers need trusted required-resource validation.','Qualify the library validator before strict adoption.');
      }
      const requested=declared[provider]??[];
      if(!subset(requested,approved[provider]??[]))detail.add('BO.SCOPE_UNAPPROVED','Every concrete required resource must fit approved receipt scope.','Review receipt authority; do not silently clip required resources.');
      if(initiating&&(!subset(requested,initiating.scopes?.[provider]??[])||initiating.app!==app||
        initiating.package!==m.id||initiating.installation!==entry.receipt.id||!initiating.capabilities?.includes(a.capability)))
        detail.add('BO.INITIATING_SCOPE','In-process calls retain the original server identity, capabilities and scope.','Keep the original caller and reduce scope; do not acquire callee authority.');
      effective[provider]=requested.filter(v=>has(approved[provider],v)&&(!initiating||has(initiating.scopes?.[provider],v)));
    }
    if(Object.values(declared).some(values=>values.length>1))detail.add('BO.MULTI_RESOURCE_REVIEW','A multi-resource maximum needs explicit review of every required resource.',
      'Review required preflight and actual transaction envelope/member permissions.',{severity:'info',reject:false});
    const hash=policyHash({app,package:m.id,installation:entry.receipt.id,generation:entry.executionPlacement?.generation??null,
      policyRevision:entry.policyRevision??0,action:a,receipt:entry.receipt,artifact:policyHash({manifest:m,resources:entry.resources}),
      operation:operation??null,policyRequirements,approved:entry.approved,storageMappings:entry.storageMappings,
      approvedResources:approved,declaredMaximum:declared});
    const reviewState=reviewCandidate(review,`action:${a.owner}/${a.id}`,hash,entry,app,detail);
    return detail.result({identity,contractHash:hash,declaredResources:a.scopes??null,approvedResources:approved,
      legacyExposure:approved,declaredMaximum:declared,restrictiveScope:effective,reviewState,
      transaction:a.service.operation==='transaction'?{sameStoreOnly:true,allMembersRequireLiveAuthorization:true}:null,
      policyRequirements,liveChecksRequired:['session','action-permission','actual-target-policy','lifetime','transaction-members'],enforcementReady:false});
  }catch{r.add('BO.INVALID_CANDIDATE','Candidate must be bounded canonical JSON with a valid package/receipt.','Correct the candidate using canonical package validation.');return r.result({enforcementReady:false});}
}
// Conservative JSON-contract containment, using the existing contract grammar.
function contractSubset(a,b){
  valueContract(a);valueContract(b);if(a.type!==b.type)return false;
  if(a.type==='string')return a.maxLength<=b.maxLength;
  if(a.type==='integer')return a.min>=b.min&&a.max<=b.max;
  if(a.type==='array')return a.maxItems<=b.maxItems&&contractSubset(a.items,b.items);
  if(a.type==='object')return Object.entries(a.fields).every(([k,v])=>Object.hasOwn(b.fields,k)&&contractSubset(v,b.fields[k]))&&
    Object.keys(b.fields).filter(k=>!(b.optional??[]).includes(k)).every(k=>Object.hasOwn(a.fields,k)&&!(a.optional??[]).includes(k));
  return true;
}
export function validateBackOfficePageEntry(raw){
  let r=reporter({},'BO-HTTP-09','candidate/page');
  try{
    const {proposal,entry,app,pages,nodes,review}=input(raw,['proposal','entry','app','pages','nodes','review']),m=entryChecks(entry,app,r);
    const identity={app,package:m.id,installation:entry.receipt.id,page:proposal?.page??null};
    const previous=r;r=reporter(identity,'BO-HTTP-09','candidate/page');r.findings.push(...previous.findings.map(f=>({...f,...identity})));
    const p=proposal,keys=['schema','key','app','package','installation','owner','page','generation','policyRevision','permission','bindings'];
    if(!closed(p,keys)||p.schema!=='wydgit.backoffice-page-entry-proposal/1'||!localName(p.key)||!validId(p.page)||!validId(p.owner)||!isCapability(p.permission)||p.permission.length>128||!Array.isArray(p.bindings)||p.bindings.length>32){
      r.add('BO.PAGE_DECLARATION','Page entry is a closed versioned proposal with exact entry permission and finite bindings.','Supply an explicit Page proposal and independent permission; placement does not publish it.');return r.result({enforcementReady:false});}
    if(p.app!==app||p.package!==m.id||p.installation!==entry.receipt.id||!entry.instanceIds.includes(p.owner))
      r.add('BO.PAGE_IDENTITY','Page owner/site/package/installation must match the accepted installation.','Bind the exact managed owner and canonical App.');
    if(p.generation!==entry.executionPlacement?.generation||p.policyRevision!==(entry.policyRevision??0))
      r.add('BO.PAGE_STALE','Page proposal pins current generation and policy revision.','Rebuild and review the current exact entry.');
    if(!pages.includes(p.page)||!nodes.some(n=>n.id===p.page&&n.isPage===true)||!nodes.some(n=>n.id===p.owner&&n.page===p.page))
      r.add('BO.PAGE_ROOT','Entry must resolve the exact accepted App-owned Page attachment.','Select an accepted Page root; do not grant an arbitrary wrapper.');
    const declarations=actionDeclarations(m.backofficeActions??[],m),names=new Set();
    for(const b of p.bindings){
      if(!closed(b,['name','consumer','reference','usage','fixedInput','constraints'])||!localName(b.name)||names.has(b.name)||
        !['prepare','intent'].includes(b.usage)||!record(b.fixedInput)||!Array.isArray(b.constraints)||b.constraints.length===0||b.constraints.length>32){
        r.add('BO.BINDING_DECLARATION','Bindings are unique named reference data, not authority-bearing configuration.','Remove capability/handler/context fields and supply closed typed constraints.');continue;}
      names.add(b.name);
      const consumer=nodes.find(n=>n.id===b.consumer&&n.page===p.page),a=declarations.find(a=>a.owner===b.reference?.instance&&a.id===b.reference?.action);
      if(!consumer||!a||!same(b.reference,actionReference(entry,a,app))){
        r.add('BO.BINDING_REFERENCE','Binding resolves the exact current same-installation action and Page consumer.','Resolve the exact installed action; never search a foreign site/package/receipt.');continue;}
      if(b.usage==='prepare'&&a.effect!=='read')r.add('BO.PREPARE_WRITE','Page lifecycle/preparation may invoke read-effect actions only.','Submit mutations as separately admitted explicit intents.');
      if(!Object.entries(b.fixedInput).every(([key,v])=>Object.hasOwn(a.input.fields,key)&&matchesContract(v,a.input.fields[key])))
        r.add('BO.BINDING_INPUT','Fixed inputs are typed action parameters, never capabilities.','Use declared action fields and types.');
      let parent;
      for(const c of b.constraints){
        if(!closed(c,['type','targets','effect','input','output'])||!consumer.ancestors.includes(c.type)||
          !Array.isArray(c.targets)||c.targets.length===0||c.targets.length>32||new Set(c.targets).size!==c.targets.length||
          !c.targets.every(target=>typeof target==='string'&&target.split('/').length===2&&target.split('/').every(validId))||
          !['read','write'].includes(c.effect)||!c.targets.every(target=>declarations.some(a=>target===`${a.owner}/${a.id}`))){
          r.add('BO.BINDING_CONSTRAINT','Constraint sources must be actual prototype ancestry and finite local targets.','Use base-to-derived typed constraint evidence.');continue;}
        const target=`${a.owner}/${a.id}`;
        if(!c.targets.includes(target)||c.effect!==a.effect||!contractSubset(c.input,a.input)||!contractSubset(a.output,c.output)||
          parent&&(!subset(c.targets,parent.targets)||c.effect!==parent.effect||!contractSubset(c.input,parent.input)||!contractSubset(c.output,parent.output)||
            consumer.ancestors.indexOf(c.type)>=consumer.ancestors.indexOf(parent.type)))
          r.add('BO.BINDING_EXPANSION','Nested/inherited bindings cannot widen targets, effect or typed ancestor constraints.','Narrow the binding and obtain review; inheritance grants no authority.');
        parent=c;
      }
    }
    const hash=policyHash({proposal:p,artifact:policyHash({manifest:m,resources:entry.resources}),receipt:entry.receipt,nodes});
    const reviewState=reviewCandidate(review,`page:${p.key}`,hash,entry,app,r);
    return r.result({identity,contractHash:hash,reviewState,pageEntryApproved:false,enforcementReady:false,
      liveChecksRequired:['session','page-permission','action-permission','actual-target-policy','entry-approval','lifetime']});
  }catch{r.add('BO.INVALID_CANDIDATE','Page proposal must be bounded canonical JSON using valid installed facts.','Correct the closed candidate contract.');return r.result({enforcementReady:false});}
}
