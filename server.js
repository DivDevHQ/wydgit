import { createHostApp } from './app.js';
import { WydgitError } from './wydgine/object-model/validation.js';
import platform from './package.json' with { type: 'json' };

try {
  // No HTTP listener exists until enabled libraries and requirements succeed.
  const app = await createHostApp();
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  const server = app.listen(port, host, () => console.log(`Wydgit ${platform.version}: http://${host}:${server.address().port}`));
  server.on('error', () => { console.error('HTTP startup failed'); process.exitCode = 1; });
  let stopping;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    stopping ??= app.shutdown(server).catch(() => { console.error('HTTP shutdown failed'); process.exitCode = 1; });
  });
} catch (error) {
  console.error(JSON.stringify(error instanceof WydgitError ? error.toJSON() : { ok: false, code: 'LIBRARY.INITIALIZATION_FAILED', message: 'Host initialization failed', details: {} }));
  process.exitCode = 1;
}
