export class GateError extends Error {
  constructor(code) { super(code === 'GATE.AUTH_FAILED' ? 'Authentication failed' : 'Gate operation failed'); this.code = code; }
  toJSON() { return {ok:false,code:this.code,message:this.message,details:{}}; }
}
export function check(ok,code='GATE.INVALID_USER') { if(!ok)throw new GateError(code); }
export function fields(value,required,optional=[],code='GATE.INVALID_USER') {
  check(value !== null && typeof value === 'object' && !Array.isArray(value) &&
    required.every(key=>Object.hasOwn(value,key)) && Object.keys(value).every(key=>[...required,...optional].includes(key)),code);
}
export function username(value) {
  check(typeof value === 'string' && value.length <= 64,'GATE.INVALID_USERNAME');
  const trimmed=value.replace(/^ +| +$/g,'');
  check(/^[A-Za-z][A-Za-z0-9_-]{2,31}$/.test(trimmed),'GATE.INVALID_USERNAME');
  return trimmed.toLowerCase();
}
export function displayName(value) {
  check(typeof value === 'string' && value.length <= 256 && value.isWellFormed() && [...value].length <= 128);
  return value;
}
export const validId = value => typeof value === 'string' && /^u_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
export function password(value) {
  check(typeof value === 'string' && value.length <= 256 && value.isWellFormed() && [...value].length >= 15 && [...value].length <= 128,'GATE.INVALID_PASSWORD');
  return value;
}
export const safeUser = user => Object.freeze({id:user.id,username:user.username,displayName:user.displayName,active:user.active});
