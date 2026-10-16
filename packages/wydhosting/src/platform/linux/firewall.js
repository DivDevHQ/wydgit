// Read-only firewall candidate. Live mutation deliberately refuses until qualified.
import {check,integer,sealed,digest,shape} from '../../contracts.js';
import {isIP} from 'node:net';
export function planFirewall(input){
 shape(input,['manager','administration','publicPorts','recovery']);
 check(input.manager==='ufw'&&Array.isArray(input.administration)&&input.administration.length>0&&input.administration.length<=32&&Array.isArray(input.publicPorts)&&input.publicPorts.every(p=>[80,443].includes(p))&&new Set(input.publicPorts).size===input.publicPorts.length,'HOSTING.FIREWALL_POLICY');
 for(const rule of input.administration){shape(rule,['source','port']);check(isIP(rule.source)!==0&&integer(rule.port,1,65535),'HOSTING.FIREWALL_POLICY');}
 shape(input.recovery,['channel','independentlyVerified']);check(input.recovery.channel==='vm-console'&&input.recovery.independentlyVerified===true,'HOSTING.RECOVERY_REQUIRED');
 const body={schema:'wydhosting.firewall-plan/1',manager:input.manager,administration:input.administration,publicPorts:input.publicPorts,workerListeners:'unix-only',managedRulesOnly:true,flushUnrelatedRules:false,requires:['independent-rollback-timer','fresh-administrator-connection','external-ipv4-ipv6-denial','reboot-reconciliation'],state:'unqualified-preview'};
 return sealed({...body,digest:digest(body),applySupported:false});
}
export function applyFirewall(){throw Object.assign(new Error('Qualified firewall adapter unavailable'),{code:'HOSTING.FIREWALL_UNQUALIFIED'});}
