import { createTransport } from './wydgine/http/transport/hono.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRenderer } from './wydgine/index.js';
import { createPipeline } from './wydgine/http/pipeline.js';
import { createLifecycle } from './wydgine/execution/lifecycle.js';
import { loadRepository } from './wydgine/repository.js';
import { initializeHost } from './wydgine/host.js';

export const projectRoot = path.dirname(fileURLToPath(import.meta.url));
export function createApp({ root = projectRoot, logger = console, libraries, execution = {}, lifecycle, admit, guard, contextPolicy, onStop, parking, governance } = {}) {
  const renderer = createRenderer({ root, verifiedPackages:execution.verifiedPackages });
  const pipeline = createPipeline({ root, libraries, execution, lifecycle, guard, contextPolicy, parking, governance });
  const app = createTransport({ root, projectRoot, renderer, pipeline, logger, admit, onStop, governance });
  return app;
}

// Application startup goes through host validation. createApp owns HTTP/Page
// execution but does not bootstrap libraries; createHostApp validates those first.
export async function createHostApp(options = {}) {
  const root=options.root??projectRoot;
  let lifecycle,libraries,app;
  try {
    libraries=await initializeHost({root,app:options.appId,guard:options.guard,adapters:options.libraryAdapters,observe:options.governance? id=>options.governance.service(id):undefined,lifecycle:async(id,event)=>{if(id==='wydgate'&&lifecycle)await lifecycle.session(event);}});
    const appId=loadRepository(root,{verifiedPackages:options.execution?.verifiedPackages}).runtime.rootId;
    if(options.appId!==undefined&&options.appId!==appId)throw new Error('App binding mismatch');
    lifecycle=createLifecycle({app:appId,handlers:options.execution?.lifecycleHandlers,context:options.execution?.lifecycleContext,instances:options.execution?.lifecycleInstances});
    app=createApp({...options,libraries,lifecycle,onStop:()=>libraries.close()});
    await app.ready;
    if(options.strictStartup&&lifecycle.errors().length)throw new Error('App lifecycle startup failed');
    app.locals.libraries=libraries;
    return {...app,async stop(){try{await app.stop();}finally{await libraries.close();}},async shutdown(server){try{await app.shutdown(server);}finally{await libraries.close();}}};
  }catch(error){try{if(app)await app.stop();else await lifecycle?.stop();}catch{}try{await libraries?.close();}catch{}throw error;}
}
