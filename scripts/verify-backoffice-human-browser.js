// Developer simulation only. Never records human acceptance or Firefox keyboard
// qualification. Uses the production Page controls and genuine membership form.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {launch,cleanSession} from './backoffice-human.js';
import {localBrowser} from '../test-support/local-browser.js';
import {password} from './backoffice-human/cases.js';
const artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'wyd-b6h-browser-developer-')),sessionHome=path.join(artifacts,'environment'),callbacks=[];
let h,b;const findings={purpose:'developer-simulation',humanAcceptance:false,firefoxKeyboardQualified:false};
try{
 h=await launch({openBrowser:false,sessionHome,purpose:'developer-simulation'});
 b=await localBrowser({after:fn=>callbacks.push(fn)},artifacts,{firefox:process.argv.includes('--firefox')});
 findings.browser=b.version;
 await b.navigate(h.base+'/');await b.until("document.querySelectorAll('input[type=radio]').length===3");
 assert.equal(await b.evaluate("document.querySelectorAll('main').length"),1);
 await b.screenshot(path.join(artifacts,'guide-desktop.png'));
 await b.protocol('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:false});
 assert.ok(await b.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
 await b.screenshot(path.join(artifacts,'guide-mobile.png'));
 await b.click('input[value=fail]');await b.type('textarea','Developer simulation: recording deliberately failed attempt');await b.click('button[name=next][value=yes]');
 await b.until("document.body.textContent.includes('KEY-01')&&document.body.textContent.includes('Answer saved.')");
 const r=await(await fetch(h.base+'/export')).json();assert.equal(r.attempts[0].outcome,'fail');assert.equal(r.purpose,'developer-simulation');
 for(const provider of ['json','sqlite']){
  await b.navigate(h.urls[provider]+'/sign-in/');await b.type('#membership-login [name=username]','alice');await b.type('#membership-login [name=password]',password);await b.click('#membership-login button');await b.until("document.body.textContent.includes('Submission complete')");
  await b.navigate(h.urls[provider]+'/backoffice/pages/workspace');await b.until("document.querySelectorAll('#workspace-editor form').length===2");
  await b.click('#workspace-editor form:first-of-type button');await b.until("document.querySelector('#workspace-editor').textContent.includes('Action completed.')");
  assert.equal(await b.evaluate("document.querySelector('#workspace-editor [aria-label=title]').value"),'Workspace');
  findings[provider]={realMembershipLogin:true,productionControls:true,reviewedPageReachable:true};
 }
 findings.ok=true;
}finally{
 for(const fn of callbacks.reverse())await fn();await h?.stop();
 if(h)await cleanSession(path.dirname(h.metadata.evidence),{sessionHome});
 await fs.writeFile(path.join(artifacts,'developer-result.json'),JSON.stringify(findings,null,2));
 console.log(JSON.stringify({artifacts,...findings},null,2));
}
