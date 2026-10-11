import { createHmac } from 'node:crypto';
// A component receives only its own binding token, never the session CSRF secret.
export function submissionToken(secret,app,page,target,binding) {
 if(typeof secret!=='string'||secret.length<32||!binding)return '';
 return createHmac('sha256',secret).update(JSON.stringify([app,page,target,binding.library,binding.apiVersion,binding.operation])).digest('hex');
}
