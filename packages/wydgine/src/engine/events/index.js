import {compile as compileWydBasic,compileModule} from '../wydbasic/index.js';
import {validate as validateWorkflow} from '../sewn/validate.js';
import {requireThat as check} from '../object-model/validation.js';
import {handler,createDispatcher as dispatchRuntime} from './runtime.js';
import {EventRegistry} from './registry.js';
export {handler,fail,safeError} from './runtime.js';
export {EventRegistry} from './registry.js';
export function prepareHandler(record) {
  check(record.wydBasicModule===undefined,'EVENT.INVALID','Modules require registration preparation');
  check(['run','workflow','wydBasic'].filter(key=>record[key]!==undefined).length===1,'EVENT.INVALID','Choose one handler implementation');
  if(record.wydBasic!==undefined) {
    const {wydBasic,...rest}=record;
    return {...rest,workflow:compileWydBasic(wydBasic)};
  }
  return record.workflow!==undefined?{...record,workflow:validateWorkflow(record.workflow)}:{...record,run:handler(record.run)};
}
// Expand modules once at setup. The resulting records use only the existing workflow path.
export function prepareHandlers(records,registry=new EventRegistry()) {
  return records.flatMap(record=>{
    if(record.wydBasicModule===undefined)return [prepareHandler(record)];
    check(['run','workflow','wydBasic','wydBasicModule'].filter(key=>record[key]!==undefined).length===1,'EVENT.INVALID','Choose one handler implementation');
    check(typeof record.owner==='string'&&record.type===undefined,'EVENT.INVALID','A module declares its own event types and requires an owner');
    const {wydBasicModule,...rest}=record;
    return compileModule(wydBasicModule,{registry}).events.map(event=>({...rest,...event}));
  });
}
export function prepareAction(record,registry=new EventRegistry()) {
  if(record.wydBasicModule===undefined)return prepareHandler(record);
  check(['run','workflow','wydBasic','wydBasicModule'].filter(key=>record[key]!==undefined).length===1,'EVENT.INVALID','Choose one action implementation');
  check(record.owner===undefined||record.owner===record.target,'EVENT.INVALID','Action owner must be the routed target');
  const {wydBasicModule,...rest}=record,events=compileModule(wydBasicModule,{registry}).events;
  check(events.length===1&&events[0].type===record.type,'EVENT.INVALID','Action modules must declare exactly the routed event');
  return {...rest,workflow:events[0].workflow};
}
export function createDispatcher(options) {
  const registry=options.registry??new EventRegistry();
  return dispatchRuntime({...options,registry,handlers:prepareHandlers(options.handlers??[],registry)});
}
