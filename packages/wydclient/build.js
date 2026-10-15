import { verifyArtifacts, DIST } from './artifact-policy.js';
import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { coreDefinitions } from './src/registry.js';
const root = fileURLToPath(new URL('./', import.meta.url));
const pkg = JSON.parse(await readFile(root + 'package.json', 'utf8'));
const outputs = new Map();
for (const minify of [false, true]) {
  const path = `${DIST}/wydgit-client-${pkg.version}${minify ? '.min' : ''}.js`;
  const result = await build({ entryPoints: [root + 'src/browser.js'], write: false, bundle: true, format: 'iife', platform: 'browser', target: 'es2022', minify, legalComments: 'none', banner: { js: `/* WydClient ${pkg.version}; WydSUB ${pkg.wydsub}; MPL-2.0 */` },
    plugins: [{ name: 'public-client-core', setup(builder) {
      // H2 rejects component metadata before registry construction. Keep the
      // server component validator out of this public dependency closure; retain
      // an explicit rejection if a future caller reaches the shared registry.
      builder.onLoad({ filter: /object-model[/\\]component-contracts\.js$/ }, () => ({ contents: `import {requireThat as check} from './validation.js';
export function componentContract(d){check(d.component===undefined,'PROTOTYPE.COMPONENT','Executable component contracts require a later client runtime');}
export function validateComponent(d){componentContract(d);}`, loader: 'js' }));
      // Do not ship repository sample behaviors or unused server definitions.
      builder.onLoad({ filter: /prototypes[/\\]objects\.json$/ }, () => ({ contents: JSON.stringify(coreDefinitions), loader: 'json' }));
    } }] });
  outputs.set(path, result.outputFiles[0].contents);
}
const bytes = outputs.get(`${DIST}/wydgit-client-${pkg.version}.min.js`);
const sizes = { version: pkg.version, protocol: pkg.wydsub, readable: outputs.get(`${DIST}/wydgit-client-${pkg.version}.js`).length, minified: bytes.length, gzip: gzipSync(bytes).length, brotli: brotliCompressSync(bytes).length };
const report = JSON.stringify(sizes, null, 2) + '\n';
outputs.set(`${DIST}/sizes-${pkg.version}.json`, Buffer.from(report));
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
verifyArtifacts({ root: repositoryRoot, outputs });
// No writes until every protected artifact and candidate has passed comparison.
await mkdir(root + 'dist', { recursive: true });
for (const [path, bytes] of outputs) await writeFile(repositoryRoot + path, bytes);
await writeFile(root + 'dist/sizes.json', report);
console.log(JSON.stringify(sizes));
