import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {once} from 'node:events';

test('frontend proxies SignalR negotiation and WebSocket upgrades through the configured API origin',async()=>{
 const sockets=new Set(),requests=[];
 const backend=http.createServer((req,res)=>{requests.push({url:req.url,authorization:req.headers.authorization});res.setHeader('Content-Type','application/json');res.end(JSON.stringify({connectionId:'test',availableTransports:[]}));});
 backend.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
 backend.on('upgrade',(req,socket,head)=>{requests.push({url:req.url,authorization:req.headers.authorization});socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n');if(head.length)socket.write('ECHO:'+head.toString());socket.on('data',data=>socket.write('ECHO:'+data.toString()));});
 let frontend,client;
 try{
 backend.listen(0,'127.0.0.1');await once(backend,'listening');process.env.API_ORIGIN=`http://127.0.0.1:${backend.address().port}`;
 frontend=(await import('../server.js')).server;frontend.listen(0,'127.0.0.1');await once(frontend,'listening');const port=frontend.address().port;
 const response=await fetch(`http://127.0.0.1:${port}/hubs/notifications/negotiate?negotiateVersion=1`,{method:'POST',headers:{Authorization:'Bearer test-jwt'}});
 assert.equal(response.status,200);assert.equal((await response.json()).connectionId,'test');assert.equal(requests[0].authorization,'Bearer test-jwt');
 client=net.connect(port,'127.0.0.1');await once(client,'connect');
 const received=new Promise((resolve,reject)=>{let text='';client.setTimeout(3000,()=>reject(Error('Upgrade proxy timeout')));client.on('data',data=>{text+=data.toString();if(text.includes('ECHO:CLIENT-HEAD'))resolve(text);});client.on('error',reject);});
 client.write('GET /hubs/notifications?id=connection-test&access_token=test-jwt HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\nCLIENT-HEAD');
 const data=await received;assert.ok(data.includes('101 Switching Protocols'));assert.ok(data.includes('ECHO:CLIENT-HEAD'));assert.ok(requests[1].url.startsWith('/hubs/notifications?'));
 }finally{
 client?.destroy();frontend?.closeAllConnections();for(const socket of sockets)socket.destroy();
 await Promise.all([frontend?new Promise(resolve=>frontend.close(resolve)):Promise.resolve(),new Promise(resolve=>backend.close(resolve))]);
 }
});
