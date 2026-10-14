addEventListener('DOMContentLoaded', async () => {
  try {
    const ready = await WydClient.ready(); if (!ready.ok) throw Error('bootstrap');
    const h = WydClient.host();
    const construct = (adapter, text) => adapter.construct({type:'wydgit.core/block',properties:{content:{type:'markdown',value:text}}});
    const section = h.construct({type:'wydgit.core/section'});
    h.Insert(section,'blocks',0,construct(h,'First'));
    h.Insert(section,'blocks',1,construct(h,'Second'));
    const placed = h.Insert('SUB.Page.default',undefined,0,section);
    const [first,second] = h.children(placed,'blocks'); h.Move(second,0,first); h.Remove(first);
    if (h.children(placed,'blocks').length !== 1) throw Error('order');
    const roots = [...document.querySelectorAll('[data-demo-root]')];
    if (roots.length) {
      const handles=roots.map(root=>WydClient.mount({root})); await Promise.all(handles.map(x=>x.ready()));
      const adapters=handles.map(x=>x.host()); const refs=adapters.map((x,i)=>x.Insert('SUB.Page.Top',undefined,0,construct(x,'Root '+i)));
      if(adapters[0].snapshot(refs[0]).id===adapters[1].snapshot(refs[1]).id)throw Error('identity');
      let denied=false;try{adapters[1].Remove(refs[0]);}catch{denied=true;}if(!denied)throw Error('isolation');
      handles[0].unmount(); adapters[1].Set(refs[1],'content',{type:'markdown',value:'Surviving root'});
      if(handles[1].state!=='ready')throw Error('survival');
    }
    document.getElementById('h2-result').textContent='PASS';
  } catch { document.getElementById('h2-result').textContent='FAIL'; }
});
