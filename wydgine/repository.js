import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const read = file => JSON.parse(readFileSync(file, 'utf8'));

// Trusted project directory only. URL paths never become filesystem paths.
export function loadRepository(root) {
  const prototypes = new Map();
  for (const name of ['site', 'navigation', 'page', 'section', 'block', 'skin']) {
    const definition = read(path.join(root, 'prototypes', `${name}.json`));
    if (definition.prototype !== name) throw new Error(`Invalid ${name} prototype definition`);
    prototypes.set(name, definition);
  }
  const site = read(path.join(root, 'content/site.json'));
  const navigation = read(path.join(root, 'content/navigation.json'));
  const pages = new Map();
  const diagnostics = [];
  for (const file of readdirSync(path.join(root, 'content/pages')).filter(f => f.endsWith('.json'))) {
    const key = file.slice(0, -5);
    try {
      const page = read(path.join(root, 'content/pages', file));
      if (page.id !== key) throw new Error(`Page id must match filename: ${file}`);
      pages.set(key, page);
    } catch (error) {
      diagnostics.push(`${file}: ${error.message}`);
      // Retain the damaged page's conventional route so it returns 500, not 404.
      pages.set(key, { id: key, slug: key === site.home ? '' : key.replaceAll('--', '/'), loadError: true });
    }
  }
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
  return { prototypes, site, navigation, pages, skins, diagnostics };
}
