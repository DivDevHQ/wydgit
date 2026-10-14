import { PrototypeRegistry } from '../../../wydgine/object-model/prototypes.js';
import { resolveProperties } from '../../../wydgine/object-model/schema.js';
import definitions from '../../../prototypes/objects.json' with { type: 'json' };
import { check, record, LIMITS } from './data.js';
// An exact subset of repository-owned H0 definitions, including all slot dependencies.
const coreIds = ['object', 'page', 'section', 'block', 'field', 'navigation'].map(x => 'wydgit.core/' + x);
export const coreDefinitions = definitions.filter(d => coreIds.includes(d.id));
export function approveRegistry(declarations, verifiedPrototypes) {
  check(declarations.length <= LIMITS.prototypes, 'MANIFEST.LIMIT', 'Prototype limit exceeded');
  for (const d of declarations) {
    check(record(d) && typeof d.id === 'string' && d.publisher !== 'wydgit.core', 'PROTOTYPE.IDENTITY', 'Invalid prototype identity');
    check(Object.keys(d).every(k => ['id', 'publisher', 'public', 'abstract', 'extends', 'properties', 'slots', 'friends', 'methodRules', 'overrides', 'behavior','interface','alias','version','signatures','implements'].includes(k)), 'PROTOTYPE.DEFINITION', 'Unsupported client prototype field');
    // H1 validates inert method declarations using H0, but accepts no executable bodies.
    if (d.behavior) check(Array.isArray(d.behavior.body) && d.behavior.body.length === 0 && record(d.behavior.procedures) && Object.values(d.behavior.procedures).every(p => Array.isArray(p.body) && p.body.length === 0), 'PROTOTYPE.METHOD', 'Executable behavior is deferred');
  }
  const registry = new PrototypeRegistry([...coreDefinitions, ...declarations], { verifiedPrototypes });
  for (const d of declarations) resolveProperties({}, registry.get(d.id), { incomplete: true });
  return registry;
}
