import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
const definition=JSON.parse(await readFile(new URL('../../../test/fixtures/wydclient/controls.json',import.meta.url))),version=JSON.parse(await readFile(new URL('../package.json',import.meta.url))).version;
test('independent canonical controls execute in both current artifacts while immutable alpha.6 rejects the new presentation contract',async t=>{
 for(const artifact of ['0.1.0-alpha.6',version])for(const suffix of ['', '.min']){
  const w=new Window({url:'https://example.test/'});t.after(()=>w.happyDOM.close());Object.defineProperty(w.document,'readyState',{value:'complete'});
  w.eval('globalThis.WydClientConfig='+JSON.stringify({verifiedPrototypes:{[definition.id]:'independent'},execution:{publisher:'independent',installation:'reviewed-fixture',actions:['accept'],capabilities:['object.instances.edit'],visible:['panel'],editable:['panel']}}));
  const s=w.document.createElement('script');s.type='application/json';s.id='wydgit-manifest';s.textContent=JSON.stringify({schema:'wydgit.registry/0.1',prototypes:[definition],entry:{id:'panel',type:definition.id}});w.document.head.append(s);w.eval(await readFile(new URL('../dist/wydgit-client-'+artifact+suffix+'.js',import.meta.url),'utf8'));
  const result=await w.WydClient.ready();assert.equal(result.ok,artifact===version,JSON.stringify(result));if(!result.ok)continue;
  for(const [name,value] of [['Text','<script>literal</script>'],['Amount','1.25']]){const input=w.document.querySelector('[name='+name+']');input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}));}
  w.document.querySelector('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,20));
  const e=w.WydClient.execution(),state=e.snapshot(e.entry()).properties;assert.equal(state.Message,'<script>literal</script>');assert.equal(state.Amount,1.25);assert.equal(state.Accepted,1);assert.equal(w.document.querySelectorAll('[data-wydclient-object] script').length,0);
 }
});
