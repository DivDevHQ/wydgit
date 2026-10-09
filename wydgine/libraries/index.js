import { ExecutionContext } from '../seam/context.js';
import { bindServices, failure, isServiceFailure } from './dispatch.js';
import { ensure, version, satisfies, validateConfig, validateManifest, validateRequirements } from './contracts.js';
import { importNodePackage } from './node-package.js';
import { clean as validateLifecycle, freeze, WydgitError } from '../object-model/validation.js';
export { validateConfig, validateManifest, validateRequirements } from './contracts.js';
const emptyRequirements = () => ({ schema: 'wydgit.requirements/0.1', libraries: [] });

// The registry is published only after every enabled library and requirement
// succeeds. Package functions and registry mutation never cross into Wydgits.
export async function loadLibraries({ config: input, requirements: requested = emptyRequirements(), platformVersion, root, lifecycle = async () => {} }) {
  const config = validateConfig(input), requirements = validateRequirements(requested);
  ensure(version(platformVersion), 'LIBRARY.VERSION_MISMATCH', 'Invalid host platform version');
  ensure(typeof root === 'string' && root.length > 0, 'LIBRARY.INVALID_CONFIG', 'Host resolution root is required');
  const configured = new Map(config.libraries.map(entry => [entry.id, entry]));
  const requiredEnabled = requirements => {
    for (const requirement of requirements.libraries) {
      const entry = configured.get(requirement.library);
      ensure(entry, 'LIBRARY.UNKNOWN', 'Required library has no configured implementation');
      ensure(entry.enabled, 'LIBRARY.NOT_ENABLED', 'Required library is disabled');
    }
  };
  requiredEnabled(requirements);
  const staged = new Map(), capabilityOwners = new Map();
  for (const entry of config.libraries.filter(entry => entry.enabled)) {
    const { module, packageVersion } = await importNodePackage(entry, root);
    let manifest, register;
    try {
      // Never execute descriptor getters on a module's arbitrary exports.
      const descriptor = Object.getOwnPropertyDescriptor(module, 'manifest');
      const registration = Object.getOwnPropertyDescriptor(module, 'register');
      ensure(descriptor && Object.hasOwn(descriptor, 'value') && registration && typeof registration.value === 'function', 'LIBRARY.INVALID_MANIFEST', 'Expected manifest and register exports');
      manifest = validateManifest(descriptor.value); register = registration.value;
    } catch (error) {
      if (error instanceof WydgitError && ['LIBRARY.INVALID_MANIFEST','LIBRARY.UNTRUSTED'].includes(error.code)) throw error;
      throw new WydgitError('LIBRARY.INVALID_MANIFEST', 'Invalid library exports');
    }
    ensure(manifest.id === entry.id, 'LIBRARY.IDENTITY_MISMATCH', 'Configured identity differs from exported library identity');
    ensure(manifest.publisher === entry.publisher && manifest.trust === entry.trust, 'LIBRARY.UNTRUSTED', 'Library does not match host trust approval');
    ensure(manifest.version === packageVersion && satisfies(manifest.version, entry.version) && satisfies(platformVersion, manifest.platform), 'LIBRARY.VERSION_MISMATCH', 'Library or platform version is incompatible');
    ensure(manifest.targets.includes('server'), 'LIBRARY.TARGET_MISMATCH', 'Library does not support the server runtime');
    ensure(!staged.has(manifest.id), 'LIBRARY.DUPLICATE', 'Duplicate library identity');
    for (const capability of manifest.capabilities) ensure(!capabilityOwners.has(capability), 'LIBRARY.DUPLICATE', 'Capability already has a provider');
    staged.set(manifest.id, { manifest, register });
    manifest.capabilities.forEach(capability => capabilityOwners.set(capability, manifest.id));
  }
  const resolveRequirements = input => {
    const requirements = validateRequirements(input);
    requiredEnabled(requirements);
    const result = requirements.libraries.map(requirement => {
      const record = staged.get(requirement.library);
      ensure(record, 'LIBRARY.NOT_LOADED', 'Required library is not loaded');
      ensure(satisfies(record.manifest.version, requirement.version), 'LIBRARY.VERSION_MISMATCH', 'Required library version is incompatible');
      return record.manifest;
    });
    return Object.freeze(result);
  };
  // Requirement incompatibility cannot run registration code.
  resolveRequirements(requirements);
  // Resolve the complete dependency graph before running any registration.
  const order = [], visiting = new Set(), visited = new Set();
  const visit = id => {
    ensure(!visiting.has(id), 'LIBRARY.DEPENDENCY_CYCLE', 'Cyclic runtime library requirements');
    if (visited.has(id)) return;
    visiting.add(id);
    const requirements = staged.get(id).manifest.requirements ?? emptyRequirements();
    resolveRequirements(requirements).forEach(dependency => visit(dependency.id));
    visiting.delete(id); visited.add(id); order.push(id);
  };
  for (const id of staged.keys()) visit(id);
  const approved = new Map();
  for (const [id, {manifest}] of staged) {
    const required = (manifest.requirements ?? emptyRequirements()).libraries.map(item => item.library);
    const bindings = configured.get(id).bindings ?? [];
    ensure(bindings.length === required.length && bindings.every(binding => required.includes(binding.library)),
      'LIBRARY.DEPENDENCY_DENIED', 'Each dependency requires an explicit host binding');
    approved.set(id,new Map(bindings.map(binding => {
      const dependency = staged.get(binding.library).manifest;
      ensure(binding.capabilities.every(cap => dependency.capabilities.includes(cap)), 'LIBRARY.DEPENDENCY_DENIED', 'Binding capability is not provided by dependency');
      // The host grants a separate implementation identity. Libraries cannot
      // choose its publisher/package or modify the application caller's grants.
      return [binding.library,new ExecutionContext({publisher:manifest.publisher, package:`library:${id}`,
        self:`library-${id}`, app:binding.app, capabilities:binding.capabilities, scopes:binding.scopes})];
    })));
  }
  const services = new Map();
  for (const id of order) {
    const {manifest,register} = staged.get(id);
    const handlers = new Map();
    let active = true, invalid = false;
    const api = Object.freeze({ options: configured.get(id).options ?? Object.freeze({}), failure,
      async lifecycle(event) { return lifecycle(id, freeze(validateLifecycle(event))); },
      dependency(library) {
        ensure(approved.get(id).has(library), 'LIBRARY.DEPENDENCY_DENIED', 'Dependency binding is not approved');
        const context = approved.get(id).get(library);
        const dispatch = bindServices(context, (target,name) => services.get(target)?.get(name));
        return Object.freeze({identity:Object.freeze({app:context.app,publisher:context.publisher,library:id}),
          call(name,input) { return dispatch.call(library,name,input); }});
      }, service(name, handler, policy = {}) {
      const valid = active && manifest.services.some(s => s.name === name) && !handlers.has(name) && typeof handler === 'function' && policy && Object.keys(policy).every(key => key === 'authorize') && (policy.authorize === undefined || typeof policy.authorize === 'function');
      if (!valid) { invalid = true; throw new WydgitError('LIBRARY.REGISTRATION_FAILED', 'Invalid service registration'); }
      handlers.set(name, { handler, authorize: policy.authorize, capability: manifest.services.find(s => s.name === name).capability });
    } });
    try {
      await register(api);
      ensure(!invalid && handlers.size === manifest.services.length, 'LIBRARY.REGISTRATION_FAILED', 'Registration did not supply exactly the declared services');
    } catch (error) {
      if (isServiceFailure(error)) throw error;
      throw new WydgitError('LIBRARY.REGISTRATION_FAILED', 'Library service registration failed');
    } finally { active = false; }
    services.set(id, handlers);
  }
  return Object.freeze({
    bind(context) { return bindServices(context, (id, name) => services.get(id)?.get(name)); },
    list() { return Object.freeze([...staged.values()].map(record => record.manifest)); },
    get(id) { ensure(staged.has(id), 'LIBRARY.UNKNOWN', 'Unknown loaded library'); return staged.get(id).manifest; },
    capabilities() { return freeze([...capabilityOwners].sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([capability, library]) => ({ capability, library }))); },
    resolve: resolveRequirements,
    // Raw implementations are host-only. Pass bind(context), never this registry,
    // across an ordinary package boundary.
    service(id, name) {
      ensure(services.get(id)?.has(name), 'LIBRARY.UNKNOWN', 'Unknown library service');
      return services.get(id).get(name).handler;
    }
  });
}
