
import http from 'node:http';
import https from 'node:https';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = process.cwd();

const PORT = Number(process.env.PORT) || 4173;
const HOST = '0.0.0.0';

const apiOrigin =
  process.env.API_ORIGIN ||
  'https://hrm-graduation.up.railway.app';

 
  const webOrigin =
  process.env.webOrigin ||
  'https://intelex-web-production.up.railway.app';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

function proxyApi(req, res) {
  const target = new URL(req.url, apiOrigin);
  if(target.origin!==new URL(apiOrigin).origin){res.writeHead(400);res.end('Invalid proxy target');return;}

  const headers = {
    ...req.headers,
    host: target.host
  };

  delete headers.origin;
  delete headers.referer;

  const transport =
    target.protocol === 'http:' ? http : https;

  const upstream = transport.request(
    target,
    {
      method: req.method,
      headers
    },
    response => {
      res.writeHead(response.statusCode || 502, response.headers);
      response.pipe(res);
    }
  );

  upstream.on('error', error => {
    console.error('API proxy error:', error.message);

    if (!res.headersSent) {
      res.writeHead(502);
    }

    res.end('API proxy error');
  });

  if (req.method === 'GET' || req.method === 'HEAD') {
    upstream.end();
  } else {
    req.pipe(upstream);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, 'http://localhost').pathname
    );

    if (pathname.startsWith('/api/') || pathname === '/hubs/notifications' || pathname.startsWith('/hubs/notifications/')) {
      return proxyApi(req, res);
    }

    const file = path.resolve(
      root,
      '.' + (pathname === '/' ? '/index.html' : pathname)
    );

    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    const data = await readFile(file);

    res.writeHead(200, {
      'Content-Type':
        types[path.extname(file)] ||
        'application/octet-stream',
      'Cache-Control': 'no-cache'
    });

    res.end(data);

  } catch (error) {
    console.error('File error:', error.message);

    res.writeHead(404);
    res.end('Not found');
  }
});

// SignalR uses the same frontend origin for negotiate, long polling and WebSocket upgrades.
server.on('upgrade',(req,socket,head)=>{
 let target;
 try{target=new URL(req.url,apiOrigin);}catch{socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');return;}
 if(target.origin!==new URL(apiOrigin).origin||target.pathname!=='/hubs/notifications'){socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');return;}
 const headers={...req.headers,host:target.host};delete headers.origin;delete headers.referer;
 const transport=target.protocol==='https:'?https:http;
 const upstream=transport.request(target,{method:'GET',headers});
 socket.on('error',()=>upstream.destroy());
 upstream.on('upgrade',(response,peer,peerHead)=>{
 if(socket.destroyed){peer.destroy();return;}
 socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n`+response.rawHeaders.reduce((text,value,index)=>text+(index%2?value+'\r\n':value+': '),'')+'\r\n');
 if(head.length)peer.write(head);if(peerHead.length)socket.write(peerHead);
 peer.on('error',()=>socket.destroy());socket.on('close',()=>peer.destroy());peer.on('close',()=>socket.destroy());
 socket.pipe(peer);peer.pipe(socket);
 });
 upstream.on('response',response=>{if(!socket.destroyed){socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\nConnection: close\r\n\r\n`);response.pipe(socket);}else response.resume();});
 upstream.on('error',()=>{if(!socket.destroyed)socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');});
 upstream.end();
});

export {server};
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){

server.listen(PORT, HOST, () => {
  console.log(`Intelex ERP running at http://${HOST}:${PORT}`);
  console.log(`API Proxy: ${webOrigin}`);
});

}
