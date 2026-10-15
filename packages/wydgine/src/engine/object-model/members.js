import { isCapability } from '../seam/capabilities.js';
import { checkContext } from '../seam/context.js';
import { requireThat as check, clean, freeze, record } from './validation.js';
// Host-only adapters. Portable JSON and package code cannot create these bindings.
const bindings = new WeakMap();
export function bindMembers(handle, adapter) { bindings.set(handle, adapter); return handle; }
export function memberAdapter(handle, context) { const adapter=bindings.get(handle);if(adapter&&context)check(adapter.context===context,'OBJECT.ACCESS','Foreign execution handle');return adapter; }
export const accessOf = rule => rule.access ?? 'public';
export const discoverable = rule => rule.hidden !== true;
export function validateMember(rule) {
  check(record(rule),'PROTOTYPE.ACCESS','Invalid member rule');
  check(['public','private','protected','friend'].includes(accessOf(rule)), 'PROTOTYPE.ACCESS', 'Invalid member access');
  check(rule.requires===undefined||Array.isArray(rule.requires)&&rule.requires.every(isCapability),'PROTOTYPE.ACCESS','Invalid member capability requirements');
  check(rule.hidden === undefined || typeof rule.hidden === 'boolean', 'PROTOTYPE.ACCESS', 'Invalid member visibility');
}
export function resolveMember(definition, kind, name, exact = true) {
  const table = kind === 'property' ? definition.properties : definition.methods;
  const rules = kind === 'property' ? definition.properties : definition.methodRules;
  const names = exact ? Object.keys(table).filter(k => k === name) : Object.keys(table).filter(k => k.toLowerCase() === name.toLowerCase() && discoverable(rules[k] ?? {}));
  check(names.length === 1, names.length > 1 ? 'OBJECT.AMBIGUOUS_MEMBER' : kind==='property'?'OBJECT.PROPERTY':'PROTOTYPE.METHOD', names.length > 1 ? 'Ambiguous member; use exact lookup' : 'Unknown member');
  const key = names[0], rule = rules[key] ?? {};
  return { name: key, rule, owner: kind === 'property' ? definition.propertyOwners[key] : table[key].owner };
}
export function checkMemberCapabilities(rule, context) {
  if(rule.requires?.length){checkContext(context);for(const capability of rule.requires)context.require(capability);}
}
export function authorizeMember(registry, member, caller = null, context = null) {
  checkMemberCapabilities(member.rule, context);
  const access = accessOf(member.rule), owner = member.owner;
  if (access === 'public') return;
  check(caller && (caller === owner || access === 'protected' && registry.isA(caller, owner) || access === 'friend' && registry.verifiedPublisher(caller)===registry.get(caller).publisher && registry.verifiedPublisher(owner)===registry.get(owner).publisher && registry.get(owner).friends.some(pattern => pattern === caller || pattern === registry.get(caller).publisher + '/*')), 'OBJECT.ACCESS', 'Member access denied');
}
export function readMember(handle, registry, name, exact, caller, context) {
  const adapter = memberAdapter(handle,context); check(adapter, 'OBJECT.ACCESS', 'Member adapter unavailable');
  const node = adapter.node(), member = resolveMember(registry.get(node.prototype), 'property', name, exact);
  authorizeMember(registry, member, caller, context);
  // Sensitive semantic fields are redacted even for an OOP-authorized reference.
  return freeze(clean(adapter.read ? adapter.read(member.name) : node.properties[member.name]));
}
export function writeMember(handle, registry, name, value, exact, caller, context) {
  const adapter = memberAdapter(handle,context); check(adapter?.set, 'OBJECT.ACCESS', 'Member adapter unavailable');
  const member = resolveMember(registry.get(adapter.node().prototype), 'property', name, exact);
  authorizeMember(registry, member, caller, context); return adapter.set(member.name, value);
}
