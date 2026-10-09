import { load } from 'cheerio';
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRepository } from '../wydgine/repository.js';
import { hydrate,dehydrate,serialize,ExecutionContext } from '../wydgine/object-model/index.js';
import { descendantFields,fieldOwner,formOperation,fieldKind,fieldValidation } from '../wydgine/object-model/forms.js';
import { envelope,runPage,Transport } from '../test-support/events.js';
import { webModel } from '../wydgine/web-model.js';
import { executePage } from '../wydgine/execution/page.js';
import { construction } from '../wydgine/object-model/construction.js';
import { MAXIMA } from '../wydgine/sewn/schema.js';
import { mountClient } from '../wydclient/index.js';
const options=[{value:'email',label:'Email',enabled:true},{value:'phone',label:'Phone',enabled:true},{value:'off',label:'Unavailable',enabled:false}];
function fixture(){
 const base=loadRepository(process.cwd()),raw=dehydrate(base.runtime);
 const field=(id,type,p={})=>envelope(id,type,{name:id,label:`Label ${id}`,...p});
 const form=envelope('profile','form',{}, {blocks:[envelope('intro','block',{content:{type:'markdown',value:'Profile introduction'}},{children:[envelope('identity','section',{}, {blocks:[field('name','text-input',{required:true,placeholder:'Enter name',maxLength:4}),field('password','password-input',{required:true,placeholder:'Secret',maxLength:8})]})]}),envelope('preferences','section',{}, {blocks:[field('bio','text-area',{placeholder:'Biography'}),field('subscribe','checkbox'),field('contact','radio-group',{options}),field('interests','checkbox-group',{options}),field('state','select',{options}),field('states','select',{options,multiple:true})]})]});
 raw.slots.pages=[envelope('home','page',{title:'Profile',slug:''},{sections:[form]})];raw.slots.navigation=[];raw.properties.home='home';
 const runtime=hydrate(raw,base.registry),model=webModel(runtime,base),ids=[];const walk=n=>{ids.push(n.id);Object.values(n.slots).flat().forEach(walk);};walk(raw);
 const context=new ExecutionContext({publisher:'acme',self:'home',app:runtime.rootId,visible:[...ids,'nested','replacement'],editable:[...ids,'nested','replacement'],traversal:['children','parent'],capabilities:['object.instances.edit','object.instances.construct','app.forms.submit'],scopes:{prototypes:['wydgit.core/form','wydgit.core/section']}});
 return {raw,form,base,runtime,model,context,session:{view:{id:'session',app:runtime.rootId,authenticated:false},active:()=>true,authorize:async()=>{}}};
}
function state(f){let runtime=f.runtime;return {get runtime(){return runtime;},call(operation,data){const changes=[];const result=formOperation(descendantFields(runtime,f.base.registry,'profile'),f.base.registry,operation,data,(id,p)=>changes.push([id,p]));if(changes.length){const e=runtime.edit(f.context);changes.forEach(([id,p])=>Object.entries(p).forEach(([key,value])=>e.setProperty(id,key,value)));runtime=e.commit().runtime;}return result;}};}
test('Form is Section, owns recursive fields through ordinary Blocks/Sections, deterministic order and unique names',()=>{
 const f=fixture();assert.equal(f.base.registry.isA('wydgit.core/form','wydgit.core/section'),true);
 assert.deepEqual(descendantFields(f.runtime,f.base.registry,'profile').map(n=>n.id),['name','password','bio','subscribe','contact','interests','state','states']);
 assert.equal(fieldOwner(f.runtime,f.base.registry,'password'),'profile');assert.equal(fieldOwner(f.runtime,f.base.registry,'intro'),'profile');
 const dup=structuredClone(f.raw);dup.slots.pages[0].slots.sections[0].slots.blocks[1].slots.blocks[0].properties.name='name';assert.throws(()=>hydrate(dup,f.base.registry),{code:'FORM.NAME'});
});
test('nested Form hydration, insertion, move, replacement and draft subtree are atomically forbidden',()=>{
 const f=fixture(),nested=envelope('nested','form');f.form.slots.blocks.push(envelope('wrapper','section',{}, {blocks:[nested]}));assert.throws(()=>hydrate(f.raw,f.base.registry),{code:'FORM.NESTED'});
 for(const op of [e=>e.insertChild('preferences','blocks',0,nested),e=>e.replaceChild('intro',envelope('replacement','section',{}, {blocks:[nested]}))]){const e=f.runtime.edit(f.context);assert.throws(()=>op(e),{code:'FORM.NESTED'});assert.equal(e.commit().runtime.get('intro').id,'intro');}
 const raw=dehydrate(f.runtime);raw.slots.pages[0].slots.sections.push(nested);const r=hydrate(raw,f.base.registry),c=new ExecutionContext({...f.context,visible:[...f.context.visible,'nested']});const e=r.edit(c);assert.throws(()=>e.moveChild('nested','preferences','blocks',0),{code:'FORM.NESTED'});
 const drafts=construction(f.base.registry,f.context,{...MAXIMA},()=>{}),a=drafts.create('wydgit.core/form','a'),b=drafts.create('wydgit.core/form','b'),section=drafts.create('wydgit.core/section','s');section.Insert('blocks',0,b);assert.throws(()=>a.Insert('blocks',0,section),{code:'FORM.NESTED'});
});
test('Bind, Values, Validate, IsValid and Clear preserve configuration; sensitive values excluded; binding atomic and fail closed',()=>{
 const f=fixture(),s=state(f),before=f.runtime.get('name').properties;
 s.call('bind',{name:'Brian',password:'secret',bio:'Hello',subscribe:true,contact:'email',interests:['email','phone'],state:'phone',states:['email']});
 assert.deepEqual({...s.call('values')},{name:'Brian',bio:'Hello',subscribe:true,contact:'email',interests:['email','phone'],state:'phone',states:['email']});assert.equal(s.call('validate'),false);assert.equal(s.call('isValid'),false);assert.equal(s.runtime.get('name').properties.validationMessage,'Character limit exceeded');
 assert.throws(()=>s.call('bind',{name:'ok',subscribe:'true'}),{code:'FORM.BIND'});assert.equal(s.runtime.get('name').properties.value,'Brian');assert.throws(()=>s.call('bind',{unknown:1}),{code:'FORM.BIND'});assert.throws(()=>s.call('bind',{contact:'off'}),{code:'FORM.BIND'});
 assert.doesNotMatch(serialize(s.runtime),/secret/);assert.doesNotMatch(JSON.stringify(dehydrate(s.runtime)),/secret/);assert.doesNotMatch(JSON.stringify(s.runtime.get('password')),/secret/);assert.doesNotMatch(JSON.stringify(s.runtime.scope(f.context,'password').properties),/secret/);
 s.call('clear');assert.deepEqual({...s.call('values')},{name:'',bio:'',subscribe:false,contact:null,interests:[],state:null,states:[]});for(const key of ['label','placeholder','maxLength','required'])assert.deepEqual(s.runtime.get('name').properties[key],before[key]);assert.deepEqual(s.runtime.get('state').properties.options.map(o=>({...o})),options);
});
test('all field types enforce required, cardinality, type, option membership and Unicode character limits independently of rendering',()=>{
 for(const kind of ['text-input','password-input','text-area']){assert.equal(fieldValidation(kind,{value:'😀😀',maxLength:null}).valid,true);assert.equal(fieldValidation(kind,{value:'😀😀',maxLength:2}).valid,true);assert.equal(fieldValidation(kind,{value:'abc',maxLength:2}).valid,false);assert.equal(fieldValidation(kind,{value:'',required:true}).valid,false);}
 for(const [kind,empty,value,multiple] of [['checkbox',false,true,false],['radio-group',null,'email',false],['checkbox-group',[],['email'],false],['select',null,'email',false],['select',[],['email'],true]]){assert.equal(fieldValidation(kind,{value:empty,required:true,multiple,options}).valid,false);assert.equal(fieldValidation(kind,{value,required:true,multiple,options}).valid,true);}
 for(const [kind,value,multiple] of [['checkbox','true',false],['radio-group',['email'],false],['radio-group','off',false],['checkbox-group',['unknown'],false],['checkbox-group',['email','email'],false],['select',['email'],false],['select','email',true]])assert.equal(fieldValidation(kind,{value,multiple,options}).valid,false);
 const f=fixture();for(const bad of [[...options,options[0]],[{value:'x',label:'X',enabled:true,extra:1}]]){const e=f.runtime.edit(f.context);assert.throws(()=>e.setProperty('state','options',bad),{code:'FORM.OPTIONS'});}
});
async function page(f,input={},handlers=[],actions=[]){const r=await executePage({...f,pageId:'home',csrf:'c'.repeat(64),input:{method:'GET',path:'/',...input},handlers,actions});const t=new Transport();await r.response.send(t);return {...r,html:t.text};}
test('portable WydBASIC prototype API → host POST → validation → Submit → invalid redisplay / valid action, request isolation and accessible web controls',async()=>{
 const f=fixture(),seen=[];const handlers=[{owner:'profile',type:'Submit',run:function(){seen.push(this.ME.FormState('values'));assert.equal(this.ME.properties.valid,false);}}];
 const actions=[{page:'home',target:'profile',type:'Submit',method:'POST',capability:'app.forms.submit',wydBasic:'DIM values = Me.Values()\nIF Me.IsValid() THEN\n Me.Set("label", "Accepted")\nEND IF'}];
 const get=await page(f);assert.equal(get.error,null);const $=load(get.html),ids=$('[id]').map((_,el)=>$(el).attr('id')).get();assert.equal(new Set(ids).size,ids.length);for(const el of $('label[for]').toArray())assert.ok(ids.includes($(el).attr('for')));for(const el of $('[aria-describedby]').toArray())assert.ok(ids.includes($(el).attr('aria-describedby')));for(const pattern of [/type="text"/,/type="password"/,/<textarea/,/type="checkbox"/,/type="radio"/,/<select/,/ multiple/,/placeholder="Enter name"/,/maxlength="4"/,/<legend>Label contact/,/for="wyd-field-name"/,/Profile introduction/])assert.match(get.html,pattern);
 const invalid=await page(f,{method:'POST',form:'name=Brian&password=secret&bio=keep&contact=email&interests=email&interests=phone&state=phone&states=email',action:{target:'profile',type:'Submit',csrf:'c'.repeat(64)}},handlers,actions);assert.equal(invalid.error,null);assert.match(invalid.html,/keep/);assert.match(invalid.html,/aria-invalid="true"/);assert.doesNotMatch(invalid.html,/secret/);assert.equal(seen[0].name,'Brian');assert.equal(seen[0].password,undefined);
 const valid=await page(f,{method:'POST',form:'name=Amy&password=secret',action:{target:'profile',type:'Submit',csrf:'c'.repeat(64)}},[],actions);assert.equal(valid.error,null);assert.match(valid.html,/Accepted/);
 const later=await page(f);assert.doesNotMatch(later.html,/Accepted|keep|secret/);
 const api=await page(f,{},[{owner:'profile',type:'Page.Load',wydBasic:'CALL Me.Bind({"name":"Amy", "password":"secret"})\nDIM valid = Me.Validate()\nIF valid THEN\n Me.Set("label", "Bound")\nEND IF\nCALL Me.Clear()'}]);assert.equal(api.error,null);assert.match(api.html,/Bound/);assert.match(api.html,/placeholder="Enter name"/);assert.doesNotMatch(api.html,/secret/);
 const disabled=await page(f,{},[{owner:'subscribe',type:'Page.Load',run:function(){this.ME.Set('enabled',false);}}]);assert.match(disabled.html,/name="subscribe"[^>]* disabled/);
});
test('WydClient hosts same semantic Form prototype methods and typed checkbox adaptation without server or Node dependencies',async()=>{
 const f=fixture(),nodes=[];const walk=(id,parent)=>{const n=f.runtime.get(id);nodes.push({id,parent,prototype:n.prototype,properties:n.properties,kind:f.base.registry.isA(n.prototype,'wydgit.core/form')?'form':f.base.registry.isA(n.prototype,'wydgit.core/field')?'field':'content',controlKind:fieldKind(n.prototype,f.base.registry),element:Object.assign(new EventTarget(),{value:n.properties.value??'',checked:false})});Object.values(n.slots).flat().forEach(child=>walk(child,id));};walk('profile');
 let collected;const client=mountClient({nodes,context:f.context,prototypeRegistry:f.base.registry,handlers:[{owner:'profile',type:'Client.Ready',wydBasic:'CALL Me.Bind({"name":"Amy", "password":"secret", "subscribe":TRUE})\nDIM ok = Me.Validate()\nIF ok THEN\n CALL Me.Clear()\nEND IF'},{owner:'profile',type:'Client.Ready',run:function(){collected=this.ME.FormState('values');}}]});await client.ready;assert.equal(collected.name,'');assert.equal(collected.subscribe,false);assert.equal(nodes.find(n=>n.id==='name').properties.placeholder,'Enter name');assert.equal(collected.password,undefined);
 const checkbox=nodes.find(n=>n.id==='subscribe');checkbox.element.checked=true;checkbox.element.dispatchEvent(new Event('change'));await client.idle();assert.equal(client.error(),null);await client.unmount();
});

test('Form operations preserve authority, deny invisible intermediate containers and obey reduced traversal bounds',async()=>{
 const f=fixture(),source='DIM values = Me.Values()';
 for(const context of [new ExecutionContext({...f.context,traversal:[]}),new ExecutionContext({...f.context,visible:f.context.visible.filter(id=>id!=='identity')}),new ExecutionContext({...f.context,limits:{formNodes:2}})]){
  const result=await page({...f,context},{},[{owner:'profile',type:'Page.Load',wydBasic:source}]);assert.ok(result.error);assert.doesNotMatch(JSON.stringify(result.error),/secret|Enter name/);
 }
 const denied=await page({...f,context:new ExecutionContext({...f.context,editable:f.context.editable.filter(id=>id!=='subscribe')})},{},[{owner:'profile',type:'Page.Load',wydBasic:'CALL Me.Bind({"name":"Amy", "subscribe":TRUE})'}]);assert.equal(denied.error.code,'MUTATION.DENIED');assert.equal(f.runtime.get('name').properties.value,'');
});
test('rendered hidden controls, required groups, disabled options and selected values follow semantic state',async()=>{
 const f=fixture();const result=await page(f,{},[{owner:'profile',type:'Page.Load',wydBasic:'CALL Me.Bind({"name":"Amy", "password":"secret", "contact":"email", "interests":["phone"], "state":"phone", "states":["email", "phone"]})'},{owner:'bio',type:'Page.Load',run:function(){this.ME.Set('visible',false);}},{owner:'preferences',type:'Page.Load',run:function(){this.ME.Set('format',{layout:'columns'});}}]);assert.equal(result.error,null);assert.doesNotMatch(result.html,/<textarea/);assert.match(result.html,/value="email" checked/);assert.match(result.html,/value="phone" selected/);assert.match(result.html,/value="off" disabled/);assert.doesNotMatch(result.html,/aria-invalid=/);
});

test('disabled fields remain bindable/collectable and configuration keys cannot be bound',async()=>{
 const f=fixture();const result=await page(f,{},[{owner:'subscribe',type:'Page.Initialize',run:function(){this.ME.Set('enabled',false);}},{owner:'profile',type:'Page.Load',wydBasic:'CALL Me.Bind({"subscribe":TRUE})'},{owner:'profile',type:'Page.PreRender',run:function(){assert.equal(this.ME.FormState('values').subscribe,true);assert.equal(this.ME.related('children','blocks')[1].related('children','blocks')[1].properties.enabled,false);}}]);assert.equal(result.error,null);assert.match(result.html,/name="subscribe"[^>]* disabled[^>]* checked/);
 const s=state(f);for(const key of ['placeholder','label','options','maxLength','required'])assert.throws(()=>s.call('bind',{[key]:'changed'}),{code:'FORM.BIND'});
});

test('client password Change payloads/properties are redacted and invalid Submit suppresses the host default',async()=>{
 const f=fixture(),password=Object.assign(new EventTarget(),{value:''}),form=new EventTarget(),payloads=[],submissions=[];
 const client=mountClient({context:new ExecutionContext({...f.context,capabilities:[...f.context.capabilities,'client.actions.submit'],scopes:{...f.context.scopes,actions:['profile']}}),prototypeRegistry:f.base.registry,nodes:[{id:'profile',kind:'form',prototype:'wydgit.core/form',properties:{},element:form},{id:'password',parent:'profile',kind:'field',prototype:'wydgit.core/password-input',properties:{name:'password',label:'Password',required:true,maxLength:3},element:password}],handlers:[{owner:'password',type:'Change',run:function(){payloads.push(this.EVENT.Payload);assert.equal(this.ME.Value,'');assert.equal(this.ME.properties.value,'');}}],submit:async result=>submissions.push(result)});
 await client.ready;password.value='private';password.dispatchEvent(new Event('change'));await client.idle();assert.deepEqual({...payloads[0]},{OldValue:'',NewValue:''});form.dispatchEvent(new Event('submit'));await client.idle();assert.equal(submissions.length,0);assert.equal(client.error(),null);
 password.value='ok';password.dispatchEvent(new Event('change'));await client.idle();form.dispatchEvent(new Event('submit'));await client.idle();assert.equal(submissions.length,1);await client.unmount();
});

test('semantic binding names remain distinct from canonical object identity',()=>{
 const f=fixture(),e=f.runtime.edit(f.context);e.setProperty('name','name','displayName');const s=state({...f,runtime:e.commit().runtime});s.call('bind',{displayName:'Amy'});assert.equal(s.runtime.get('name').id,'name');assert.equal(s.runtime.get('name').properties.value,'Amy');assert.equal(s.call('values').displayName,'Amy');assert.equal(Object.hasOwn(s.call('values'),'name'),false);
});

test('standalone Fields retain Page validation without requiring Form ownership',async()=>{
 const f=fixture();f.raw.slots.pages[0].slots.sections.push(envelope('standalone-layout','section',{}, {blocks:[envelope('standalone','text-input',{name:'name',label:'Standalone',required:true})]}));const runtime=hydrate(f.raw,f.base.registry),context=new ExecutionContext({...f.context,visible:[...f.context.visible,'standalone-layout','standalone'],editable:[...f.context.editable,'standalone-layout','standalone']});const result=await page({...f,runtime,model:webModel(runtime,f.base),context});assert.equal(result.error,null);assert.equal(fieldOwner(runtime,f.base.registry,'standalone'),null);assert.match(result.html,/id="wyd-field-standalone"[^>]*aria-invalid="true"/);
});
