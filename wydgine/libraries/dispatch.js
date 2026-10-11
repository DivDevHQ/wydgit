import { checkContext } from '../seam/context.js';
import { clean, freeze, jsonKeys, WydgitError } from '../object-model/validation.js';
const failures = new WeakSet();
export function failure(code) {
  if (typeof code !== 'string' || !/^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*$/.test(code) || code.length > 64) code = 'SERVICE.FAILED';
  const error = new WydgitError(code, 'Service operation failed');
  failures.add(error); return freeze(error);
}
export const isServiceFailure = error => failures.has(error);
const identifier = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value);
const apiVersion = value => typeof value === 'string' && /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(value);
// Bound before copying, including descriptor inspection before reading values.
function boundary(input) {
  let nodes = 0, characters = 0;
  const active = new Set();
  const visit = (value, depth = 0) => {
    if (++nodes > 4096 || depth > 32) throw failure('SERVICE.INVALID_REQUEST');
    if (typeof value === 'string') characters += value.length;
    if (characters > 65536) throw failure('SERVICE.INVALID_REQUEST');
    if (value && typeof value === 'object') {
      if (active.has(value)) throw failure('SERVICE.INVALID_REQUEST');
      active.add(value);
      for (const key of jsonKeys(value)) {
        characters += key.length;
        visit(Object.getOwnPropertyDescriptor(value,key).value, depth + 1);
      }
      active.delete(value);
    }
  };
  visit(input); return freeze(clean(input));
}
export function bindServices(context, lookup, describe = () => undefined) {
  checkContext(context);
  const run = async (service, input, versioned) => {
    if (!service || !context.allows(service.capability) || !service.authorize) return failure('SEAM.DENIED').toJSON();
    let request;
    try { request = versioned ? boundary(input) : freeze(clean(input)); }
    catch { return failure('SERVICE.INVALID_REQUEST').toJSON(); }
    try {
      if (await service.authorize(request, context) !== true) return failure('SEAM.DENIED').toJSON();
      if (versioned && (!service.validate || await service.validate(request) !== true)) return failure('SERVICE.INVALID_REQUEST').toJSON();
      const result = await service.handler(request, context);
      let value;
      try { value = versioned ? boundary(result) : freeze(clean(result)); }
      catch { return failure(versioned ? 'SERVICE.INVALID_RESULT' : 'SERVICE.FAILED').toJSON(); }
      return Object.freeze({ ok: true, value });
    } catch (error) {
      return isServiceFailure(error) ? error.toJSON() : failure('SERVICE.FAILED').toJSON();
    }
  };
  return Object.freeze({
    async call(library, name, input) {
      try { if (describe(library)?.apiVersion) return failure('SERVICE.VERSION_REQUIRED').toJSON(); return await run(lookup(library,name), input, false); }
      catch { return failure('SERVICE.INVALID_REQUEST').toJSON(); }
    },
    async invoke(library, requestedVersion, name, input) {
      if (!identifier(library) || !identifier(name) || !apiVersion(requestedVersion)) return failure('SERVICE.INVALID_REQUEST').toJSON();
      const manifest = describe(library);
      if (!manifest) return failure('SERVICE.UNAVAILABLE').toJSON();
      if (manifest.apiVersion !== requestedVersion) return failure('SERVICE.VERSION_UNSUPPORTED').toJSON();
      const service = lookup(library,name);
      if (!service) return failure('SERVICE.OPERATION_UNKNOWN').toJSON();
      if (context.app === null) return failure('SEAM.DENIED').toJSON();
      return run(service,input,true);
    }
  });
}
