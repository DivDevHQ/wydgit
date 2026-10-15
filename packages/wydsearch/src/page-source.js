import { readFileSync,existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sanitizeHtml from 'sanitize-html';
import { decodeHTML } from 'entities';
import { loadRepository } from 'wydgine/trusted/services';
import { renderMarkdown,pagePath } from 'wydgine/trusted/services';
// Explicit, trusted host Page allowlist. Never enumerate configuration or private
// application state. Reload source and publication flags on every resolution.
export function pageSearchSource(root) {
 const configuration=path.join(root,'content/search.json');
 const host=JSON.parse(readFileSync(path.join(root,'wydgit.config.json'),'utf8'));
 const embedded=host.libraries?.find(l=>l.id==='wydsearch'&&l.enabled)?.options?.pageSource;
 if(!embedded&&!existsSync(configuration))return undefined;
 const config=embedded??JSON.parse(readFileSync(configuration,'utf8'));
 if(config.schema!=='wydgit.search-source/0.1'||!Array.isArray(config.indexes)||config.indexes.length>16)throw new Error('Invalid search source configuration');
 for(const index of config.indexes)if(typeof index.id!=='string'||!Array.isArray(index.pages)||index.pages.length>1024||!['publisher','package','principal'].every(k=>typeof index[k]==='string')||new Set(index.pages).size!==index.pages.length)throw new Error('Invalid search source policy');
 return Object.freeze({
  ...(embedded?{refresh:config.indexes.map(index=>({index:index.id,pages:[...index.pages],publisher:index.publisher,package:index.package,principal:index.principal}))}:{}),
  list(index){return [...(config.indexes.find(i=>i.id===index)?.pages??[])];},
  resolve(index,id){
   const policy=config.indexes.find(i=>i.id===index);if(!policy?.pages.includes(id))return null;
   const model=loadRepository(root),page=model.pages.get(id);
   if(!page)return {app:model.site.id,resource:id,publisher:policy.publisher,package:policy.package,principal:policy.principal,published:false,visibility:'public',revision:'deleted',title:'',body:'',url:'/',allowed:false};
   const parts=[];let nodes=0,bytes=0;
   const walk=node=>{if(++nodes>10000)throw new Error('Search source complexity');if(node.content?.type==='markdown'){if(Buffer.byteLength(node.content.value)>65536)throw new Error('Search source size');
    // Preserve block boundaries before stripping tags; decode sanitizer text once.
    const rendered=renderMarkdown(node.content.value).replace(/<\/(?:p|h[1-6]|blockquote|li|pre|tr|th|td|caption|dt|dd)>|<(?:br|hr)\s*\/?>/g,'$& ');
    const text=decodeHTML(sanitizeHtml(rendered,{allowedTags:[],allowedAttributes:{}}));bytes+=Buffer.byteLength(text)+(parts.length?1:0);if(bytes>65536)throw new Error('Search source size');parts.push(text);}for(const slot of ['sections','blocks','children'])for(const child of node[slot]??[])walk(child);};
   walk(page);const body=parts.join(' '),url=pagePath(page,model.site);
   const published=(embedded||page.searchable===true)&&page.published===true&&model.site.pages.includes(id);
   const revision=createHash('sha256').update(JSON.stringify([page.title,body,url,published])).digest('hex');
   return {app:model.site.id,resource:id,publisher:policy.publisher,package:policy.package,principal:policy.principal,published,visibility:'public',revision,title:page.title,body,summary:page.description,url,type:'page',categories:[],allowed:published};
  }
 });
}
