import { fieldKind,sensitive } from './object-model/forms.js';
// Trusted web-renderer projection. These mutable DTOs are never SEAM handles.
export function webModel(runtime, model) {
  const project = id => {
    const object = runtime.get(id);
    const kind = ['form','field','app','page','section','block','navigation'].find(kind=>model.registry?.isA(object.prototype,`wydgit.core/${kind}`))??object.prototype.split('/')[1];
    const node = { id, prototype: kind === 'app' ? 'site' : kind, ...structuredClone(object.properties) };
    if(kind==='field'){node.controlKind=fieldKind(object.prototype,model.registry);if(sensitive(object.prototype,model.registry))node.value='';}
    for (const [slot, children] of Object.entries(object.slots)) {
      node[slot] = slot === 'navigation' && kind === 'page' ? children.map(project)[0] : children.map(project);
    }
    return node;
  };
  const app = project(runtime.rootId);
  const pages = new Map(app.pages.map(page => [page.id, page]));
  const navigation = app.navigation;
  app.pages = [...pages.keys()]; app.navigation = navigation.map(n => n.id);
  return { ...model, runtime, site: app, pages, navigation };
}
