// Trusted source adapter for WydSearch. No binary reads or private-index access.
// dispatch(caller) must be the canonical caller-bound dispatcher. Both media and
// search grants remain necessary; this adapter cannot grant either capability.
export function mediaSearchSource({indexes,dispatch}) {
 const configurations=new Map(indexes.map(index=>[index.id,index]));
 return Object.freeze({
  async resolve(index,id,caller){
   const config=configurations.get(index);if(!config||config.app!==caller.app)return null;
   const result=await dispatch(caller).invoke('wydstream','1.0.0','get',{resource:config.resource,id});
   if(!result.ok||!['public','authenticated'].includes(result.value.visibility))return null;
   const item=result.value;
   return {app:item.app,resource:item.resource,publisher:item.publisher,package:item.package,principal:item.principal,published:item.state==='ready',allowed:true,visibility:item.visibility,revision:String(item.revision),title:item.title,body:item.description,summary:item.description,type:item.type,categories:item.tags,url:config.destination+'?media='+encodeURIComponent(item.id)};
  },
  async list(index,caller){
   const config=configurations.get(index);if(!config||config.app!==caller.app)return [];
   const result=await dispatch(caller).invoke('wydstream','1.0.0','list',{resource:config.resource,limit:20});
   return result.ok?result.value.items.filter(i=>['public','authenticated'].includes(i.visibility)).map(i=>i.id):[];
  }
 });
}
