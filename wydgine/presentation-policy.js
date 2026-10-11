import { clean,freeze,requireThat as check } from './object-model/validation.js';
export const PRESENTATION_DEFAULTS=Object.freeze({componentRequests:4});
export const PRESENTATION_MAX_REQUESTS=16;
export function presentationPolicy(input={}){
 const settings=clean(input);
 check(settings&&typeof settings==='object'&&!Array.isArray(settings)&&Object.keys(settings).every(k=>k==='componentRequests'),'LIBRARY.INVALID_CONFIG','Invalid runtime settings');
 const componentRequests=settings.componentRequests??PRESENTATION_DEFAULTS.componentRequests;
 check(!Object.hasOwn(settings,'componentRequests')||Number.isSafeInteger(settings.componentRequests),'LIBRARY.INVALID_CONFIG','Invalid presentation request budget');
 check(componentRequests>=0&&componentRequests<=PRESENTATION_MAX_REQUESTS,'LIBRARY.INVALID_CONFIG','Presentation request budget outside host policy');
 return freeze({componentRequests});
}
