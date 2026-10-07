import { clean, freeze, record, requireThat as check } from './validation.js';
const identity = /^[a-z][a-z0-9.-]*\/[a-z][a-z0-9-]*$/;
export class PrototypeRegistry {
  #definitions = new Map();
  constructor(definitions, { officialPublishers = ['wydgit.core'] } = {}) {
    const raw = new Map();
    for (const input of definitions) {
      const d = clean(input);
      check(identity.test(d.id) && d.publisher === d.id.split('/')[0], 'PROTOTYPE.IDENTITY', 'Invalid prototype identity or publisher');
      check(!raw.has(d.id), 'PROTOTYPE.DUPLICATE', 'Duplicate prototype'); raw.set(d.id, d);
    }
    const visiting = new Set();
    const resolve = id => {
      if (this.#definitions.has(id)) return this.#definitions.get(id);
      const d = raw.get(id);
      check(d, 'PROTOTYPE.UNKNOWN', `Unknown prototype: ${id}`);
      check(!visiting.has(id), 'PROTOTYPE.CYCLE', 'Inheritance cycle'); visiting.add(id);
      let base;
      if (d.extends !== undefined) {
        check(typeof d.extends === 'string', 'PROTOTYPE.INHERITANCE', 'Single inheritance requires one prototype ID');
        base = resolve(d.extends);
        check(base.publisher === d.publisher || (officialPublishers.includes(base.publisher) && base.public === true), 'PROTOTYPE.PUBLISHER', 'Cross-publisher inheritance denied');
      }
      check(d.abstract === undefined || typeof d.abstract === 'boolean', 'PROTOTYPE.DEFINITION', 'Invalid abstract flag');
      check(d.public === undefined || typeof d.public === 'boolean', 'PROTOTYPE.DEFINITION', 'Invalid public flag');
      check(record(d.properties ?? {}) && record(d.slots ?? {}), 'PROTOTYPE.DEFINITION', 'Invalid definitions');
      const properties = { ...base?.properties, ...d.properties }, slots = { ...base?.slots, ...d.slots };
      for (const rule of Object.values(properties)) {
        check(record(rule) && ['string','number','boolean','object','array','null'].includes(rule.type), 'PROTOTYPE.DEFINITION', 'Invalid property rule');
        check(rule.enum === undefined || Array.isArray(rule.enum), 'PROTOTYPE.DEFINITION', 'Invalid enum');
      }
      for (const rule of Object.values(slots)) {
        check(record(rule) && Array.isArray(rule.accepts) && rule.accepts.length > 0 && rule.accepts.every(x => typeof x === 'string'), 'PROTOTYPE.SLOT', 'Slot needs accepted prototypes');
        check(rule.ordered === true && Number.isInteger(rule.min ?? 0) && (rule.min ?? 0) >= 0 && (rule.max === undefined || (Number.isInteger(rule.max) && rule.max >= (rule.min ?? 0))), 'PROTOTYPE.SLOT', 'Invalid ordered slot cardinality');
      }
      const result = freeze({ ...d, abstract: d.abstract ?? false, properties, slots, ancestors: base ? [base.id, ...base.ancestors] : [] });
      visiting.delete(id); this.#definitions.set(id, result); return result;
    };
    for (const id of raw.keys()) resolve(id);
    for (const d of this.#definitions.values()) for (const slot of Object.values(d.slots)) for (const id of slot.accepts) this.get(id);
    Object.freeze(this);
  }
  get(id) { const d = this.#definitions.get(id); check(d, 'PROTOTYPE.UNKNOWN', `Unknown prototype: ${id}`); return d; }
  isA(id, base) { const d = this.get(id); return id === base || d.ancestors.includes(base); }
}
