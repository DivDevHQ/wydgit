import test from 'node:test';
import assert from 'node:assert/strict';
import {readBackOfficeJson} from '../packages/wydgine/src/engine/http/json-body.js';

test('BOBODY-01: chunked collection bounds bytes and rejects malformed/invalid UTF-8 before execution',async()=>{
 const stream=chunks=>new ReadableStream({start(controller){for(const bytes of chunks)controller.enqueue(bytes);controller.close();}});
 const bytes=text=>new TextEncoder().encode(text);
 assert.deepEqual(await readBackOfficeJson(stream([bytes('{"a":'),bytes('1}')]),1000),{a:1});
 await assert.rejects(readBackOfficeJson(stream([bytes('x'.repeat(24000)),bytes('x'.repeat(24001))]),1000),{code:'HTTP.LIMIT'});
 await assert.rejects(readBackOfficeJson(stream([new Uint8Array([0xff])]),1000));
 await assert.rejects(readBackOfficeJson(stream([bytes('{')]),1000));
});
test('BOBODY-02: body collection deadline cancels a stalled stream',async()=>{
 let cancelled=false;const stream=new ReadableStream({cancel(){cancelled=true;}});
 await assert.rejects(readBackOfficeJson(stream,5),{code:'HTTP.LIMIT'});assert.equal(cancelled,true);
});
