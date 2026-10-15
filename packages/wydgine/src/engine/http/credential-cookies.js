// Host-owned, host-only credentials. Prefix requirements also apply to deletion.
export function credentialCookies(secure=true){
 const prefix=secure?'__Host-wydgit-':'wydgit-';
 return Object.freeze({auth:prefix+'auth',session:prefix+'session',serialize(name,value,maxAge){return `${prefix}${name}=${value}; Path=/;${secure?' Secure;':''} HttpOnly; SameSite=Lax${maxAge===undefined?'':'; Max-Age='+maxAge}`;}});
}
