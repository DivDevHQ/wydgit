import { SERVICE_DEFAULTS, effectiveLimits, checkJsonBudget } from './limits.js';
import { checkContext } from '../seam/context.js';
import { clean, freeze, WydgitError } from '../object-model/validation.js';
const failures = new WeakSet();
export function failure(code) {
  if (typeof code !== 'string' || !/^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*$/.test(code) || code.length > 64) code = 'SERVICE.FAILED';
  const error = new WydgitError(code, 'Service operation failed');
  failures.add(error); return freeze(error);
}
export const isServiceFailure = error => failures.has(error);
const identifier = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value);
const apiVersion = value => typeof value === 'string' && /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(value);
export function bindServices(context, lookup, describe = () => undefined, operation) {
  checkContext(context);
  const run = async (service, input, versioned) => {
    try { checkContext(context); } catch { return failure('SEAM.DENIED').toJSON(); }
    if (!service || !context.allows(service.capability) || !service.authorize) return failure('SEAM.DENIED').toJSON();
    const policy=Object.freeze({...effectiveLimits(service.limits ?? SERVICE_DEFAULTS,context),...(operation?{operation}:{})});
    const limited=versioned || service.enforceLegacyLimits === true;
    let request;
    const validation=operation?.stage?.('dispatchValidation');
    try { if(limited)checkJsonBudget(input,policy.request);
      request=freeze(clean(input)); }
    catch { return failure('SERVICE.INVALID_REQUEST').toJSON(); }
    finally {validation?.();}
    try {
      let authorized;const authorization=operation?.stage?.('dispatchAuthorization');
      try {authorized=await service.authorize(request, context, policy);}finally{authorization?.();}
      if (authorized !== true) return failure('SEAM.DENIED').toJSON();
      if (versioned) {
        let valid;const validation=operation?.stage?.('dispatchValidation');
        try{valid=service.validate&&await service.validate(request, context, policy);}finally{validation?.();}
        if(valid!==true)return failure('SERVICE.INVALID_REQUEST').toJSON();
      }
      checkContext(context);
      operation?.begin();
      let result;const native=operation?.stage?.('nativeHandler');
      try{result=await service.handler(request, context, policy);}finally{native?.();}
      checkContext(context);
      let value;
      try { if(limited)checkJsonBudget(result,policy.response);
        value=freeze(clean(result)); }
      catch { return failure(versioned ? 'SERVICE.INVALID_RESULT' : 'SERVICE.FAILED').toJSON(); }
      return Object.freeze({ ok: true, value });
    } catch (error) {
      return isServiceFailure(error) ? error.toJSON() : failure('SERVICE.FAILED').toJSON();
    }
  };
  return Object.freeze({
    async call(library, name, input) {
      try { if (describe(library)?.apiVersion && !describe(library).legacyOperations?.includes(name)) return failure('SERVICE.VERSION_REQUIRED').toJSON(); return await run(lookup(library,name), input, false); }
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
