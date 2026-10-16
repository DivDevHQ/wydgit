// Bounded newline JSON transport for the broker-created inherited Unix stream.
import {EventEmitter} from 'node:events';
import {bounds,boundedJSON,protocolError} from './protocol.js';
export function createStreamPeer(socket) {
 const peer=new EventEmitter();let buffer=Buffer.alloc(0),closed=false;
 const close=()=>{if(closed)return;closed=true;socket.destroy();peer.emit('disconnect');};
 socket.on('data',chunk=>{
  try{
   // Inspect each frame before allocation/decoding. Native peers remain untrusted.
   let offset=0;
   while(offset<chunk.length){const end=chunk.indexOf(10,offset),stop=end<0?chunk.length:end;
    if(buffer.length+stop-offset>bounds.messageBytes)throw protocolError();
    buffer=Buffer.concat([buffer,chunk.subarray(offset,stop)]);offset=stop+(end>=0?1:0);
    if(end>=0){const text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);buffer=Buffer.alloc(0);const message=JSON.parse(text);if(boundedJSON(message)!==text)throw protocolError();peer.emit('message',message);if(closed)return;}
   }
  }catch{close();}
 });
 socket.on('error',close);socket.on('end',close);socket.on('close',close);
 peer.send=(message,callback)=>{try{if(closed)throw protocolError('WORKER.CLOSED');const text=boundedJSON(message)+'\n';if(socket.writableLength+Buffer.byteLength(text)>bounds.queueBytes)throw protocolError();return socket.write(text,callback);}catch(error){callback(error);close();return false;}};
 peer.disconnect=close;peer.socket=socket;
 return peer;
}
