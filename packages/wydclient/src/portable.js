// Closed browser profile over canonical definitions. No source language or host expressions.
import {publicProperties} from '../../../wydgine/object-model/forms.js';
import {check,shape,record} from './data.js';
const validated=new WeakMap();
const scalar = v => v === null || ['string','number','boolean'].includes(typeof v);
export function portableComponent(d, registry) {
  if(d.interface)return;
  let approved=validated.get(registry);if(!approved){approved=new Set();validated.set(registry,approved);}if(approved.has(d.id))return;
  const visual = registry.isA(d.id,'wydgit.core/section') || registry.isA(d.id,'wydgit.core/block');
  if(d.presentation){
    check(visual,'COMPONENT.TARGET','Unsupported browser presentation receiver');
    shape(d.presentation,['schema','template'],['schema','template']);
    let count=0;
    const walk=(node,depth=0)=>{
      check(depth<=32&&++count<=1024,'COMPONENT.LIMIT','Presentation bound');
      shape(node,['tag','text','children'],['tag']);
      check(['section','div','p','span','h2','h3','strong','ul','ol','li'].includes(node.tag),'COMPONENT.TARGET','Unsupported browser element');
      if(Object.hasOwn(node,'text')){
        const value=node.text;
        if(!scalar(value)){
          shape(value,['get'],['get']);
          check(typeof value.get==='string'&&/^properties\.[A-Za-z][A-Za-z0-9_]*$/.test(value.get),'COMPONENT.TARGET','Only exact public property bindings are portable');
          const rule=d.properties[value.get.slice(11)];
          check(rule&&(rule.access??'public')==='public'&&!rule.hidden&&!rule.requires?.length&&['string','number','boolean'].includes(rule.type),'COMPONENT.TARGET','Restricted or nonscalar presentation binding');
        }
      }
      check(node.children===undefined||Array.isArray(node.children),'COMPONENT.TARGET','Invalid children');
      for(const child of node.children??[])walk(child,depth+1);
    };walk(d.presentation.template);
  }
  for(const b of d.component?.subscriptions??[])check(!['Server','Session'].includes(b.source)&&!(b.source==='Page'&&['Validate'].includes(b.event)),'COMPONENT.TARGET','Unsupported browser lifecycle source');
  for(const c of d.component?.children??[])portablePlacement(d.id,c.slot,c.type,registry);
  for(const r of d.component?.repeaters??[])portablePlacement(d.id,r.slot,d.component.templates.find(t=>t.name===r.template).type,registry);
  const programs=[d.behavior,...Object.values(d.lifecycle??{})].filter(Boolean);
  const scan=value=>{
    if(!value||typeof value!=='object')return;
    check(!['service','serviceCall','canonicalService','canonicalServiceCall'].includes(value.op)&&!(value.op==='context'&&!['ME','EVENT'].includes(value.name)),'COMPONENT.TARGET','Server or service operation unavailable');
    for(const item of Object.values(value))scan(item);
  };for(const program of programs)scan(program);
  approved.add(d.id);
}
export function portablePlacement(parent,slot,child,registry){
  check((registry.isA(parent,'wydgit.core/page')&&slot==='sections'||registry.isA(parent,'wydgit.core/section')&&slot==='blocks'||registry.isA(parent,'wydgit.core/block')&&slot==='children')&&(registry.isA(child,'wydgit.core/section')||registry.isA(child,'wydgit.core/block')),'COMPONENT.TARGET','Unsupported browser placement');
}
export function portableRenderer({registry,region,boundary}){
  const generated=new WeakSet();let displayed=[];
  const preserve=element=>{for(const child of [...element.childNodes]){if(!generated.has(child)||child.nodeType===1&&boundary(child))element.parentNode?.insertBefore(child,element);else if(child.nodeType===1)preserve(child);}};
  const clear=()=>{for(const element of displayed){preserve(element);element.remove();}displayed=[];};
  return {clear,render(runtime,ledger){
    const doc=region.ownerDocument;let nodes=0,bytes=0;
    const make=tag=>{ledger.take('steps');check(++nodes<=4096,'COMPONENT.LIMIT','Render node bound');const el=doc.createElement(tag);generated.add(el);return el;};
    const text=(el,value)=>{check(scalar(value),'COMPONENT.TARGET','Nonscalar content');const content=value===null?'':String(value);bytes+=content.length;check(bytes<=262144,'COMPONENT.LIMIT','Render content bound');el.textContent=content;for(const n of el.childNodes)generated.add(n);};
    const build=(id,depth=0)=>{
      check(depth<=32,'COMPONENT.LIMIT','Render depth bound');const node=runtime.get(id),d=registry.get(node.prototype),values=publicProperties(node,registry);
      check(!values.skin,'COMPONENT.TARGET','Browser skins unavailable');
      const spec=(s,level=0)=>{check(level<=32,'COMPONENT.LIMIT','Presentation depth');const el=make(s.tag);if(Object.hasOwn(s,'text'))text(el,record(s.text)?node.properties[s.text.get.slice(11)]:s.text);for(const c of s.children??[])el.append(spec(c,level+1));return el;};
      const el=d.presentation?spec(d.presentation.template):make(registry.isA(d.id,'wydgit.core/section')?'section':'div');
      el.setAttribute('data-wydclient-object','');
      const format=values.format??{};shape(format,['align','width','tone']);
      for(const [key,value] of Object.entries(format))check(({align:['start','center','end'],width:['normal','wide','narrow'],tone:['plain','muted','hero']})[key].includes(value),'COMPONENT.TARGET','Unsupported format');
      el.className=['wyd-object',...Object.entries(format).map(([k,v])=>`wyd-${k}-${v}`)].join(' ');
      if(!d.presentation&&values.content){const value=values.content;shape(value,['type','value'],['type','value']);check(value.type==='markdown'&&typeof value.value==='string','COMPONENT.TARGET','Unsupported content');const p=make('p');text(p,value.value);el.append(p);}
      for(const children of Object.values(node.slots))for(const child of children)el.append(build(child,depth+1));return el;
    };
    const staged=runtime.get(runtime.rootId).slots.sections.map(id=>build(id));ledger.check();clear();for(const el of staged)region.append(el);displayed=staged;
  }};
}
