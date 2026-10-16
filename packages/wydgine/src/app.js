import { createTransport } from './engine/http/transport/hono.js';
import { fileURLToPath } from 'node:url';
import { createRenderer } from './engine/index.js';
import { createPipeline } from './engine/http/pipeline.js';
import { createLifecycle } from './engine/execution/lifecycle.js';
import { loadRepository } from './engine/repository.js';
import { initializeHost } from './engine/host.js';

export function createApp({ root = process.cwd(), logger = console, libraries, execution = {}, lifecycle, admit, guard, contextPolicy, onStop, parking, governance } = {}) {
  const renderer = createRenderer({ root, verifiedPackages:execution.verifiedPackages });
  const pipeline = createPipeline({ root, libraries, execution, lifecycle, guard, contextPolicy, parking, governance });
  const app = createTransport({ root, projectRoot: fileURLToPath(new URL('../runtime/',import.meta.url)), renderer, pipeline, logger, admit, onStop, governance });
  return app;
}

// Application startup goes through host validation. createApp owns HTTP/Page
// execution but does not bootstrap libraries; createHostApp validates those first.
export async function createHostApp(options = {}) {
  const root=options.root===undefined?process.cwd():options.root;
  let lifecycle,libraries,app;
  try {
    libraries=await initializeHost({root,implementationRoot:options.implementationRoot,app:options.appId,guard:options.guard,adapters:options.libraryAdapters,observe:options.governance? id=>options.governance.service(id):undefined,lifecycle:async(id,event)=>{if(id==='wydgate'&&lifecycle)await lifecycle.session(event);}});
    const appId=loadRepository(root,{verifiedPackages:options.execution?.verifiedPackages}).runtime.rootId;
    if(options.appId!==undefined&&options.appId!==appId)throw new Error('App binding mismatch');
    lifecycle=createLifecycle({app:appId,handlers:options.execution?.lifecycleHandlers,context:options.execution?.lifecycleContext,instances:options.execution?.lifecycleInstances});
    app=createApp({...options,root,libraries,lifecycle,onStop:()=>libraries.close()});
    await app.ready;
    if(options.strictStartup&&lifecycle.errors().length)throw new Error('App lifecycle startup failed');
    app.locals.libraries=libraries;
    return {...app,async stop(){try{await app.stop();}finally{await libraries.close();}},async shutdown(server){try{await app.shutdown(server);}finally{await libraries.close();}}};
  }catch(error){try{if(app)await app.stop();else await lifecycle?.stop();}catch{}try{await libraries?.close();}catch{}throw error;}
}
