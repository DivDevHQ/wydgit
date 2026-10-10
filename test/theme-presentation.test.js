import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import { loadRepository } from '../wydgine/repository.js';
import { renderSite, escapeHtml } from '../wydgine/index.js';
import { renderSkinCss, resolveSkin } from '../wydgine/skins.js';
import { renderField } from '../wydgine/form-renderer.js';
import { dehydrate, hydrate } from '../wydgine/object-model/index.js';

test('theme mode defaults, forced modes, root contract and canonical enum',()=>{
 const model=loadRepository(process.cwd());
 delete model.site.themeMode;
 assert.equal(load(renderSite(model).html)('html').attr('data-wyd-theme'),'system');
 for(const mode of ['light','dark','system']){
  model.site.themeMode=mode;
  assert.equal(load(renderSite(model).html)('html').attr('data-wyd-theme'),mode);
 }
 model.site.themeMode='unsafe';assert.equal(renderSite(model).status,500);
 const raw=dehydrate(model.runtime);delete raw.properties.themeMode;
 assert.equal(hydrate(raw,model.registry).get(raw.id).properties.themeMode,'system');
 raw.properties.themeMode='sepia';assert.throws(()=>hydrate(raw,model.registry));
});
test('validated skin palettes preserve partial inheritance and old skin fallback',()=>{
 const model=loadRepository(process.cwd());
 model.skins.set('old',{id:'old',prototype:'skin',tokens:{accent:'#123456'}});
 model.skins.set('custom',{id:'custom',prototype:'skin',tokens:{primary:'#123456'},darkTokens:{primary:'#abcdef'}});
 const css=renderSkinCss(model),base=readFileSync('public/css/site.css','utf8');
 assert.match(css,/\[data-skin="old"\]\{--accent:#123456\}/);
 assert.deepEqual(resolveSkin('old',model).darkTokens,{});
 assert.match(css,/\[data-wyd-theme="dark"\] \[data-skin="custom"\]\{--primary:#abcdef\}/);
 assert.match(css,/@media \(prefers-color-scheme: dark\)/);
 for(const token of ['paper','surface','ink','muted','line','input-background','input-text','input-border','focus','primary','primary-text','error','success','disabled-background','disabled-text'])assert.ok(css.includes('--'+token+':'));
 assert.match(base,/@media \(prefers-color-scheme: dark\)/);
 assert.match(base,/\.wyd-form \{ display: flex; flex-direction: column/);
 model.site.skin='old';assert.equal(renderSite(model).status,200);
 model.skins.set('bad',{id:'bad',prototype:'skin',tokens:{primary:'unsafe'},darkTokens:{primary:'#fff'}});
 assert.throws(()=>resolveSkin('bad',model));assert.doesNotMatch(renderSkinCss(model),/data-skin="bad"/);
 model.skins.get('bad').tokens={};model.skins.get('bad').darkTokens={primary:'url(unsafe)'};assert.throws(()=>resolveSkin('bad',model));
});
test('all field projections retain labels, states and validation associations with semantic classes',()=>{
 for(const kind of ['text-input','password-input','text-area','select','checkbox','radio-group','checkbox-group']){
  const html=renderField({id:'example',name:'example',label:'Example',controlKind:kind,required:true,enabled:false,valid:false,validationMessage:'Please correct this value',placeholder:'Hint',value:kind==='checkbox'?true:kind==='checkbox-group'?['a']:'a',options:[{value:'a',label:'A',enabled:true}]},escapeHtml);
  const $=load(html);assert.equal($('.wyd-field').length,1);assert.equal($('.wyd-validation').attr('role'),'alert');
  assert.ok($('[aria-invalid="true"]').length);assert.equal($('[aria-invalid]').first().attr('aria-describedby'),$('.wyd-validation').attr('id'));
  assert.ok($(':disabled').length);
  for(const label of $('label').toArray())assert.equal($('#'+$(label).attr('for')).length,1);
  if(kind.endsWith('group')){assert.equal($('fieldset legend').text(),'Example');assert.ok($('.wyd-option').length);assert.ok($('input:checked').length);}
  else assert.ok($('.wyd-field-label').length);
  if(kind==='text-area')assert.equal($('.wyd-textarea').attr('placeholder'),'Hint');
  if(kind==='select')assert.equal($('.wyd-select option:selected').val(),'a');
  if(kind==='checkbox')assert.equal($('.wyd-checkbox:checked').length,1);
 }
});
