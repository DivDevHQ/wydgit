// Trusted static-site approval; neither manifest nor publisher can set this policy.
const verifiedPrototypes=Object.fromEntries(['task-card','task-record','task-list','task-model','task-navigation','taskboard'].map(n=>['divdev/'+n,'divdev']));
globalThis.taskboardPolicy={verifiedPrototypes,execution:{publisher:'divdev',package:'divdev/wbasic-taskboard',installation:'reviewed-static-taskboard',actions:['SelectPage'],capabilities:['object.instances.edit','object.instances.construct','event.custom.raise'],visible:['taskboard','taskboard-*'],editable:['taskboard','taskboard-*'],traversal:['children'],scopes:{prototypes:['divdev/task-card'],events:['pagechanged']}}};
if(!document.querySelector('[data-taskboard-root]'))globalThis.WydClientConfig=taskboardPolicy;
