// Historical sample defaults; execution delegates to the sole packaged engine.
import {fileURLToPath} from 'node:url';
import {createApp as engineApp,createHostApp as engineHostApp} from './packages/wydgine/src/app.js';
export const projectRoot=fileURLToPath(new URL('./',import.meta.url)).replace(/\/$/,'');
export function createApp(options={}){return engineApp({...options,root:options.root===undefined?projectRoot:options.root});}
export async function createHostApp(options={}){return engineHostApp({...options,root:options.root===undefined?projectRoot:options.root});}
