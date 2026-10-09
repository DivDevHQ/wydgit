import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRenderer, errorDocument } from './wydgine/index.js';
import { createPipeline } from './wydgine/http/pipeline.js';
import { createLifecycle } from './wydgine/execution/lifecycle.js';
import { loadRepository } from './wydgine/repository.js';
import { initializeHost } from './wydgine/host.js';

export const projectRoot = path.dirname(fileURLToPath(import.meta.url));
export function createApp({ root = projectRoot, logger = console, libraries, execution = {}, lifecycle } = {}) {
  const app = express();
  const renderer = createRenderer({ root });
  const pipeline=createPipeline({root,libraries,execution,lifecycle});
  app.locals.lifecycle=pipeline.lifecycle;
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.get('/css/skins.css', (_req, res) => {
    res.type('css').set('Cache-Control', 'no-cache').send(renderer.renderStyles());
  });
  const clientModules=['wydclient/index.js','wydgine/events/index.js','wydgine/object-model/validation.js','wydgine/seam/context.js','wydgine/seam/capabilities.js','wydgine/http/input.js'];
  for(const module of clientModules)app.get(`/runtime/${module}`,(_req,res)=>res.type('js').sendFile(path.join(projectRoot,module)));
  app.use('/css', express.static(path.join(root, 'public/css')));
  app.use(express.text({type:'application/x-www-form-urlencoded',limit:'32kb'}));
  app.use((req,res)=>pipeline.request(req,res));
  app.use((error, _req, res, _next) => {
    logger.error(error.message);
    res.status(500).type('html').send(errorDocument());
  });
  return app;
}

// Application startup goes through host validation. createApp owns HTTP/Page
// execution but does not bootstrap libraries; createHostApp validates those first.
export async function createHostApp(options = {}) {
  const root=options.root??projectRoot;
  let lifecycle;
  const libraries = await initializeHost({ root, lifecycle:async(id,event)=>{if(id==='wydgate'&&lifecycle)await lifecycle.session(event);} });
  lifecycle=createLifecycle({app:loadRepository(root).runtime.rootId,handlers:options.execution?.lifecycleHandlers,context:options.execution?.lifecycleContext});
  const app = createApp({...options,libraries,lifecycle});
  app.locals.libraries = libraries; // Trusted host access only; never serialized.
  return app;
}
