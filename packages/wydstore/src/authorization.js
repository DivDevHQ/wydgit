import { check, fields, record, idValid } from './data.js';

const operations = ['get','query','count','metadata','history','create','update','delete','transaction'];
const permission = value => typeof value === 'string' && value.length <= 128 &&
  /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(value);

// Trusted host operational policy. It does not change physical ownership or
// collection schema, and cannot be supplied through a canonical operation.
export function validateAuthorization(input, collections) {
  if (input === undefined) return;
  fields(input,['schema','collections'],[],'STORE.INVALID_CONFIG');
  check(input.schema === 'wydstore.authorization/1' && record(input.collections),'STORE.INVALID_CONFIG');
  for (const [id,rules] of Object.entries(input.collections)) {
    check(idValid(id) && collections.has(id) && record(rules),'STORE.INVALID_CONFIG');
    for (const [operation,rule] of Object.entries(rules)) {
      check(operations.includes(operation),'STORE.INVALID_CONFIG');
      fields(rule,['contexts'],['permission','public'],'STORE.INVALID_CONFIG');
      check(Array.isArray(rule.contexts) && rule.contexts.length > 0 && rule.contexts.length <= 2 &&
        new Set(rule.contexts).size === rule.contexts.length &&
        rule.contexts.every(c => ['FrontEnd','BackOffice'].includes(c)) &&
        (Object.hasOwn(rule,'permission') ? permission(rule.permission) && !Object.hasOwn(rule,'public') : rule.public === true),
        'STORE.INVALID_CONFIG');
    }
  }
}

export async function authorizeOperation(definition, operation, request, caller, authorizeSitePolicy) {
  if (!definition.authorization) return;
  const rule = definition.authorization.collections[request.collection]?.[operation];
  check(rule && caller.runat === 'Server' && rule.contexts.includes(caller.context),'STORE.DENIED');
  if (rule.public === true) return; // Still subject to all ordinary SEAM/owner checks.
  check(typeof authorizeSitePolicy === 'function','STORE.DENIED');
  try {
    check(await authorizeSitePolicy(caller, {
      permission:rule.permission, contexts:rule.contexts, operation,
      resource:{app:definition.app,store:definition.id,collection:request.collection,...(request.id?{id:request.id}:{})}
    }) === true,'STORE.DENIED');
  } catch { check(false,'STORE.DENIED'); }
}
