import http from 'node:http';
import https from 'node:https';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const apiOrigin='https://hrm-graduation.up.railway.app';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.md':'text/markdown; charset=utf-8','.json':'application/json'};
function proxyApi(req,res){const target=new URL(req.url,apiOrigin);const headers={...req.headers,host:target.host};delete headers.origin;delete headers.referer;const upstream=https.request(target,{method:req.method,headers},response=>{res.writeHead(response.statusCode||502,response.headers);response.pipe(res);});upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('API proxy error');});if(req.method==='GET'||req.method==='HEAD')upstream.end();else req.pipe(upstream);}
http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname.startsWith('/api/'))return proxyApi(req,res);const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}}).listen(4173,'127.0.0.1',()=>console.log('Intelex ERP: http://127.0.0.1:4173'));
