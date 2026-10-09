import { createTransport } from './wydgine/http/transport/hono.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRenderer } from './wydgine/index.js';
import { createPipeline } from './wydgine/http/pipeline.js';
import { createLifecycle } from './wydgine/execution/lifecycle.js';
import { loadRepository } from './wydgine/repository.js';
import { initializeHost } from './wydgine/host.js';

export const projectRoot = path.dirname(fileURLToPath(import.meta.url));
export function createApp({ root = projectRoot, logger = console, libraries, execution = {}, lifecycle } = {}) {
  const renderer = createRenderer({ root });
  const pipeline = createPipeline({ root, libraries, execution, lifecycle });
  const app = createTransport({ root, projectRoot, renderer, pipeline, logger });
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
