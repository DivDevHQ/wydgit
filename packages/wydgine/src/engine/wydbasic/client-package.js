// Development-time packaging only. Existing browser envelope/signature format is unchanged.
import {createHash,sign,createPublicKey,createPrivateKey} from 'node:crypto';
import {compileFamily} from './family.js';
import {clean,freeze,requireThat as check} from '../object-model/validation.js';
import {signedPayload} from '../../../runtime/client-package/packages.js';
export function buildClientPackage(sources,options){
 check(options?.target==='client','DEFINITION.TARGET','Explicit CLIENT target required');
 const result=compileFamily(sources,options),m=result.manifest;
 const payload={schema:'wydgit.prototype-package/0.1',id:m.id,publisher:m.publisher,version:m.version,prototypes:result.definitions};
 const packageText=JSON.stringify(payload,null,2)+'\n';
 check(Buffer.byteLength(packageText)<=262144,'PACKAGE.LIMIT','Browser package exceeds loader bound');
 const registry={schema:'wydgit.registry/0.1',protocol:'0.1',prototypes:result.definitions,entry:clean(options.entry)};
 return freeze({...result,payload,packageText,registry,registryText:JSON.stringify(registry,null,2)+'\n',integrity:'sha256-'+createHash('sha256').update(packageText).digest('base64'),clientVersion:'0.1.0-alpha.11'});
}
export function signClientPackage(result,{privateKey,keyId,url}){
 check(typeof keyId==='string'&&/^[A-Za-z0-9._-]{1,64}$/.test(keyId)&&typeof url==='string','PACKAGE.SIGNATURE','Invalid signing configuration');
 const key=typeof privateKey==='object'&&privateKey.type==='private'?privateKey:createPrivateKey(privateKey);
 check(key.asymmetricKeyType==='ed25519','PACKAGE.SIGNATURE','Only Ed25519 publisher keys are supported');
 const ref={id:result.payload.id,publisher:result.payload.publisher,version:result.payload.version,url,integrity:result.integrity,algorithm:'Ed25519',keyId};
 ref.signature=sign(null,signedPayload(ref),key).toString('base64');
 const publicKey=createPublicKey(key).export({format:'der',type:'spki'}).subarray(-32).toString('base64');
 return freeze({registry:{schema:'wydgit.registry/0.1',protocol:'0.1',prototypes:[],packages:[ref],entry:result.registry.entry},key:{publisher:ref.publisher,keyId,publicKey,status:'active'}});
}
