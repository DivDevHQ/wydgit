// Current Wydgine web renderer capability profile; canonical ownership is broader.
import {requireThat as check} from '../object-model/validation.js';
const placements={form:['blocks','fields'],field:[],section:['blocks'],block:['children'],page:['sections','navigation'],app:['pages','navigation'],navigation:[]};
export function serverKind(id,registry){return Object.keys(placements).find(kind=>registry.isA(id,`wydgit.core/${kind}`));}
export function serverPlacement(parent,slot,child,registry){if(!serverKind(child,registry))return;const kind=serverKind(parent,registry),definition=registry.get(parent);check(!(kind==='form'&&definition.component&&definition.presentation),'COMPONENT.TARGET','Composed Form presentation needs a native field placement contract');check(kind&&placements[kind].includes(slot),'COMPONENT.TARGET','This visual slot has no current server renderer placement');}
export function serverComponent(definition,registry){
 check(definition.presentation?.schema!=='wydgit.presentation/0.2','COMPONENT.TARGET','Client controls do not imply HTTP form semantics');
 if(definition.presentation)check(['block','section','field','form'].includes(serverKind(definition.id,registry)),'COMPONENT.TARGET','Presentation is unsupported for this server semantic type');
 for(const child of definition.component?.children??[])serverPlacement(definition.id,child.slot,child.type,registry);
 for(const r of definition.component?.repeaters??[]){const t=definition.component.templates.find(t=>t.name===r.template);serverPlacement(definition.id,r.slot,t.type,registry);}
}
