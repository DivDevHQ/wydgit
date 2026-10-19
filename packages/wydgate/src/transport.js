import { fields, check } from './validation.js';
// Trusted canonical-library adapter. Portable packages never see the token or port.
export function gateTransport({gate,name,safe,withIdentity}) {
  return async(input,caller,port)=>safe(async()=>{
    fields(input,[]);check(port.method==='POST'&&port.authentication,'GATE.DENIED');
    check(port.headers.encoding==='identity'&&/^application\/x-www-form-urlencoded(?:;|$)/i.test(port.headers.type),'GATE.INVALID_USER');
    const reader=port.body?.getReader();check(reader,'GATE.INVALID_USER');let size=0;const chunks=[];
    let timedOut=false;const timer=setTimeout(()=>{timedOut=true;reader.cancel().catch(()=>{});},10000);
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;check(size<=4096,'GATE.LIMIT');chunks.push(value);}}
    finally{clearTimeout(timer);await reader.cancel().catch(()=>{});reader.releaseLock();}
    check(!timedOut,'GATE.LIMIT');const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)),request={};
    const decode=value=>{try{return decodeURIComponent(value.replace(/\+/g,' '));}catch{check(false,'GATE.INVALID_USER');}};
    for(const pair of text.split('&').filter(Boolean)){const at=pair.indexOf('='),key=decode(at<0?pair:pair.slice(0,at)),value=decode(at<0?'':pair.slice(at+1));check(!Object.hasOwn(request,key)&&['username','password','currentPassword','displayName','invitationToken'].includes(key),'GATE.INVALID_USER');request[key]=value;}
    let result;
    if(name==='browser-login'){
      fields(request,['username','password']);const previousToken=port.authentication.token;
      const login=await gate.execute('login',{...request,...(previousToken?{previousToken}:{})},caller);
      await port.authentication.establish(login.token);result={authenticated:true};
    }else if(name==='browser-register'){try{await gate.execute('register',request,caller);}catch(error){if(error.code!=='GATE.REGISTRATION_FAILED')throw error;}result={accepted:true};}
    else {
      const identity=await port.authentication.verify();const authenticated=withIdentity(caller,identity);
      if(name==='browser-logout'){fields(request,[]);await gate.execute('logout',{token:port.authentication.token},caller);await port.authentication.clear();result={revoked:true};}
      if(name==='browser-profile')result=await gate.execute('update-account',request,authenticated);
      if(name==='browser-password'){result=await gate.execute('change-own-password',request,authenticated);await port.authentication.clear();}
    }
    return {status:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify({ok:true,value:result})};
  });
}
