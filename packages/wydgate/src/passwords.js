import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { check } from './validation.js';
const parameters = Object.freeze({type:argon2.argon2id,version:0x13,memoryCost:19456,timeCost:2,parallelism:1,hashLength:32});
// Accept only our bounded format before passing persisted work factors to Argon2.
export const validHash = value => typeof value === 'string' && /^\$argon2id\$v=19\$m=19456,p=1,t=2\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/.test(value);
export async function passwords() {
  let active = 0;
  const bounded = async work => {
    check(active < 2,'GATE.BUSY'); active++;
    try { return await work(); } finally { active--; }
  };
  const hash = value => bounded(()=>argon2.hash(value,parameters));
  const dummy = await hash(randomBytes(32).toString('hex'));
  return Object.freeze({hash, async verify(value,encoded=dummy) {
    check(validHash(encoded),'GATE.IO');
    return bounded(()=>argon2.verify(encoded,value));
  }});
}
