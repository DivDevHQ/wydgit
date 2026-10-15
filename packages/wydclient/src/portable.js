export {portableComponent,portablePlacement} from '../../../wydgine/execution/client-target.js';
import {CONTROL_SCHEMA} from '../../../wydgine/controls.js';
import {controlAdapter} from './controls.js';
// Closed browser profile over canonical definitions. No source language or host expressions.
import {publicProperties} from '../../../wydgine/object-model/forms.js';
import {check,shape,record} from './data.js';
const scalar=v=>v===null||['string','number','boolean'].includes(typeof v);
export function portableRenderer({registry,region,boundary,dispatch,executable=()=>false}){
  const controls=controlAdapter({region,boundary,dispatch,executable});
  const generated=new WeakSet();let displayed=[];
  const preserve=element=>{for(const child of [...element.childNodes]){if(!generated.has(child)||child.nodeType===1&&boundary(child))element.parentNode?.insertBefore(child,element);else if(child.nodeType===1)preserve(child);}};
  const clear=()=>{for(const element of displayed){preserve(element);element.remove();}displayed=[];};
  return {clear(){controls.clear();clear();},render(runtime,ledger){
    controls.begin();
    const doc=region.ownerDocument;let nodes=0,bytes=0;
    const make=tag=>{ledger.take('steps');check(++nodes<=4096,'COMPONENT.LIMIT','Render node bound');const el=doc.createElement(tag);generated.add(el);return el;};
    const text=(el,value)=>{check(scalar(value),'COMPONENT.TARGET','Nonscalar content');const content=value===null?'':String(value);bytes+=content.length;check(bytes<=262144,'COMPONENT.LIMIT','Render content bound');el.textContent=content;for(const n of el.childNodes)generated.add(n);};
    const build=(id,depth=0)=>{
      check(depth<=32,'COMPONENT.LIMIT','Render depth bound');const node=runtime.get(id),d=registry.get(node.prototype),values=publicProperties(node,registry);
      check(!values.skin,'COMPONENT.TARGET','Browser skins unavailable');
      const spec=(s,level=0)=>{check(level<=32,'COMPONENT.LIMIT','Presentation depth');const el=make(s.tag);if(Object.hasOwn(s,'text'))text(el,record(s.text)?node.properties[s.text.get.slice(11)]:s.text);for(const c of s.children??[])el.append(spec(c,level+1));return el;};
      const el=d.presentation?.schema===CONTROL_SCHEMA?controls.build(d.presentation,{id,make,text,read:v=>record(v)?node.properties[v.get.slice(11)]:v}):d.presentation?spec(d.presentation.template):make(registry.isA(d.id,'wydgit.core/section')?'section':'div');
      el.setAttribute('data-wydclient-object','');
      const format=values.format??{};shape(format,['align','width','tone']);
      for(const [key,value] of Object.entries(format))check(({align:['start','center','end'],width:['normal','wide','narrow'],tone:['plain','muted','hero']})[key].includes(value),'COMPONENT.TARGET','Unsupported format');
      el.className=['wyd-object',...Object.entries(format).map(([k,v])=>`wyd-${k}-${v}`)].join(' ');
      if(!d.presentation&&values.content){const value=values.content;shape(value,['type','value'],['type','value']);check(value.type==='markdown'&&typeof value.value==='string','COMPONENT.TARGET','Unsupported content');const p=make('p');text(p,value.value);el.append(p);}
      for(const children of Object.values(node.slots))for(const child of children)el.append(build(child,depth+1));return el;
    };
    const staged=runtime.get(runtime.rootId).slots.sections.map(id=>build(id));ledger.check();clear();for(const el of staged)region.append(el);displayed=staged;controls.commit();
  }};
}
