// Exercise the existing deterministic adversaries through active Spike L hooks.
import {installNativeSchedulingHooks} from './native-scheduling-hooks.mjs';
import {createNativeScheduling,startPromiseObservation} from './native-scheduling.js';
installNativeSchedulingHooks({costs:true});
const capture=createNativeScheduling({request:1,costs:true,maxRows:512}),stop=startPromiseObservation();
try{await capture.run(()=>import('./post-commit-scenarios.mjs'));}finally{stop();capture.finish();}
