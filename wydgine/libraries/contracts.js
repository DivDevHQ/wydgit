import semver from 'semver';
import { isBuiltin } from 'node:module';
import { clean, freeze, record, WydgitError } from '../object-model/validation.js';
import { isCapability } from '../seam/capabilities.js';

export function ensure(ok, code, message) { if (!ok) throw new WydgitError(code, message); }
export const identity = value => typeof value === 'string' && /^[a-z][a-z0-9-]*$/.test(value);
export const version = value => typeof value === 'string' && /^[0-9]/.test(value) && value === value.trim() && semver.valid(value) !== null;
export const range = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 512 && semver.validRange(value) !== null;
export const satisfies = (value, constraint) => semver.satisfies(value, constraint);
const publisher = value => typeof value === 'string' && /^[a-z][a-z0-9.-]*$/.test(value);
const packageName = value => typeof value === 'string' && value.length <= 214 && /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value) && !isBuiltin(value);
export function fields(value, keys, code) {
  ensure(record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), code, 'Unexpected or missing fields');
}
export function data(input, code) {
  try { return clean(typeof input === 'string' ? JSON.parse(input) : input); }
  catch { throw new WydgitError(code, 'Expected safe JSON data'); }
}
const unique = (items, key, code) => {
  const ids = items.map(key);
  ensure(new Set(ids).size === ids.length, code, 'Duplicate identity');
};
export function validateConfig(input) {
  const code = 'LIBRARY.INVALID_CONFIG', config = data(input, code);
  fields(config, ['schema', 'libraries'], code);
  ensure(config.schema === 'wydgit.host/0.1' && Array.isArray(config.libraries), code, 'Unsupported host config');
  for (const entry of config.libraries) {
    fields(entry, ['id','package','enabled','version','publisher','trust'], code);
    ensure(identity(entry.id) && packageName(entry.package) && typeof entry.enabled === 'boolean' && range(entry.version) && publisher(entry.publisher), code, 'Invalid library mapping');
    ensure(['canonical','approved'].includes(entry.trust), 'LIBRARY.UNTRUSTED', 'Host must explicitly approve a runtime library trust class');
    ensure(entry.trust !== 'canonical' || entry.publisher === 'wydgit.core', 'LIBRARY.UNTRUSTED', 'Canonical libraries require the official publisher');
  }
  unique(config.libraries, x => x.id, 'LIBRARY.DUPLICATE');
  config.libraries.sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return freeze(config);
}
export function validateManifest(input) {
  const code = 'LIBRARY.INVALID_MANIFEST', manifest = data(input, code);
  fields(manifest, ['schema','id','version','publisher','trust','platform','targets','capabilities','services'], code);
  ensure(manifest.schema === 'wydgit.library/0.1' && identity(manifest.id) && publisher(manifest.publisher) && version(manifest.version) && range(manifest.platform), code, 'Invalid library identity or compatibility metadata');
  ensure(['canonical','approved'].includes(manifest.trust), 'LIBRARY.UNTRUSTED', 'Ordinary packages are not runtime libraries');
  ensure(manifest.trust !== 'canonical' || manifest.publisher === 'wydgit.core', 'LIBRARY.UNTRUSTED', 'Canonical libraries require the official publisher');
  ensure(Array.isArray(manifest.targets) && manifest.targets.length > 0 && manifest.targets.every(x => ['client','server'].includes(x)), code, 'Invalid runtime targets');
  ensure(Array.isArray(manifest.capabilities) && manifest.capabilities.every(isCapability), code, 'Invalid capabilities');
  ensure(Array.isArray(manifest.services), code, 'Invalid services');
  unique(manifest.targets, x => x, code); unique(manifest.capabilities, x => x, code);
  for (const service of manifest.services) {
    fields(service, ['name','capability'], code);
    ensure(identity(service.name) && manifest.capabilities.includes(service.capability), code, 'Service must use a declared capability');
  }
  unique(manifest.services, x => x.name, code);
  ensure(manifest.capabilities.every(c => manifest.services.some(s => s.capability === c)), code, 'Each provided capability needs a declared service');
  return freeze(manifest);
}
export function validateRequirements(input) {
  const code = 'LIBRARY.INVALID_REQUIREMENTS', requirements = data(input, code);
  fields(requirements, ['schema','libraries'], code);
  ensure(requirements.schema === 'wydgit.requirements/0.1' && Array.isArray(requirements.libraries), code, 'Unsupported requirements document');
  for (const entry of requirements.libraries) {
    fields(entry, ['library','version'], code);
    ensure(identity(entry.library) && range(entry.version), code, 'Invalid portable library requirement');
  }
  unique(requirements.libraries, x => x.library, 'LIBRARY.DUPLICATE');
  requirements.libraries.sort((a,b) => a.library < b.library ? -1 : a.library > b.library ? 1 : 0);
  return freeze(requirements);
}
