import { createRuntime } from './runtime.js';
// Same-realm host JavaScript is trusted integration code, not a WydSUB sandbox.
if (!Object.hasOwn(globalThis, 'WydClient')) {
  const api = createRuntime(globalThis, globalThis.WydClientConfig ?? {});
  Object.defineProperty(globalThis, 'WydClient', { value: api, writable: false, configurable: false });
  void api.ready();
}
