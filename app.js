import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRenderer, errorDocument } from './wydgine/index.js';
import { initializeHost } from './wydgine/host.js';

export const projectRoot = path.dirname(fileURLToPath(import.meta.url));
export function createApp({ root = projectRoot, logger = console } = {}) {
  const app = express();
  const renderer = createRenderer({ root });
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.get('/css/skins.css', (_req, res) => {
    res.type('css').set('Cache-Control', 'no-cache').send(renderer.renderStyles());
  });
  app.use('/css', express.static(path.join(root, 'public/css')));
  app.use((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).set('Allow', 'GET, HEAD').send('Method not allowed');
    const result = renderer.renderPage(req.path);
    for (const message of result.diagnostics) logger.error(`[Wydgine] ${message}`);
    res.status(result.status).type('html').send(result.html);
  });
  app.use((error, _req, res, _next) => {
    logger.error(error.message);
    res.status(500).type('html').send(errorDocument());
  });
  return app;
}

// Application startup goes through host validation. createApp remains the pure
// web-adapter factory used by rendering/HTTP tests, not a library bootstrap API.
export async function createHostApp(options = {}) {
  const libraries = await initializeHost({ root: options.root ?? projectRoot });
  const app = createApp(options);
  app.locals.libraries = libraries; // Trusted host access only; never serialized.
  return app;
}
