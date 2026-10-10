import { validId } from '../object-model/schema.js';
import { isCapability } from './capabilities.js';
import { clean, freeze, record, requireThat as check } from '../object-model/validation.js';
// Object grants alone accept one nonempty trailing prefix wildcard. These helpers
// never match capabilities, traversal, prototype scopes or service resources.
export function validObjectGrant(grant) {
  return typeof grant === 'string' && (grant.endsWith('*')
    ? grant.endsWith('-*') && validId(grant.slice(0, -2))
    : validId(grant));
}
export function matchesObjectGrant(grants, id) {
  if (!validId(id)) return false;
  return grants.some(grant => validObjectGrant(grant) && (grant === id ||
    grant.endsWith('*') && id.startsWith(grant.slice(0, -1))));
}
// Policy validation needs set containment, rather than treating a pattern as an ID.
export function objectGrantCovers(grants, grant) {
  if (!validObjectGrant(grant)) return false;
  if (!grant.endsWith('*')) return matchesObjectGrant(grants, grant);
  const prefix = grant.slice(0, -1);
  return grants.some(visible => validObjectGrant(visible) && visible.endsWith('*') && prefix.startsWith(visible.slice(0, -1)));
}
const contexts = new WeakSet();
export class ExecutionContext {
  constructor({ publisher, package: packageId = null, self, app = null, scopes = {}, identity = null, capabilities = [], visible = [], editable = [], traversal = [], limits = {} }) {
    check(typeof publisher === 'string' && validId(self), 'SEAM.CONTEXT', 'Context requires publisher and self');
    check(Array.isArray(capabilities) && capabilities.every(isCapability), 'SEAM.CAPABILITY', 'Invalid capability name');
    check(Array.isArray(visible) && visible.length <= 10000 && visible.every(validObjectGrant), 'SEAM.CONTEXT', 'Invalid visible scope');
    check(Array.isArray(editable) && editable.length <= 10000 && editable.every(validObjectGrant), 'SEAM.CONTEXT', 'Invalid editable scope');
    check(Array.isArray(traversal) && traversal.every(x => ['parent','root','children','previousSibling','nextSibling'].includes(x)), 'SEAM.CONTEXT', 'Invalid traversal permission');
    check(packageId === null || typeof packageId === 'string', 'SEAM.CONTEXT', 'Invalid package identity');
    check(app === null || typeof app === 'string', 'SEAM.CONTEXT', 'Invalid App identity');
    const scopeData = clean(scopes);
    check(record(scopeData), 'SEAM.CONTEXT', 'Scopes must be a JSON object');
    // Host-supplied identity metadata is not a capability or scope grant.
    const subject = clean(identity);
    if (subject !== null) {
      const keys=['authenticated','app','userId','sessionId','createdAt','expiresAt','roles','groups','permissions'];
      check(record(subject) && Object.keys(subject).length===keys.length && keys.every(key=>Object.hasOwn(subject,key)) &&
        subject.authenticated===true && subject.app===app && typeof subject.userId==='string' && typeof subject.sessionId==='string' &&
        Number.isSafeInteger(subject.createdAt) && subject.createdAt>=0 && Number.isSafeInteger(subject.expiresAt) && subject.expiresAt>subject.createdAt &&
        ['roles','groups','permissions'].every(key=>Array.isArray(subject[key])&&subject[key].every(value=>typeof value==='string')),
        'SEAM.CONTEXT','Invalid identity metadata');
    }
    const resources = clean(limits);
    check(record(resources) && Object.values(resources).every(n => Number.isSafeInteger(n) && n >= 0), 'SEAM.CONTEXT', 'Limits must be non-negative integers');
    Object.assign(this, { publisher, package: packageId, self, app, identity: subject, scopes: scopeData, capabilities: [...new Set(capabilities)], visible: [...new Set([self, ...visible])], editable: [...new Set(editable)], traversal: [...new Set(traversal)], limits: resources });
    contexts.add(this); freeze(this);
  }
  allows(capability) { return this.capabilities.includes(capability); }
  require(capability) { check(this.allows(capability), 'SEAM.DENIED', 'Capability denied'); }
}
export function checkContext(context) { check(contexts.has(context), 'SEAM.CONTEXT', 'Expected host-issued execution context'); }
