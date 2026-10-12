import { check, LIMITS } from './data.js';
// Trusted browser adapter only. Never used as a portable execution handle.
export async function download(href, host, policy) {
  let url;
  try { url = new URL(href, host.location.href); }
  catch { check(false, 'NETWORK.URL', 'Invalid manifest URL'); }
  check(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.hash,
    'NETWORK.ORIGIN', 'Manifest origin denied');
  check(url.origin === host.location.origin || policy.allowedOrigins.includes(url.origin), 'NETWORK.ORIGIN', 'Manifest origin denied');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIMITS.timeout);
  let reader;
  try {
    const response = await host.fetch(url.href, { credentials: 'omit', redirect: 'error', mode: 'cors', signal: controller.signal });
    check(response.ok && !response.redirected && response.url === url.href, 'NETWORK.RESPONSE', 'Manifest request failed');
    check(/^application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|$)/i.test(response.headers.get('content-type') ?? ''), 'NETWORK.TYPE', 'Expected JSON response');
    const length = response.headers.get('content-length');
    check(length === null || /^\d+$/.test(length) && Number(length) <= LIMITS.bytes, 'MANIFEST.LIMIT', 'Manifest limit exceeded');
    check(response.body?.getReader, 'NETWORK.RESPONSE', 'Manifest request failed');
    reader = response.body.getReader();
    let size = 0; const chunks = [];
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      check(size <= LIMITS.bytes, 'MANIFEST.LIMIT', 'Manifest limit exceeded');
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } catch (error) {
    if (error.code === 'MANIFEST.LIMIT' || error.code?.startsWith('NETWORK.')) throw error;
    check(false, 'NETWORK.FAILED', 'Manifest request failed');
  } finally {
    clearTimeout(timer);
    if (reader) { try { await reader.cancel(); } catch { /* already aborted */ } }
  }
}
