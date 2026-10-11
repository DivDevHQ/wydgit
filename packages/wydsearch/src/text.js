export const normalize=text=>text.normalize('NFKC').toLocaleLowerCase('und');
export const tokens=text=>normalize(text).match(/[\p{L}\p{N}]+/gu)??[];
export { safeDestination } from '../../../wydgine/http/destination.js';
export function rank(document,query) {
 const title=tokens(document.title),body=tokens(document.body),tags=tokens(document.categories.join(' '));
 if(!query.terms.every(term=>title.includes(term)||body.includes(term)||tags.includes(term)))return 0;
 const combined=normalize(`${document.title} ${document.body}`);
 if(!query.phrases.every(phrase=>combined.includes(phrase)))return 0;
 return query.terms.reduce((score,term)=>score+title.filter(x=>x===term).length*5+Math.min(body.filter(x=>x===term).length,10)+tags.filter(x=>x===term).length*2,0)+query.phrases.length*10;
}
export function snippet(document,query,maxBytes) {
 const text=document.summary||document.body,normalized=normalize(text);
 // Normalize first so Unicode expansion cannot invalidate match offsets.
 const at=query.terms.map(term=>normalized.indexOf(term)).filter(i=>i>=0).sort((a,b)=>a-b)[0]??0;
 const start=Math.max(0,at-40),characters=[...normalized.slice(start)];
 const ellipsis=maxBytes>=3?'…':'';
 let result=start?ellipsis:'';
 for(const character of characters){if(Buffer.byteLength(result+character+ellipsis)>maxBytes)break;result+=character;}
 if(result.length<normalized.slice(start).length&&Buffer.byteLength(result+ellipsis)<=maxBytes)result+=ellipsis;
 return result;
}
