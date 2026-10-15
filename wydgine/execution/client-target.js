import {CONTROL_SCHEMA,validateControlBindings} from '../controls.js';
import {requireThat as check,record} from '../object-model/validation.js';
const shape=(v,allowed,required=[])=>check(record(v)&&Object.keys(v).every(k=>allowed.includes(k))&&required.every(k=>Object.hasOwn(v,k)),'COMPONENT.TARGET','Unsupported client metadata');
const validated=new WeakMap();
const scalar = v => v === null || ['string','number','boolean'].includes(typeof v);
export function portableComponent(d, registry) {
  if(d.interface)return;
  let approved=validated.get(registry);if(!approved){approved=new Set();validated.set(registry,approved);}if(approved.has(d.id))return;
  const visual = registry.isA(d.id,'wydgit.core/section') || registry.isA(d.id,'wydgit.core/block');
  if(d.presentation?.schema===CONTROL_SCHEMA){check(visual,'CONTROL.TARGET','Controls require a visual receiver');validateControlBindings(d,registry);}
  else if(d.presentation){
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
