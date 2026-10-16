// Explicit native build/install; no install hook, compiler invocation or fallback.
import {createRequire} from 'node:module';
import {protocolError} from './protocol.js';
export function loadPeerCredentials(filename) {
 if(process.platform!=='linux'||typeof filename!=='string'||!filename.startsWith('/'))throw protocolError('WORKER.PEER');
 const helper=createRequire(import.meta.url)(filename);
 return socket=>{
  // Node 24 native socket FD is a deliberately qualified implementation detail.
  const fd=socket?._handle?.fd;
  if(!Number.isInteger(fd)||fd<0)throw protocolError('WORKER.PEER');
  const peer=helper.credentials(fd);
  if(!Number.isSafeInteger(peer.pid)||peer.pid<=0||!Number.isSafeInteger(peer.uid)||peer.uid<0||!Number.isSafeInteger(peer.gid)||peer.gid<0)throw protocolError('WORKER.PEER');
  return Object.freeze(peer);
 };
}
