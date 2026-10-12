import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { coreDefinitions } from './src/registry.js';
const root = fileURLToPath(new URL('./', import.meta.url));
const pkg = JSON.parse(await readFile(root + 'package.json', 'utf8'));
await mkdir(root + 'dist', { recursive: true });
for (const minify of [false, true]) {
  const outfile = `${root}dist/wydgit-client-${pkg.version}${minify ? '.min' : ''}.js`;
  await build({ entryPoints: [root + 'src/browser.js'], outfile, bundle: true, format: 'iife', platform: 'browser', target: 'es2022', minify, legalComments: 'none', banner: { js: `/* WydClient ${pkg.version}; WydSUB ${pkg.wydsub}; MPL-2.0 */` },
    plugins: [{ name: 'public-client-core', setup(builder) {
      // Do not ship repository sample behaviors or unused server definitions.
      builder.onLoad({ filter: /prototypes[/\\]objects\.json$/ }, () => ({ contents: JSON.stringify(coreDefinitions), loader: 'json' }));
    } }] });
}
const bytes = await readFile(`${root}dist/wydgit-client-${pkg.version}.min.js`);
const sizes = { version: pkg.version, protocol: pkg.wydsub, minified: bytes.length, gzip: gzipSync(bytes).length, brotli: brotliCompressSync(bytes).length };
await writeFile(root + 'dist/sizes.json', JSON.stringify(sizes, null, 2) + '\n');
console.log(JSON.stringify(sizes));
