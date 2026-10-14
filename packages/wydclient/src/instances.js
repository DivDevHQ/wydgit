import { SCHEMA, resolveProperties } from '../../../wydgine/object-model/schema.js';
import { clean, freeze, check, shape, parseJSON } from './data.js';
// Trusted host adapter only. Tokens are identity-bound, never IDs or JSON snapshots.
export function instances({ registry, page, regions, active, boundary, provenance }) {
  const tokens = new WeakMap(); let nodes = new Map(), serial = 0, closed = false;
  const destinations = new Map([['SUB.Page.Top', []], ['SUB.Page.Bottom', []]]);
  let rendered = []; const generated = new WeakSet();
  const guard = () => { active(); check(!closed, 'OBJECT.DISPOSED', 'Environment disposed'); };
  const get = ref => { guard(); const id = tokens.get(ref); check(id && nodes.has(id) && nodes.get(id).lifecycle !== 'owned-draft', 'OBJECT.REFERENCE', 'Invalid or stale reference'); return nodes.get(id); };
  const token = id => { const ref = Object.freeze({}); tokens.set(ref, id); return ref; };
  const bounded = value => parseJSON(new TextEncoder().encode(JSON.stringify(clean(value))));
  const publicValues = n => Object.fromEntries(Object.entries(n.properties).filter(([k]) => { const r = registry.get(n.prototype).properties[k]; return (r.access ?? 'public') === 'public' && !r.hidden && !r.requires?.length; }));
  function validate(candidate, complete = false, depth = 0) {
    check(depth <= 32, 'OBJECT.LIMIT', 'Tree depth exceeded');
    const def = registry.get(candidate.prototype);
    candidate.properties = resolveProperties(candidate.properties, def, { incomplete: !complete });
    for (const [slot, rule] of Object.entries(def.slots)) {
      const children = candidate.slots[slot];
      check(children.length <= (rule.max ?? 256) && (!complete || children.length >= (rule.min ?? 0)), 'OBJECT.CARDINALITY', 'Invalid child count');
      for (const id of children) { const child = nodes.get(id); check(rule.accepts.some(base => registry.isA(child.prototype, base)), 'OBJECT.CHILD_TYPE', 'Invalid child type'); validate(child, complete, depth + 1); }
    }
    // Conservative H2 presentation: existing typed content, rendered as literal text.
    const values = publicValues(candidate);
    if (values.content !== undefined) shape(values.content, ['type', 'value'], ['type', 'value']);
    if (values.content !== undefined) check(values.content.type === 'markdown' && typeof values.content.value === 'string', 'RENDER.CONTENT', 'Unsupported content');
    const format = values.format ?? {};
    shape(format, ['align', 'width', 'tone']);
    for (const [key, value] of Object.entries(format)) check(({ align: ['start','center','end'], width: ['normal','wide','narrow'], tone: ['plain','muted','hero'] })[key].includes(value), 'RENDER.FORMAT', 'Unsupported style hook');
  }
  function preserve(element) {
    for (const child of [...element.childNodes]) {
      if ((child.nodeType === 1 && boundary(child)) || !generated.has(child)) element.parentNode?.insertBefore(child, element);
      else if (child.nodeType === 1) preserve(child);
    }
  }
  function clear() { for (const element of rendered) { preserve(element); element.remove(); } rendered = []; }
  function render() {
    const staged = [];
    const build = id => {
      const n = nodes.get(id), values = publicValues(n), el = regions.top.ownerDocument.createElement(registry.isA(n.prototype, 'wydgit.core/section') ? 'section' : 'div');
      generated.add(el); el.setAttribute('data-wydclient-object', '');
      el.className = ['wyd-object', ...Object.entries(values.format ?? {}).map(([k,v]) => `wyd-${k}-${v}`)].join(' ');
      if (values.content) { const text = el.ownerDocument.createElement('p'); generated.add(text); text.setAttribute('data-wydclient-object', ''); text.textContent = values.content.value; for (const child of text.childNodes) generated.add(child); el.append(text); }
      for (const children of Object.values(n.slots)) for (const child of children) el.append(build(child));
      return el;
    };
    try { for (const [destination, ids] of destinations) for (const id of ids) staged.push([destination.endsWith('Top') ? regions.top : regions.bottom, build(id)]); }
    catch { check(false, 'RENDER.FAILED', 'Rendering failed'); }
    const inserted = [];
    try { for (const [region, el] of staged) { region.append(el); inserted.push(el); } }
    catch { for (const el of inserted) el.remove(); check(false, 'RENDER.FAILED', 'Rendering failed'); }
    clear(); rendered = inserted;
  }
  function transaction(fn) {
    guard(); const previous = nodes, previousDestinations = [...destinations].map(([k,v]) => [k,[...v]]);
    nodes = new Map([...nodes].map(([id,n]) => [id, { ...n, properties: clean(n.properties), slots: clean(n.slots), provenance: clean(n.provenance) }]));
    try { const result = fn(); check(nodes.size <= 256 && JSON.stringify([...nodes.values()]).length <= 262144, 'OBJECT.LIMIT', 'Instance budget exceeded'); for (const n of nodes.values()) if (!nodes.has(n.parent)) validate(n, n.lifecycle === 'placed'); render(); return result; }
    catch (error) { nodes = previous; for (const [k,v] of previousDestinations) destinations.set(k,v); throw error; }
  }
  const list = (parent, slot) => {
    guard();
    if (typeof parent === 'string') { const destination = parent === 'SUB.Page.default' ? 'SUB.Page.Bottom' : parent; check(destinations.has(destination) && slot === undefined, 'OBJECT.PARENT', 'Invalid destination'); return { children: destinations.get(destination), parent: page.id, slot: destination }; }
    const n = get(parent); check(Object.hasOwn(n.slots, slot), 'OBJECT.SLOT', 'Invalid slot'); return { children: n.slots[slot], parent: n.id, slot, owner: n };
  };
  const api = Object.freeze({
    construct(spec) { guard(); spec = bounded(spec); shape(spec, ['type','properties'], ['type']); const def = registry.get(spec.type);
      check(!def.abstract && !def.static && (registry.isA(def.id, 'wydgit.core/section') || registry.isA(def.id, 'wydgit.core/block')), 'OBJECT.CONSTRUCTION', 'Unsupported construction');
      const id = `${page.id}-Instance-${++serial}`;
      transaction(() => { const n = { schema: SCHEMA, id, prototype: def.id, properties: spec.properties ?? {}, slots: Object.fromEntries(Object.keys(def.slots).map(k => [k,[]])), provenance: { publisher: def.publisher, version: def.version ?? null, ...(provenance.get(def.id) ?? {}) }, lifecycle: 'draft', parent: null, slot: null }; nodes.set(id,n); validate(n); }); return token(id);
    },
    Insert(parent, slot, index, ref) { const child = get(ref), target = list(parent, slot); check(child.lifecycle === 'draft' && !child.parent, 'OBJECT.OWNERSHIP', 'Child already owned');
      check(!target.owner || target.owner.lifecycle === 'draft' || target.owner.lifecycle === 'placed', 'OBJECT.PARENT', 'Invalid parent');
      for (let n = target.owner; n; n = nodes.get(n.parent)) check(n.id !== child.id, 'OBJECT.CYCLE', 'Parent cycle');
      check(Number.isSafeInteger(index) && index >= 0 && index <= target.children.length, 'MUTATION.INDEX', 'Invalid index');
      transaction(() => { const t = list(parent, slot), c = nodes.get(child.id); validate(c, true); t.children.splice(index,0,c.id); c.parent=t.parent; c.slot=t.slot;
        if (t.owner) validate(t.owner); const mark = n => { n.lifecycle = t.owner?.lifecycle === 'draft' ? 'owned-draft' : 'placed'; for (const ids of Object.values(n.slots)) for (const id of ids) mark(nodes.get(id)); }; mark(c);
        if (!t.owner || t.owner.lifecycle === 'placed') validate(c,true);
      }); tokens.delete(ref); return target.owner?.lifecycle === 'draft' ? null : token(child.id);
    },
    children(parent, slot) { const t = list(parent,slot); check(!t.owner || t.owner.lifecycle === 'placed', 'OBJECT.CONSTRUCTION', 'Draft children are consumed'); return Object.freeze(t.children.map(token)); },
    Move(ref, index, sibling, after = false) { const n = get(ref); check(n.lifecycle === 'placed', 'OBJECT.LIFECYCLE', 'Expected placed instance');
      const ids = n.parent === page.id ? destinations.get(n.slot) : nodes.get(n.parent).slots[n.slot]; const reordered = ids.filter(id => id !== n.id);
      if (sibling !== undefined) { const s = get(sibling); check(s.id !== n.id && s.parent === n.parent && s.slot === n.slot, 'OBJECT.SIBLING', 'Invalid sibling'); index = reordered.indexOf(s.id) + (after ? 1 : 0); }
      check(Number.isSafeInteger(index) && index >= 0 && index <= reordered.length, 'MUTATION.INDEX', 'Invalid index');
      transaction(() => { const current = nodes.get(n.id), list = current.parent === page.id ? destinations.get(current.slot) : nodes.get(current.parent).slots[current.slot]; list.splice(list.indexOf(n.id),1); list.splice(index,0,n.id); });
    },
    Set(ref, name, value) { const n = get(ref); check(['draft','placed'].includes(n.lifecycle), 'OBJECT.LIFECYCLE', 'Consumed draft'); transaction(() => { const current = nodes.get(n.id); current.properties[name] = bounded(value); validate(current, current.lifecycle === 'placed'); }); },
    Remove(ref) { const n = get(ref); check(['draft','placed'].includes(n.lifecycle), 'OBJECT.LIFECYCLE', 'Consumed draft'); transaction(() => { if(n.parent) { const parent=nodes.get(n.parent), ids=parent ? parent.slots[n.slot] : destinations.get(n.slot); ids.splice(ids.indexOf(n.id),1); if(parent) validate(parent,parent.lifecycle==='placed'); } const drop = id => { for(const ids of Object.values(nodes.get(id).slots)) for(const child of ids) drop(child); nodes.delete(id); }; drop(n.id); }); },
    snapshot(ref) { const n=get(ref); return freeze({ schema:n.schema,id:n.id,prototype:n.prototype,properties:clean(publicValues(n)),slots:clean(n.slots),provenance:clean(n.provenance),lifecycle:n.lifecycle,parent:n.parent,slot:n.slot }); },

  });
  return { api, dispose() { closed=true; clear(); nodes.clear(); for(const ids of destinations.values()) ids.length=0; regions = registry = page = provenance = boundary = null; } };
}
