// Portable declarations restrict execution; only trusted SEAM bindings place it.
import {clean, freeze, record, requireThat as check} from '../object-model/validation.js';
export const EXECUTION_SCHEMA = 'wydgit.execution/1';
export function validateRuntime(runat) {
  check(['Client', 'Server'].includes(runat), 'EXECUTION.RUNTIME', 'Expected Client or Server');
}
export function validateContext(runat, context) {
  validateRuntime(runat);
  check((runat === 'Client' ? ['SUB'] : ['FrontEnd', 'BackOffice']).includes(context),
    'EXECUTION.CONTEXT', 'Unknown, unavailable or incompatible execution context');
  return context;
}
export function declaration(input) {
  const value = clean(input);
  check(record(value) && Object.keys(value).every(k => ['schema', 'runat', 'context'].includes(k)) &&
    value.schema === EXECUTION_SCHEMA, 'EXECUTION.DECLARATION', 'Expected wydgit.execution/1 declaration');
  validateRuntime(value.runat);
  if (Object.hasOwn(value, 'context')) validateContext(value.runat, value.context);
  return freeze(value);
}
export function restrictExecution(input, inherited) {
  const own = input === undefined ? undefined : declaration(input);
  if (!own) return inherited;
  if (inherited) {
    check(own.runat === inherited.runat && (inherited.context === undefined ||
      own.context === undefined || own.context === inherited.context),
      'EXECUTION.RESTRICTION', 'Execution restriction conflicts with an ancestor');
  }
  return freeze({...own, ...(inherited?.context === undefined ? {} : {context: inherited.context})});
}
export function checkPlacement(node, definition, binding) {
  const restriction = restrictExecution(node.execution, definition.execution);
  if (restriction) check(restriction.runat === binding.runat &&
    (restriction.context === undefined || restriction.context === binding.context),
    'EXECUTION.PLACEMENT', 'Instance is incompatible with trusted execution placement');
}
