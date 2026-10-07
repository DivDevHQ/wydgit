import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrate, dehydrate, serialize, PrototypeRegistry, ExecutionContext, resultOf } from '../wydgine/object-model/index.js';
import { loadRepository } from '../wydgine/repository.js';
import { projectRoot } from '../app.js';
const slot = (accepts = ['wydgit.core/item'], extra = {}) => ({ accepts, ordered: true, ...extra });
const definitions = () => [
 { id:'wydgit.core/app', publisher:'wydgit.core', public:true, slots:{ children:slot() } },
 { id:'wydgit.core/item', publisher:'wydgit.core', public:true, properties:{ title:{type:'string',default:'Untitled'} }, slots:{children:slot()} },
 { id:'acme/card', publisher:'acme', extends:'wydgit.core/item', properties:{count:{type:'number',default:1}} },
 { id:'acme/live-card', publisher:'acme', extends:'acme/card' }
];
const registry = () => new PrototypeRegistry(definitions());
const object = (id, prototype = 'wydgit.core/item', children = []) => ({schema:'wydgit/0.2',id,prototype,properties:{},slots:{children},provenance:{}});
const fixture = () => object('app','wydgit.core/app',[object('a','acme/live-card'),object('b')]);
const code = (fn, expected) => assert.throws(fn, error => error.code === expected);

test('immutable objects, inherited defaults/slots and deterministic acyclic round trips', () => {
 const runtime = hydrate(fixture(),registry());
 assert.equal(runtime.get('a').prototype,'acme/live-card');
 assert.equal(runtime.get('a').properties.title,'Untitled');
 assert.equal(runtime.get('a').properties.count,1);
 assert.throws(() => {runtime.get('a').id='changed';},TypeError);
 assert.throws(() => {runtime.get('a').properties.count=4;},TypeError);
 assert.throws(() => {registry().get('acme/card').id='other';},TypeError);
 assert.equal(serialize(hydrate(serialize(runtime),registry())),serialize(runtime));
 assert.equal(serialize(hydrate(fixture(),registry())),serialize(runtime));
 assert.equal('parent' in dehydrate(runtime),false);
 assert.equal('root' in runtime.get('a'),false);
});

test('duplicate IDs, cycles and multiple containment positions are distinct errors', () => {
 let tree=fixture(); tree.slots.children[1].id='a'; code(()=>hydrate(tree,registry()),'OBJECT.DUPLICATE_ID');
 tree=fixture(); tree.slots.children[0].slots.children=[tree]; code(()=>hydrate(tree,registry()),'OBJECT.CYCLE');
 tree=fixture(); tree.slots.children.push(tree.slots.children[0]); code(()=>hydrate(tree,registry()),'OBJECT.MULTIPLE_PARENTS');
 tree=fixture(); tree.slots.children[1].slots.children=[tree.slots.children[0]]; code(()=>hydrate(tree,registry()),'OBJECT.MULTIPLE_PARENTS');
});

test('only one App root, no detached object table, and valid slot contracts', () => {
 code(()=>hydrate(object('a'),registry()),'OBJECT.ROOT');
 let tree=fixture(); tree.slots.children.push(object('nested','wydgit.core/app')); code(()=>hydrate(tree,registry()),'OBJECT.ROOT');
 tree=fixture(); tree.objects=[object('orphan')]; code(()=>hydrate(tree,registry()),'OBJECT.ENVELOPE');
 tree=fixture(); tree.slots.unknown=[]; code(()=>hydrate(tree,registry()),'OBJECT.UNKNOWN_SLOT');
 const defs=definitions(); defs[0].slots.children=slot(['acme/card'],{min:1,max:1}); const r=new PrototypeRegistry(defs);
 code(()=>hydrate(fixture(),r),'OBJECT.CARDINALITY');
 code(()=>hydrate(object('app','wydgit.core/app'),r),'OBJECT.CARDINALITY');
 code(()=>hydrate(object('app','wydgit.core/app',[object('wrong')]),r),'OBJECT.CHILD_TYPE');
 assert.ok(hydrate(object('app','wydgit.core/app',[object('valid','acme/live-card')]),r));
});

test('abstract prototypes, publisher boundaries, inheritance cycles and unknown bases', () => {
 let defs=definitions(); defs[1].abstract=true; let r=new PrototypeRegistry(defs);
 code(()=>hydrate(fixture(),r),'OBJECT.ABSTRACT');
 assert.ok(hydrate(object('app','wydgit.core/app',[object('a','acme/card')]),r));
 defs=definitions(); defs.push({id:'otherco/spy',publisher:'otherco',extends:'acme/card'});
 code(()=>new PrototypeRegistry(defs),'PROTOTYPE.PUBLISHER');
 defs=definitions(); defs[1].public=false; code(()=>new PrototypeRegistry(defs),'PROTOTYPE.PUBLISHER');
 defs=definitions(); defs[2].extends='acme/live-card'; code(()=>new PrototypeRegistry(defs),'PROTOTYPE.CYCLE');
 defs=definitions(); defs[2].extends='missing/base'; code(()=>new PrototypeRegistry(defs),'PROTOTYPE.UNKNOWN');
 defs=definitions(); defs[2].extends=['wydgit.core/item']; code(()=>new PrototypeRegistry(defs),'PROTOTYPE.INHERITANCE');
 defs=definitions(); defs[2].publisher='other'; code(()=>new PrototypeRegistry(defs),'PROTOTYPE.IDENTITY');
});

test('reserved keys are explicitly rejected in data, provenance, slots and prototype definitions', () => {
 for (const key of ['__proto__','constructor','prototype']) {
  for (const field of ['properties','provenance']) {
   const tree=fixture(); tree[field]=JSON.parse(`{"nested":{"${key}":{"polluted":true}}}`);
   code(()=>hydrate(tree,registry()),'INPUT.DANGEROUS_KEY');
  }
  const tree=fixture(); tree.slots=JSON.parse(`{"${key}":[]}`); code(()=>hydrate(tree,registry()),'INPUT.DANGEROUS_KEY');
  const defs=definitions(); defs[1].properties=JSON.parse(`{"${key}":{"type":"string"}}`);
  code(()=>new PrototypeRegistry(defs),'INPUT.DANGEROUS_KEY');
 }
 assert.equal({}.polluted,undefined);
});

test('malformed JSON and non-JSON input fail cleanly, without evaluating accessors', () => {
 for (const raw of ['{','null','[]','42','{}']) assert.equal(resultOf(()=>hydrate(raw,registry())).ok,false);
 const tree=fixture(); let called=false;
 Object.defineProperty(tree.properties,'x',{enumerable:true,get(){called=true;throw Error('secret');}});
 code(()=>hydrate(tree,registry()),'INPUT.JSON'); assert.equal(called,false);
 const bad=fixture();bad.slots.children=null;code(()=>hydrate(bad,registry()),'OBJECT.SLOT');
 assert.deepEqual(resultOf(()=>{throw Error('private host path');}),{ok:false,code:'RUNTIME.INTERNAL',message:'Operation failed',details:{}});
});

test('self-only visibility denies parent, sibling, root and child traversal by default', () => {
 const runtime=hydrate(fixture(),registry());
 const context=new ExecutionContext({publisher:'acme',self:'a'}), a=runtime.scope(context);
 assert.equal(a.id,'a'); assert.equal(a.slots,undefined); assert.equal(a.parent,undefined);
 for (const relation of ['parent','root','previousSibling','nextSibling','children']) code(()=>a.related(relation),'SEAM.TRAVERSAL');
 code(()=>runtime.scope({self:'a'}),'SEAM.CONTEXT');
});

test('traversal and visibility are independent; reached handles retain caller authority', () => {
 const runtime=hydrate(fixture(),registry());
 const hidden=runtime.scope(new ExecutionContext({publisher:'acme',self:'a',traversal:['root','nextSibling']}));
 code(()=>hidden.related('root'),'SEAM.VISIBILITY'); code(()=>hidden.related('nextSibling'),'SEAM.VISIBILITY');
 const visible=runtime.scope(new ExecutionContext({publisher:'acme',self:'a',visible:['app','b']}));
 code(()=>visible.related('root'),'SEAM.TRAVERSAL');
 const grant={publisher:'acme',self:'a',visible:['app','b'],traversal:['parent','root','nextSibling','previousSibling','children']};
 const a=runtime.scope(new ExecutionContext(grant));
 assert.equal(a.related('root').id,'app'); assert.equal(a.related('parent').id,'app');
 assert.equal(a.related('nextSibling').related('previousSibling'),a);
 assert.deepEqual(a.related('root').related('children').map(x=>x.id),['a','b']);
 const privileged=runtime.scope(new ExecutionContext({publisher:'wydgit.core',self:'app',capabilities:['store.records.write']}));
 assert.equal(privileged.requireCapability('store.records.write'),true);
 for (const target of [a,a.related('root'),a.related('nextSibling')]) code(()=>target.requireCapability('store.records.write'),'SEAM.DENIED');
 assert.equal(runtime.scope(new ExecutionContext({...grant,capabilities:['store.records.read']})).related('root').requireCapability('store.records.read'),true);
});

test('context grants are immutable and capability grammar is platform-neutral', () => {
 const capabilities=['client.storage.read']; const context=new ExecutionContext({publisher:'acme',self:'a',capabilities,limits:{steps:100}});
 capabilities.push('store.records.write'); assert.equal(context.allows('store.records.write'),false);
 assert.throws(()=>context.visible.push('app'),TypeError);
 assert.throws(()=>{context.limits.steps=1000;},TypeError);
 for(const capability of ['*','storage.read','a.b.c.d','Store.records.write']) code(()=>new ExecutionContext({publisher:'acme',self:'a',capabilities:[capability]}),'SEAM.CAPABILITY');
});

test('small generated trees round-trip and duplicate mutations always fail', () => {
 for(let size=0;size<40;size++) {
  const tree=object('app','wydgit.core/app',Array.from({length:size},(_,i)=>object(`item-${i}`)));
  const serialized=serialize(hydrate(tree,registry()));
  assert.equal(serialize(hydrate(serialized,registry())),serialized);
  if(size) {tree.slots.children.push(structuredClone(tree.slots.children[0]));code(()=>hydrate(tree,registry()),'OBJECT.DUPLICATE_ID');}
 }
});

test('demo is hydrated as App → Page → Section → Block with canonical navigation', () => {
 const {runtime}=loadRepository(projectRoot);
 assert.equal(runtime.get(runtime.rootId).prototype,'wydgit.core/app');
 assert.equal(runtime.get('home').slots.sections[0],'hero');
 assert.equal(runtime.get('hero').slots.blocks[0],'hero-block-1');
 const output=dehydrate(runtime);assert.equal(output.schema,'wydgit/0.2');assert.doesNotThrow(()=>JSON.stringify(output));
});

test('hidden accessors, sparse child arrays and excessive depth fail without execution', () => {
 const tree=fixture(); let called=false;
 Object.defineProperty(tree.slots,'children',{get(){called=true;throw Error('private');}});
 code(()=>hydrate(tree,registry()),'INPUT.JSON'); assert.equal(called,false);
 const sparse=fixture(); sparse.slots.children=new Array(2); code(()=>hydrate(sparse,registry()),'INPUT.JSON');
 const deep=fixture(); let cursor=deep;
 for(let i=0;i<66;i++) {const child=object(`depth-${i}`);cursor.slots.children=[child];cursor=child;}
 code(()=>hydrate(deep,registry()),'OBJECT.LIMIT');
 const runtime=hydrate(fixture(),registry());
 const root=runtime.scope(new ExecutionContext({publisher:'wydgit.core',self:'app',traversal:['children']}));
 assert.deepEqual(root.related('children'),[]);
});
