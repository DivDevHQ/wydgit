import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
// Upstream reproducer: https://github.com/sindresorhus/file-type/commit/319abf8
// A separate unprivileged process supplies a real external deadline if parsing hangs.
test('patched runtime parser terminates on the advisory zero-sized ASF subheader',()=>{
 const result=spawnSync(process.execPath,['--input-type=module','-e',`import {fileTypeFromBuffer} from 'file-type';const b=Buffer.from('3026b2758e66cf11a6d9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000','hex');console.log(JSON.stringify((await fileTypeFromBuffer(b))??null));`],{encoding:'utf8',timeout:2000});
 assert.equal(result.status,0,result.stderr||result.error?.message);assert.equal(JSON.parse(result.stdout),null);
});
