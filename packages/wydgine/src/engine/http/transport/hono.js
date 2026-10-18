import {meteredOutput} from '../metered-output.js';
import {createHash} from 'node:crypto';
import { requestRoute } from '../routing.js';
import { Hono } from 'hono';
import { createAdaptorServer, getRequestListener } from '@hono/node-server';
import { RESPONSE_ALREADY_SENT } from '@hono/node-server/utils/response';
import { open, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';
import { errorDocument } from '../../index.js';

const policy = "default-src 'none'; style-src 'self'; img-src 'self'; media-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
// Explicit browser-safe dependency closure; no server/provider modules are exposed.
const clientModules = [
  'wydclient/uploads.js', 'wydclient/index.js', 'wydgine/events/runtime.js', 'wydgine/events/registry.js',
  'wydgine/object-model/class-contracts.js', 'wydgine/object-model/component-contracts.js', 'wydgine/object-model/interfaces.js', 'wydgine/object-model/members.js', 'wydgine/object-model/forms.js', 'wydgine/object-model/validation.js', 'wydgine/object-model/schema.js', 'wydgine/object-model/construction.js', 'wydgine/object-model/prototypes.js', 'wydgine/seam/context.js',
  'wydgine/execution/placement.js', 'wydgine/seam/capabilities.js', 'wydgine/http/input.js',
  'wydgine/sewn/schema.js', 'wydgine/sewn/validate.js',
  'wydgine/sewn/execute.js', 'wydgine/sewn/budget.js', 'wydgine/sewn/entry.js', 'wydgine/sewn/bindings.js', 'wydgine/sewn/numeric.js', 'wydgine/sewn/operations.js', 'wydgine/sewn/dates.js', 'wydgine/sewn/regex.js', 'wydgine/sewn/vendor/re2js.js', 'wydgine/sewn/types.js'
];

// Kernel-only output port. Neither Hono nor native response objects leave this adapter.
function outputPort(res, head, meter) {
  const output=meter?meteredOutput(res,head,meter):res;
  return {
    get statusCode() { return res.statusCode; }, set statusCode(value) { res.statusCode = value; },
    get headersSent() { return res.headersSent; }, get destroyed() { return res.destroyed; },
    setHeader(name, value) { res.setHeader(name, value); }, getHeader(name) { return res.getHeader(name); },
    end(body) { output.end(head ? undefined : body); }, write(chunk) { return output.write(chunk); },
    destroy() { output.destroy(); },
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
    const etag = `W/"${createHash('sha256').update(approved).digest('hex').slice(0,16)}-${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;
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

export function createTransport({ root, projectRoot, renderer, pipeline, logger, admit = () => () => {}, onStop = async()=>{}, governance }) {
  const host = new Hono();
  host.all('*', async c => {
    let release;
    const route=requestRoute(c.env.incoming);
    const request = c.req.raw, res = outputPort(c.env.outgoing, request.method === 'HEAD',governance);
    try{release=admit();}catch(error){res.statusCode=503;res.setHeader('Cache-Control','no-store');try{res.end(error.code==='HOST.QUOTA'?undefined:'Application unavailable');}catch(failure){if(failure.code!=='HOST.QUOTA')throw failure;}return RESPONSE_ALREADY_SENT;}
    if(governance){let recorded=false;const outcome=aborted=>{if(recorded)return;recorded=true;governance.httpOutcome(aborted||res.statusCode>=400,aborted);};c.env.outgoing.once('finish',()=>outcome(false));c.env.outgoing.once('close',()=>outcome(!c.env.outgoing.writableFinished));}
    try {
    res.setHeader('Content-Security-Policy', policy);
    res.setHeader('X-Content-Type-Options', 'nosniff');res.setHeader('Referrer-Policy',route?'same-origin':'no-referrer');
    try {
      const url = new URL(request.url), pathname = url.pathname;
      if(route?.parking&&!['GET','HEAD'].includes(request.method)){res.statusCode=405;res.setHeader('Allow','GET, HEAD');res.end('Method not allowed');return RESPONSE_ALREADY_SENT;}
      if (['GET', 'HEAD'].includes(request.method)) {
        if (pathname === '/css/skins.css') {
          res.setHeader('Content-Type', 'text/css; charset=utf-8'); res.setHeader('Cache-Control', 'no-cache');
          res.end(renderer.renderStyles()); return RESPONSE_ALREADY_SENT;
        }
        const module = pathname.slice('/runtime/'.length);
        if (pathname.startsWith('/runtime/') && clientModules.includes(module) && await asset(module.startsWith('wydgine/') ? path.resolve(projectRoot,'../src/engine') : projectRoot, module.startsWith('wydgine/') ? module.slice('wydgine/'.length) : module, 'text/javascript; charset=utf-8', res, request)) return RESPONSE_ALREADY_SENT;
        if (pathname.startsWith('/css/')) {
          const relative = decodeURIComponent(pathname.slice(5));
          const type = relative.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/octet-stream';
          if (await asset(path.join(root, 'public/css'), relative, type, res, request)) return RESPONSE_ALREADY_SENT;
        }
      }
      if(pathname.startsWith('/_transfer/')) {
        await pipeline.request({method:request.method,path:pathname,query:url.search.slice(1),transport:route,cookie:route?.parking?'':request.headers.get('cookie')??'',transfer:{body:request.body,headers:{type:request.headers.get('content-type')??'',fileSize:request.headers.get('x-wydgit-file-size'),encoding:request.headers.get('content-encoding')??'identity',accept:request.headers.get('accept')??'',range:request.headers.get('range'),ifNoneMatch:request.headers.get('if-none-match'),ifRange:request.headers.get('if-range')}}},res);
        return RESPONSE_ALREADY_SENT;
      }
      let form;
      try { form = await collectForm(request); }
      catch (error) { logger.error(error.message); res.statusCode = 500; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(errorDocument()); return RESPONSE_ALREADY_SENT; }
      await pipeline.request({ method: request.method, path: route?.parking?(route.state==='parked'?'/':'/'+route.state):pathname, query: route?.parking?'':url.search.slice(1), form, transport:route, cookie: route?.parking?'':request.headers.get('cookie') ?? '' }, res);
    } catch (error) {
      if(error.code==='HOST.QUOTA'||res.destroyed)return RESPONSE_ALREADY_SENT;
      logger.error(error.message);
      if (res.headersSent) res.destroy();
      else { res.statusCode = 500; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(errorDocument()); }
    }
    return RESPONSE_ALREADY_SENT;
    }finally{release(res.statusCode>=400||res.destroyed);}
  });
  const locals = { lifecycle: pipeline.lifecycle };
  let stopping;
  const stop = () => stopping ??= (async()=>{try{await pipeline.lifecycle.stop();}finally{await onStop();}})();
  return {
    locals,ready:pipeline.ready,stop,
    handle:getRequestListener(host.fetch,{overrideGlobalObjects:false}),
    listen(...args) {
      const server = createAdaptorServer({ fetch: host.fetch, overrideGlobalObjects: false,serverOptions:{maxHeaderSize:pipeline.httpPolicy.headerBytes} });
      server.requestTimeout=pipeline.httpPolicy.requestMs;server.headersTimeout=Math.min(15000,pipeline.httpPolicy.requestMs);server.maxHeadersCount=pipeline.httpPolicy.headerCount;
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
