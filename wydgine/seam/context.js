import { isCapability } from './capabilities.js';
import { clean, freeze, record, requireThat as check } from '../object-model/validation.js';
const contexts = new WeakSet();
export class ExecutionContext {
  constructor({ publisher, package: packageId = null, self, app = null, scopes = {}, capabilities = [], visible = [], editable = [], traversal = [], limits = {} }) {
    check(typeof publisher === 'string' && typeof self === 'string', 'SEAM.CONTEXT', 'Context requires publisher and self');
    check(Array.isArray(capabilities) && capabilities.every(isCapability), 'SEAM.CAPABILITY', 'Invalid capability name');
    check(Array.isArray(visible) && visible.every(x => typeof x === 'string'), 'SEAM.CONTEXT', 'Invalid visible scope');
    check(Array.isArray(editable) && editable.every(x => typeof x === 'string'), 'SEAM.CONTEXT', 'Invalid editable scope');
    check(Array.isArray(traversal) && traversal.every(x => ['parent','root','children','previousSibling','nextSibling'].includes(x)), 'SEAM.CONTEXT', 'Invalid traversal permission');
    check(packageId === null || typeof packageId === 'string', 'SEAM.CONTEXT', 'Invalid package identity');
    check(app === null || typeof app === 'string', 'SEAM.CONTEXT', 'Invalid App identity');
    const scopeData = clean(scopes);
    check(record(scopeData), 'SEAM.CONTEXT', 'Scopes must be a JSON object');
    const resources = clean(limits);
    check(record(resources) && Object.values(resources).every(n => Number.isSafeInteger(n) && n >= 0), 'SEAM.CONTEXT', 'Limits must be non-negative integers');
    Object.assign(this, { publisher, package: packageId, self, app, scopes: scopeData, capabilities: [...new Set(capabilities)], visible: [...new Set([self, ...visible])], editable: [...new Set(editable)], traversal: [...new Set(traversal)], limits: resources });
    contexts.add(this); freeze(this);
  }
  allows(capability) { return this.capabilities.includes(capability); }
  require(capability) { check(this.allows(capability), 'SEAM.DENIED', 'Capability denied'); }
}
export function checkContext(context) { check(contexts.has(context), 'SEAM.CONTEXT', 'Expected host-issued execution context'); }
