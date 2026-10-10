import { checkContext } from '../seam/context.js';
import { clean, freeze, WydgitError } from '../object-model/validation.js';
const failures = new WeakSet();
export function failure(code) {
  if (typeof code !== 'string' || !/^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*$/.test(code) || code.length > 64) code = 'SERVICE.FAILED';
  const error = new WydgitError(code, 'Service operation failed');
  failures.add(error); return freeze(error);
}
export const isServiceFailure = error => failures.has(error);
export function bindServices(context, lookup) {
  checkContext(context);
  return Object.freeze({ async call(library, name, input) {
    try {
      const service = lookup(library, name);
      if (!service || !context.capabilities.includes(service.capability) || !service.authorize) return failure('SEAM.DENIED').toJSON();
      const request = freeze(clean(input));
      try {
        if (await service.authorize(request, context) !== true) return failure('SEAM.DENIED').toJSON();
        const value = freeze(clean(await service.handler(request, context)));
        return Object.freeze({ ok: true, value });
      } catch (error) {
        return isServiceFailure(error) ? error.toJSON() : failure('SERVICE.FAILED').toJSON();
      }
    } catch { return failure('SERVICE.INVALID_REQUEST').toJSON(); }
  } });
}
