import { requireThat as check, WydgitError } from '../object-model/validation.js';
import { reservedCookie } from './input.js';
import { openResource } from './files.js';
import { renderMarkdown } from '../index.js';
const protectedHeader=/^(?:connection|content-length|transfer-encoding|set-cookie|content-type|location|upgrade|trailer|te|keep-alive|proxy-.*|content-security-policy.*|x-.*|strict-transport-security|permissions-policy|referrer-policy|cross-origin-.*)$/;
export function createResponse(context) {
  let state='Open',status=200,mode='tree',body=null,file=null,cleanup=false;const headers=new Map(),cookies=new Map();
  const open=guard=>{guard();check(!cleanup&&state==='Open','RESPONSE.STATE','Response is not open');};
  const headerName=name=>{check(typeof name==='string'&&/^[A-Za-z0-9-]{1,64}$/.test(name),'RESPONSE.INVALID','Invalid header');return name.toLowerCase();};
  const cookie=(name,value,options,remove,guard)=>{
    open(guard);context.require('response.cookies.write');check(typeof name==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(name)&&!reservedCookie(name)&&!['constructor','prototype','__proto__'].includes(name),'RESPONSE.DENIED','Cookie denied');
    const grant=context.scopes.cookies?.find(x=>x.name===name);check(grant&&grant.path==='/'&&!grant.domain,'RESPONSE.DENIED','Cookie scope denied');
    check(options&&typeof options==='object'&&Object.keys(options).every(k=>['Secure','HttpOnly','SameSite','MaxAge'].includes(k)),'RESPONSE.INVALID','Invalid options');
    const secure=options.Secure??true,httpOnly=options.HttpOnly??true,sameSite=options.SameSite??'Lax';
    check(secure===true&&httpOnly===true&&['Lax','Strict'].includes(sameSite)&&(!Object.hasOwn(options,'MaxAge')||Number.isInteger(options.MaxAge)&&options.MaxAge>=0&&options.MaxAge<=31536000),'RESPONSE.INVALID','Cookie security policy');
    check(typeof value==='string'&&value.isWellFormed()&&value.length<=2048&&!/[\x00-\x1f\x7f]/.test(value)&&cookies.size<16,'RESPONSE.INVALID','Invalid cookie');
    const serialized=`${name}=${encodeURIComponent(value)}; Path=/; Secure; HttpOnly; SameSite=${sameSite}${remove?'; Max-Age=0':options.MaxAge===undefined?'':`; Max-Age=${options.MaxAge}`}`;cookies.set(name,serialized);
  };
  return Object.freeze({
    get state(){return state;},get explicit(){return mode!=='tree';},
    facade(guard=()=>{}){return Object.freeze({
      get Status(){guard();return status;},set Status(value){open(guard);context.require('response.status.write');check([200,201,202,400,403,404,409,422,500].includes(value),'RESPONSE.INVALID','Unsupported status');status=value;},
      Headers:Object.freeze({Set(name,value){open(guard);context.require('response.headers.write');name=headerName(name);check(!protectedHeader.test(name)&&['cache-control','content-language','vary'].includes(name)&&context.scopes.headers?.includes(name),'RESPONSE.DENIED','Header denied');check(typeof value==='string'&&value.length<=1024&&!/[^\x20-\x7e\t]/.test(value)&&headers.size<16,'RESPONSE.INVALID','Invalid header value');headers.set(name,value);},Remove(name){open(guard);context.require('response.headers.write');name=headerName(name);check(!protectedHeader.test(name)&&['cache-control','content-language','vary'].includes(name)&&context.scopes.headers?.includes(name),'RESPONSE.DENIED','Header denied');headers.delete(name);}}),
      Cookies:Object.freeze({Set(name,value,options={}){cookie(name,value,options,false,guard);},Delete(name){cookie(name,'',{},true,guard);}}),
      async WriteMarkdown(text){open(guard);context.require('response.markdown.write');check(typeof text==='string'&&text.length<=65536,'RESPONSE.LIMIT','Markdown limit');const rendered=renderMarkdown(text);check(rendered.length<=262144,'RESPONSE.LIMIT','Output limit');open(guard);body=rendered;mode='markdown';state='Committed';},
      async SendFile(handle,options={}){
        open(guard);context.require('response.files.send');check(options&&typeof options==='object'&&Object.keys(options).every(k=>['Disposition','Filename'].includes(k)),'RESPONSE.INVALID','Invalid file options');
        // Attachments only: no active same-origin file execution.
        check(options.Disposition===undefined||options.Disposition==='attachment','RESPONSE.DENIED','Inline files denied');const name=options.Filename??'download';
        check(typeof name==='string'&&/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,127}$/.test(name)&&!name.includes('..'),'RESPONSE.INVALID','Invalid display filename');
        const resource=await openResource(handle,context);
        try{open(guard);file=resource;headers.set('content-disposition',`attachment; filename="${name}"`);mode='file';state='Committed';}catch(error){await resource.file.close();throw error;}
      }
    });},
    beginCleanup(){cleanup=true;},
    tree(html,code=200){check(state==='Open','RESPONSE.STATE','Already committed');check(typeof html==='string'&&html.length<=2*1024*1024,'RESPONSE.LIMIT','Output limit');body=html;status=code;state='Committed';},
    async send(res,head=false){
      check(state==='Committed','RESPONSE.STATE','No output');
      try {
        res.statusCode=status;for(const [name,value] of headers)res.setHeader(name,value);if(cookies.size)res.setHeader('Set-Cookie',[...[res.getHeader('Set-Cookie')??[]].flat(),...cookies.values()]);
        res.setHeader('Content-Type',mode==='file'?file.type:'text/html; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');
        if(head){res.end();return;}
        if(mode==='file') {
          // Bounded trusted chunks, no binary values enter handler contexts.
          let sent=0;for await(const chunk of file.file.createReadStream({autoClose:false,highWaterMark:65536})) {
            sent+=chunk.length;check(sent<=file.size&&sent<=16*1024*1024,'FILE.LIMIT','Stream limit');
            if(res.destroyed)throw new Error('Disconnected');
            if(!res.write(chunk))await new Promise((resolve,reject)=>{const clean=()=>{res.off('drain',done);res.off('close',closed);res.off('error',closed);};const done=()=>{clean();resolve();};const closed=()=>{clean();reject(new Error('Disconnected'));};res.once('drain',done);res.once('close',closed);res.once('error',closed);});
          }res.end();
        } else res.end(body);
      }catch{res.destroy();throw new WydgitError('RESPONSE.IO','Response transport failed');}
      finally{state='Complete';await file?.file.close();file=null;}
    },async close(){state='Complete';await file?.file.close();file=null;}
  });
}
