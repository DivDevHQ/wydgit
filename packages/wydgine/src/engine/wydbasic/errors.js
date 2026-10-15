import { WydgitError } from '../object-model/validation.js';
export function fail(code, message, location = {line:1,column:1,offset:0}) {
  throw new WydgitError(`WYDBASIC.${code}`, `Line ${location.line}, column ${location.column}: ${message}`, { ...location });
}
