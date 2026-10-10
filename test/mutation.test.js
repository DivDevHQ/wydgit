import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hydrate, serialize, dehydrate, PrototypeRegistry, ExecutionContext, resultOf } from '../wydgine/object-model/index.js';
import { loadRepository } from '../wydgine/repository.js';
import { webModel } from '../wydgine/web-model.js';
import { renderSite } from '../wydgine/index.js';
import { projectRoot } from '../app.js';
const slot = (extra = {}) => ({accepts:['acme/item'],ordered:true,...extra});
const registry = () => new PrototypeRegistry([
 {id:'wydgit.core/app',publisher:'wydgit.core',slots:{children:slot({min:1,max:5}),other:slot()}},
 {id:'acme/item',publisher:'acme',properties:{title:{type:'string',required:true},note:{type:'string'},count:{type:'number',default:1},data:{type:'object'}},slots:{children:slot({max:3}),other:slot()}},
 {id:'other/widget',publisher:'other',properties:{},slots:{}}
]);
const node = (id, children = []) => ({schema:'wydgit/0.2',id,prototype:'acme/item',properties:{title:id},slots:{children},provenance:{}});
const tree = () => ({schema:'wydgit/0.2',id:'app',prototype:'wydgit.core/app',properties:{},slots:{children:[node('a',[node('aa')]),node('b'),node('c')]},provenance:{}});
const allIds = ['app','a','aa','b','c','new','new-child','copy','copy-child','replacement','other'];
const context = (extra = {}) => new ExecutionContext({publisher:'acme',self:'a',visible:allIds,editable:allIds,capabilities:['object.instances.edit'],...extra});
const runtime = () => hydrate(tree(),registry(),{revision:7});
const code = (fn, expected) => assert.throws(fn,e=>e.code===expected,expected);

test('property edits create a new immutable snapshot and net changes, never mutate originals', () => {
 const original=runtime(), before=serialize(original), edit=original.edit(context());
 edit.setProperty('a','title','New title'); edit.setProperty('a','note','Optional'); edit.resetProperty('a','note');
 edit.setProperty('b','count',4); edit.resetProperty('b','count');
 const report=edit.changes(); assert.deepEqual(report,{added:[],modified:['a'],moved:[],removed:[]});
 assert.throws(()=>report.modified.push('b'),TypeError);
 const result=edit.commit();
 assert.notEqual(result.runtime,original);assert.equal(result.runtime.get('a').properties.title,'New title');
 assert.equal(serialize(original),before);assert.equal(result.runtime.get('b').properties.count,1);
 assert.throws(()=>{result.runtime.get('a').properties.title='bad';},TypeError);
 assert.throws(()=>result.runtime.get('a').slots.children.push('b'),TypeError);
 assert.equal(result.revision,8);assert.equal(result.baseRevision,7);
 code(()=>edit.setProperty('a','title','closed'),'MUTATION.CLOSED');code(()=>edit.commit(),'MUTATION.CLOSED');
});

test('property errors and required removal fail immediately and do not poison the session', () => {
 const original=runtime(), edit=original.edit(context()), before=serialize(original);
 code(()=>edit.setProperty('a','title',42),'MUTATION.INVALID_PROPERTY');
 code(()=>edit.setProperty('a','unknown',true),'MUTATION.INVALID_PROPERTY');
 code(()=>edit.resetProperty('a','title'),'MUTATION.INVALID_PROPERTY');
 for(const key of ['id','prototype'])code(()=>edit.setProperty('a',key,'b'),'MUTATION.IDENTITY');
 assert.equal(serialize(edit.commit().runtime),before);
});

test('insert creates a complete subtree; input aliases cannot modify accepted state', () => {
 const original=runtime(),edit=original.edit(context()), child=node('new',[node('new-child')]);
 edit.insertChild('b','children',0,child);child.properties.title='tampered';child.slots.children.length=0;
 const result=edit.commit();assert.equal(result.runtime.get('new').properties.title,'new');assert.equal(result.runtime.get('new-child').id,'new-child');
 assert.deepEqual(result.changes,{added:['new','new-child'],modified:['b'],moved:[],removed:[]});
 code(()=>original.get('new'),'OBJECT.UNKNOWN');
});

test('invalid child types, unknown slots and both cardinality bounds reject atomically', () => {
 const original=runtime(),edit=original.edit(context());
 code(()=>edit.insertChild('app','missing',0,node('new')),'MUTATION.INVALID_SLOT');
 code(()=>edit.insertChild('app','children',0,{...node('new'),prototype:'other/widget',properties:{},slots:{}}),'MUTATION.CHILD_TYPE');
 edit.remove('b');edit.remove('c');
 code(()=>edit.remove('a'),'MUTATION.CARDINALITY');
 assert.deepEqual(edit.commit().runtime.get('app').slots.children,['a']);
 const max=original.edit(context());max.insertChild('app','children',3,node('new'));max.insertChild('app','children',4,node('other'));
 code(()=>max.insertChild('app','children',5,node('replacement')),'MUTATION.CARDINALITY');
 assert.equal(max.commit().runtime.get('app').slots.children.length,5);
});

test('reorder and cross-parent/slot moves preserve all subtree identities', () => {
 const original=runtime(), edit=original.edit(context());
 edit.moveChild('a','app','children',2);
 assert.deepEqual(edit.changes().moved,['a']);
 edit.moveChild('a','b','other',0);
 const result=edit.commit();assert.deepEqual(result.runtime.get('app').slots.children,['b','c']);
 assert.deepEqual(result.runtime.get('b').slots.other,['a']);assert.deepEqual(result.runtime.get('a').slots.children,['aa']);
 assert.equal(result.runtime.get('aa').id,'aa');assert.deepEqual(result.changes.moved,['a']);
 assert.deepEqual(original.get('app').slots.children,['a','b','c']);
});

test('cycle, root mutation and invalid index fail; no graph can acquire multiple parents', () => {
 const original=runtime(),edit=original.edit(context());
 code(()=>edit.moveChild('a','aa','children',0),'MUTATION.CYCLE');
 code(()=>edit.moveChild('app','b','children',0),'MUTATION.IDENTITY');
 code(()=>edit.remove('app'),'MUTATION.IDENTITY');code(()=>edit.replaceChild('app',node('new')),'MUTATION.IDENTITY');
 code(()=>edit.moveChild('a','b','children',9),'MUTATION.INDEX');
 code(()=>edit.insertChild('b','children',0,node('a')),'MUTATION.DUPLICATE_ID');
 const shared=node('new-child'),parent=node('new',[shared,shared]);
 code(()=>edit.insertChild('b','children',0,parent),'OBJECT.MULTIPLE_PARENTS');
 assert.equal(serialize(edit.commit().runtime),serialize(original));
});

test('delete removes the subtree, reserves IDs, and permits moving descendants out first', () => {
 const original=runtime(),edit=original.edit(context());edit.remove('a');
 code(()=>edit.insertChild('app','children',0,node('a')),'MUTATION.DUPLICATE_ID');
 code(()=>edit.setProperty('a','title','gone'),'MUTATION.NOT_FOUND');
 const result=edit.commit();code(()=>result.runtime.get('a'),'OBJECT.UNKNOWN');code(()=>result.runtime.get('aa'),'OBJECT.UNKNOWN');
 assert.deepEqual(result.changes.removed,['a','aa']);
 const rescue=original.edit(context());rescue.moveChild('aa','b','children',0);rescue.remove('a');assert.equal(rescue.commit().runtime.get('aa').id,'aa');
 const transient=original.edit(context());transient.insertChild('b','children',0,node('new'));transient.remove('new');
 assert.deepEqual(transient.changes(),{added:[],modified:[],moved:[],removed:[]});
 code(()=>transient.insertChild('b','children',0,node('new')),'MUTATION.DUPLICATE_ID');
});

test('replace validates the resulting tree atomically and requires new identity', () => {
 const edit=runtime().edit(context());edit.remove('b');edit.remove('c');
 edit.replaceChild('a',node('replacement'));
 const result=edit.commit();assert.deepEqual(result.runtime.get('app').slots.children,['replacement']);assert.deepEqual(result.changes.removed,['a','aa','b','c']);
 const same=runtime().edit(context());code(()=>same.replaceChild('a',node('a')),'MUTATION.DUPLICATE_ID');
});

test('clone requires complete fresh ID mapping, preserves original and rejects duplicates', () => {
 const original=runtime(),edit=original.edit(context());
 code(()=>edit.cloneChild('a','b','children',0,[['a','copy']]),'MUTATION.IDENTITY');
 code(()=>edit.cloneChild('a','b','children',0,[['a','copy'],['aa','copy']]),'MUTATION.DUPLICATE_ID');
 code(()=>edit.cloneChild('a','b','children',0,[['a','a'],['aa','copy-child']]),'MUTATION.DUPLICATE_ID');
 edit.cloneChild('a','b','children',0,[['a','copy'],['aa','copy-child']]);
 const result=edit.commit();assert.equal(result.runtime.get('copy').properties.title,'a');assert.deepEqual(result.runtime.get('copy').slots.children,['copy-child']);
 assert.deepEqual(result.changes.added,['copy','copy-child']);assert.equal(result.runtime.get('aa').id,'aa');
});

test('SEAM denies missing capability, visibility, edit scope and inherited authority', () => {
 const original=runtime();code(()=>original.edit(),'SEAM.CONTEXT');code(()=>original.edit({}),'SEAM.CONTEXT');
 code(()=>original.edit(context({capabilities:[]})),'MUTATION.DENIED');
 const limited=original.edit(context({visible:['a'],editable:['a']}));
 limited.setProperty('a','title','Allowed');
 code(()=>limited.setProperty('b','title','Hidden'),'MUTATION.DENIED');
 code(()=>limited.remove('a'),'MUTATION.DENIED');
 code(()=>limited.insertChild('a','children',0,node('new')),'MUTATION.DENIED');
 const noEdit=original.edit(context({editable:[]}));code(()=>noEdit.setProperty('a','title','Denied'),'MUTATION.DENIED');
 const invisible=original.edit(context({visible:[]}));code(()=>invisible.setProperty('b','title','Denied'),'MUTATION.DENIED');
 // No hidden sibling count/order leakage through structural operations.
 const partial=original.edit(context({visible:['app','a','aa'],editable:['app','a','aa']}));code(()=>partial.remove('a'),'MUTATION.DENIED');
 const result=limited.commit(), handle=result.runtime.scope(context({visible:['a'],editable:['a']}));
 code(()=>handle.related('root'),'SEAM.TRAVERSAL');code(()=>handle.related('nextSibling'),'SEAM.TRAVERSAL');
 code(()=>handle.requireCapability('store.records.write'),'SEAM.DENIED');
});

test('moving and creating never alter context grants or provenance authority', () => {
 const caller=context(), edit=runtime().edit(caller), before=JSON.stringify(caller);
 edit.moveChild('a','b','children',0);
 const child=node('new');child.provenance={capabilities:['store.records.write'],publisher:'wydgit.core'};
 edit.insertChild('c','children',0,child);
 const next=edit.commit().runtime;
 assert.equal(JSON.stringify(caller),before);
 code(()=>next.scope(caller).related('parent'),'SEAM.TRAVERSAL');
 code(()=>next.scope(caller).requireCapability('store.records.write'),'SEAM.DENIED');
 const denied=runtime().edit(context({visible:allIds.filter(id=>id!=='new')}));code(()=>denied.insertChild('b','children',0,node('new')),'MUTATION.DENIED');
});

test('revision conflict is atomic and retryable; no implicit authoritative head exists', () => {
 const original=runtime(),before=serialize(original),edit=original.edit(context());edit.setProperty('a','title','Pending');
 code(()=>edit.commit({currentRevision:8}),'MUTATION.CONFLICT');assert.equal(serialize(original),before);
 const committed=edit.commit({currentRevision:7});assert.equal(committed.runtime.revision,8);
 assert.equal(original.edit(context()).commit().revision,8); // Independent branch.
 const exhausted=hydrate(tree(),registry(),{revision:Number.MAX_SAFE_INTEGER}).edit(context());code(()=>exhausted.commit(),'MUTATION.CONFLICT');
 const aborted=original.edit(context());aborted.abort();code(()=>aborted.commit(),'MUTATION.CLOSED');
});

test('dangerous keys, non-JSON values and malformed envelopes cannot enter through edits', () => {
 const original=runtime(),edit=original.edit(context());
 for(const key of ['__proto__','constructor','prototype']) {
  code(()=>edit.setProperty('a','data',JSON.parse(`{"${key}":true}`)),'INPUT.DANGEROUS_KEY');
  const child=node('new');child.provenance=JSON.parse(`{"${key}":true}`);code(()=>edit.insertChild('b','children',0,child),'INPUT.DANGEROUS_KEY');
 }
 for(const value of [undefined,()=>{},NaN,Infinity,1n,new Date(),new Array(2)]) assert.equal(resultOf(()=>edit.setProperty('a','data',value)).ok,false);
 let called=false;const child=node('new');Object.defineProperty(child,'id',{get(){called=true;throw Error('secret');},enumerable:true});
 code(()=>edit.insertChild('b','children',0,child),'INPUT.JSON');assert.equal(called,false);
 const cyclic=node('new');cyclic.slots.children=[cyclic];code(()=>edit.insertChild('b','children',0,cyclic),'OBJECT.CYCLE');
 code(()=>edit.insertChild('b','children',0,{...node('new'),parent:'a'}),'OBJECT.ENVELOPE');
 assert.equal(serialize(edit.commit().runtime),serialize(original));
});

test('schema rejects inherited, hidden and symbol data without invoking getters', () => {
 for(const field of ['properties','provenance']) {
  for(const variant of ['hidden','symbol','accessor','sparse']) {
   const root=tree();const value={};
   if(variant==='hidden')Object.defineProperty(value,'hidden',{value:true});
   if(variant==='symbol')value[Symbol('secret')]=true;
   if(variant==='accessor')Object.defineProperty(value,'x',{enumerable:true,get(){throw Error('must not execute');}});
   if(variant==='sparse')value.x=new Array(1);
   root[field]=value;code(()=>hydrate(root,registry()),'INPUT.JSON');
  }
 }
 const hidden=tree();Object.defineProperty(hidden,'extra',{value:true});code(()=>hydrate(hidden,registry()),'OBJECT.ENVELOPE');
 const inherited=Object.create({schema:'wydgit/0.2'});Object.assign(inherited,tree());code(()=>hydrate(inherited,registry()),'INPUT.JSON');
 for(const field of ['schema','id','prototype','properties','slots','provenance']) {const root=tree();delete root[field];code(()=>hydrate(root,registry()),'OBJECT.ENVELOPE');}
 const wrong=tree();wrong.schema='wydgit/0.1';code(()=>hydrate(wrong,registry()),'OBJECT.ENVELOPE');
});

test('generated edits remain deterministic through canonical serialization and hydration', () => {
 for(let i=0;i<25;i++) {
  const edit=runtime().edit(context());edit.setProperty('a','count',i);edit.moveChild('c','app','children',i%3);
  const next=edit.commit().runtime;assert.equal(serialize(hydrate(serialize(next),registry())),serialize(next));
  assert.equal(dehydrate(next).revision,undefined);
 }
});

test('demo renders from an edited snapshot and version metadata stays synchronized', () => {
 const model=loadRepository(projectRoot),caller=new ExecutionContext({publisher:'host',self:'home',capabilities:['object.instances.edit'],editable:['home']});
 const edit=model.runtime.edit(caller);edit.setProperty('home','title','Home');
 const next=webModel(edit.commit().runtime,model);
 for(const route of ['/','/about/','/contact/']){const result=renderSite(next,route);assert.equal(result.status,200);assert.deepEqual(result.diagnostics,[]);}
 const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url)));
 const lock=JSON.parse(fs.readFileSync(new URL('../package-lock.json',import.meta.url)));
 const app=JSON.parse(fs.readFileSync(new URL('../content/app.json',import.meta.url)));
 assert.equal(pkg.version,'0.2.0-alpha.17');assert.equal(pkg.name,'wydgit');assert.equal(app.properties.revision,'Wydgit 0.2 alpha 17');
 assert.equal(lock.version,pkg.version);assert.equal(lock.packages[''].version,pkg.version);assert.equal(lock.name,pkg.name);assert.equal(lock.packages[''].name,pkg.name);
});

test('failed insertion does not reserve IDs, reversions clear dirty state, and a second App is rejected', () => {
 const original=runtime(), edit=original.edit(context());
 const invalid=node('new');invalid.properties.title=false;
 code(()=>edit.insertChild('b','children',0,invalid),'MUTATION.INVALID_PROPERTY');
 edit.insertChild('b','children',0,node('new'));
 edit.setProperty('a','title','changed');edit.setProperty('a','title','a');
 edit.moveChild('c','app','children',0);edit.moveChild('c','app','children',2);
 assert.deepEqual(edit.changes(),{added:['new'],modified:['b'],moved:[],removed:[]});
 const nested={...tree(),id:'other'};nested.slots={};
 code(()=>edit.insertChild('b','children',0,nested),'OBJECT.ROOT');
 assert.equal(edit.commit().runtime.get('new').id,'new');
});

test('numeric JSON normalization and ID-map values round-trip without reserved object keys', () => {
 const raw=tree();raw.slots.children[0].properties.count=-0;
 const original=hydrate(raw,registry());assert.equal(Object.is(original.get('a').properties.count,-0),false);
 assert.deepEqual(dehydrate(original),dehydrate(hydrate(serialize(original),registry())));
 const rawNamed=tree();rawNamed.slots.children[0].id='constructor';
 const named=hydrate(rawNamed,registry()), caller=context({self:'constructor',visible:[...allIds,'constructor'],editable:[...allIds,'constructor']});
 const edit=named.edit(caller);edit.cloneChild('constructor','b','children',0,[['constructor','copy'],['aa','copy-child']]);
 assert.equal(edit.commit().runtime.get('copy').id,'copy');
});
