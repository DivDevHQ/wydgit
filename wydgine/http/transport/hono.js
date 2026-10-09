import { Hono } from 'hono';
import { createAdaptorServer } from '@hono/node-server';
import { RESPONSE_ALREADY_SENT } from '@hono/node-server/utils/response';
import { open, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';
import { errorDocument } from '../../index.js';

const policy = "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
// Explicit browser-safe dependency closure; no server/provider modules are exposed.
const clientModules = [
  'wydclient/index.js', 'wydgine/events/index.js', 'wydgine/events/registry.js',
  'wydgine/object-model/validation.js', 'wydgine/seam/context.js',
  'wydgine/seam/capabilities.js', 'wydgine/http/input.js',
  'wydgine/sewn/schema.js', 'wydgine/sewn/validate.js',
  'wydgine/sewn/execute.js', 'wydgine/sewn/bindings.js',
  'wydgine/wydbasic/index.js', 'wydgine/wydbasic/tokenize.js',
  'wydgine/wydbasic/parse.js', 'wydgine/wydbasic/compile.js', 'wydgine/wydbasic/errors.js'
];

// Kernel-only output port. Neither Hono nor native response objects leave this adapter.
function outputPort(res, head) {
  return {
    get statusCode() { return res.statusCode; }, set statusCode(value) { res.statusCode = value; },
    get headersSent() { return res.headersSent; }, get destroyed() { return res.destroyed; },
    setHeader(name, value) { res.setHeader(name, value); }, getHeader(name) { return res.getHeader(name); },
    end(body) { res.end(head ? undefined : body); }, write(chunk) { return res.write(chunk); },
    destroy() { res.destroy(); },
    once(event, handler) { res.once(event, handler); }, off(event, handler) { res.off(event, handler); }
  };
}

async function collectForm(request) {
  if (!/^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return '';
  const encoding = (request.headers.get('content-encoding') ?? 'identity').toLowerCase();
  const decompress = { gzip: createGunzip, deflate: createInflate, br: createBrotliDecompress };
  if (encoding !== 'identity' && !Object.hasOwn(decompress, encoding)) throw new Error('Unsupported encoding');
  const charset = /charset\s*=\s*([^;]+)/i.exec(request.headers.get('content-type'))?.[1].trim().replace(/^"|"$/g, '');
  const decoder = new TextDecoder(charset ?? 'utf-8', { fatal: true });
  if (!request.body) return '';
  const source = Readable.fromWeb(request.body);
  const body = encoding === 'identity' ? source : source.pipe(decompress[encoding]());
  // Source errors must also terminate the decoder, rather than hang the request.
  if (body !== source) source.on('error', error => body.destroy(error));
  let size = 0; const chunks = [];
  try {
    for await (const chunk of body) {
      size += chunk.byteLength;
      if (size > 32768) throw new Error('Body limit');
      chunks.push(chunk);
    }
    return decoder.decode(Buffer.concat(chunks));
  } finally { body.destroy(); if (body !== source) source.destroy(); }
}

// Approved roots only; reject dot segments, hidden files and symlink escapes.
async function asset(root, relative, type, res, request) {
  if (relative.split(/[\\/]/).some(part => !part || part.startsWith('.'))) return false;
  let file;
  try {
    const approved = await realpath(root), filename = path.resolve(approved, relative);
    if (!filename.startsWith(approved + path.sep) || await realpath(filename) !== filename) return false;
    file = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = await file.stat();
    if (!stat.isFile()) return false;
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=0');
    res.setHeader('Last-Modified', stat.mtime.toUTCString());
    res.setHeader('Accept-Ranges', 'bytes');
    const etag = `W/"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;
    res.setHeader('ETag', etag);
    if (request.headers.get('if-none-match')?.split(/\s*,\s*/).some(value => value === etag || value === '*') || (!request.headers.has('if-none-match') && Date.parse(request.headers.get('if-modified-since')) >= Math.floor(stat.mtimeMs / 1000) * 1000)) { res.statusCode = 304; res.end(); return true; }
    let start = 0, end = stat.size - 1;
    const range = request.headers.get('range');
    const ifRange = request.headers.get('if-range');
    if (range && (!ifRange || ifRange === etag || Date.parse(ifRange) >= Math.floor(stat.mtimeMs / 1000) * 1000)) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match && (match[1] || match[2])) {
        if (!match[1]) start = Math.max(0, stat.size - Number(match[2]));
        else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
        if (start > end || start >= stat.size) { res.statusCode = 416; res.setHeader('Content-Range', `bytes */${stat.size}`); res.end(); return true; }
        res.statusCode = 206; res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      }
    }
    res.setHeader('Content-Length', Math.max(0, end - start + 1));
    if (request.method === 'HEAD') { res.end(); return true; }
    for await (const chunk of file.createReadStream({ autoClose: false, start, ...(end >= 0 ? { end } : {}) })) {
      if (res.destroyed) throw new Error('Disconnected');
      if (!res.write(chunk)) await new Promise((resolve, reject) => {
        const clean = () => { res.off('drain', done); res.off('close', closed); res.off('error', closed); };
        const done = () => { clean(); resolve(); }, closed = () => { clean(); reject(new Error('Disconnected')); };
        res.once('drain', done); res.once('close', closed); res.once('error', closed);
      });
    }
    res.end(); return true;
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) return false;
    throw error;
  } finally { await file?.close(); }
}

export function createTransport({ root, projectRoot, renderer, pipeline, logger }) {
  const host = new Hono();
  host.all('*', async c => {
    const request = c.req.raw, res = outputPort(c.env.outgoing, request.method === 'HEAD');
    res.setHeader('Content-Security-Policy', policy);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const url = new URL(request.url), pathname = url.pathname;
      if (['GET', 'HEAD'].includes(request.method)) {
        if (pathname === '/css/skins.css') {
          res.setHeader('Content-Type', 'text/css; charset=utf-8'); res.setHeader('Cache-Control', 'no-cache');
          res.end(renderer.renderStyles()); return RESPONSE_ALREADY_SENT;
        }
        const module = pathname.slice('/runtime/'.length);
        if (pathname.startsWith('/runtime/') && clientModules.includes(module) && await asset(projectRoot, module, 'text/javascript; charset=utf-8', res, request)) return RESPONSE_ALREADY_SENT;
        if (pathname.startsWith('/css/')) {
          const relative = decodeURIComponent(pathname.slice(5));
          const type = relative.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/octet-stream';
          if (await asset(path.join(root, 'public/css'), relative, type, res, request)) return RESPONSE_ALREADY_SENT;
        }
      }
      let form;
      try { form = await collectForm(request); }
      catch (error) { logger.error(error.message); res.statusCode = 500; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(errorDocument()); return RESPONSE_ALREADY_SENT; }
      await pipeline.request({ method: request.method, path: pathname, query: url.search.slice(1), form, cookie: request.headers.get('cookie') ?? '' }, res);
    } catch (error) {
      logger.error(error.message);
      if (res.headersSent) res.destroy();
      else { res.statusCode = 500; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(errorDocument()); }
    }
    return RESPONSE_ALREADY_SENT;
  });
  const locals = { lifecycle: pipeline.lifecycle };
  let stopping;
  const stop = () => stopping ??= pipeline.lifecycle.stop();
  return {
    locals,
    listen(...args) {
      const server = createAdaptorServer({ fetch: host.fetch, overrideGlobalObjects: false });
      // Stop after in-flight HTTP requests finish, including direct host closes.
      server.once('close', () => { stop().catch(error => logger.error(error.message)); });
      server.once('error', () => { stop().catch(error => logger.error(error.message)); });
      try { return server.listen(...args); }
      catch (error) { stop().catch(failure => logger.error(failure.message)); throw error; }
    },
    async shutdown(server) {
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      await stop();
    }
  };
}
