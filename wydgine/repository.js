import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { hydrate, PrototypeRegistry } from './object-model/index.js';
import { webModel } from './web-model.js';

const read = file => JSON.parse(readFileSync(file, 'utf8'));

// Trusted project directory only. URL paths never become filesystem paths.
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
  const registry = new PrototypeRegistry(read(path.join(root, 'prototypes/objects.json')));
  const runtime = hydrate(app, registry);
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
  return webModel(runtime, { prototypes, skins, diagnostics, registry });
}
