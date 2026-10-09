import { requireThat as check } from './object-model/validation.js';
import { compilePrototype } from './wydbasic/index.js';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { hydrate, PrototypeRegistry } from './object-model/index.js';
import { readInstalledState } from './packages/state.js';
import { validatePackageManifest } from './packages/manifest.js';
import { webModel } from './web-model.js';

const read = file => JSON.parse(readFileSync(file, 'utf8'));

// Trusted project directory only. URL paths never become filesystem paths.
export function compileDefinitions(definitions) {
  return definitions.map(({behaviorSource,...definition})=>{check(behaviorSource===undefined||definition.behavior===undefined,'PROTOTYPE.METHOD','Choose source or canonical behavior');return {...definition,...(behaviorSource===undefined?{}:{behavior:compilePrototype(behaviorSource)})};});
}
export function loadRepository(root) {
  const prototypes = new Map();
  for (const name of ['site', 'navigation', 'page', 'section', 'block', 'skin']) {
    const definition = read(path.join(root, 'prototypes', `${name}.json`));
    if (definition.prototype !== name) throw new Error(`Invalid ${name} prototype definition`);
    prototypes.set(name, definition);
  }
  const app = read(path.join(root, 'content/app.json'));
  const navigation = read(path.join(root, 'content/navigation.json'));
  app.slots.pages = readdirSync(path.join(root, 'content/pages')).filter(f => f.endsWith('.json')).sort().map(file => read(path.join(root, 'content/pages', file)));
  app.slots.navigation = navigation;
  const installed=readInstalledState(root);
  const packages=installed?.packages??[];
  const definitions=read(path.join(root,'prototypes/objects.json'));
  for(const entry of packages){const manifest=validatePackageManifest(entry.manifest);check(entry.state==='installed','PACKAGE.CATALOG','Unsupported package state');definitions.push(...JSON.parse(entry.resources[manifest.resources.prototypes]));}
  const registry = new PrototypeRegistry(compileDefinitions(definitions));
  const runtime = hydrate(installed?JSON.parse(installed.app):app, registry);
  const diagnostics = [];
  const skins = new Map();
  const skinDirectory = path.join(root, 'content/skins');
  if (existsSync(skinDirectory)) for (const file of readdirSync(skinDirectory).filter(f => f.endsWith('.json'))) {
    const id = file.slice(0, -5);
    try {
      const skin = read(path.join(skinDirectory, file));
      if (skin.id !== id) throw new Error(`Skin id must match filename: ${file}`);
      skins.set(id, skin);
    } catch (error) {
      diagnostics.push(`${file}: ${error.message}`);
    }
  }
  return webModel(runtime, { prototypes, skins, diagnostics, registry, installed });
}
