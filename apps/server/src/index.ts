import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { Server } from 'socket.io';
import { PROTOCOL_VERSION, type ClientToServerEvents, type ServerToClientEvents } from '@tag/shared';
import { installRooms } from './rooms/service.js';

const host=process.env.HOST ?? '0.0.0.0';
const port=Number(process.env.PORT ?? 3001);
if(!Number.isInteger(port) || port<1 || port>65535)throw new Error('Invalid PORT');
const root=fileURLToPath(new URL('../../client/dist/',import.meta.url));
const origins=(process.env.CLIENT_ORIGIN ?? '').split(',').map(s=>s.trim()).filter(Boolean);
const publicOrigin=process.env.PUBLIC_SERVER_URL ? new URL(process.env.PUBLIC_SERVER_URL) : null;
if(publicOrigin && (!['http:','https:'].includes(publicOrigin.protocol) || publicOrigin.username || publicOrigin.password))
  throw new Error('PUBLIC_SERVER_URL must be an HTTP(S) origin');
const http=createServer(async(req,res)=>{
  if(req.url==='/tag-config.js'){
    res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});
    res.end('window.TAG_CONFIG='+JSON.stringify({serverUrl:publicOrigin?.origin ?? ''})+';');
    return;
  }
  if(req.url==='/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:'ok',protocolVersion:PROTOCOL_VERSION}));return;}
  if(req.method!=='GET' && req.method!=='HEAD'){res.writeHead(405).end();return;}
  try {
    const pathname=decodeURIComponent(new URL(req.url ?? '/','http://internal').pathname);
    const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(resolve(root)+sep)){res.writeHead(403).end();return;}
    const accepted=String(req.headers['accept-encoding'] ?? '').split(',').map(token=>token.trim());
    let body:Buffer|undefined;
    if (/\.(js|css|svg|html)$/.test(file)){
      res.setHeader('Vary','Accept-Encoding');
      for(const [encoding,suffix] of [['br','.br'],['gzip','.gz']] as const){
        if(!accepted.some(token=>token.split(';')[0]?.trim()===encoding && !/;\s*q=0(?:\.0*)?$/.test(token)))continue;
        try {body=await readFile(file+suffix);res.setHeader('Content-Encoding',encoding);break;}
        catch {/* Uncompressed development assets are also supported. */}
      }
    }
    body ??= await readFile(file);
    const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
    res.setHeader('Content-Type',types[extname(file)] ?? 'application/octet-stream');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Cache-Control',/^\/assets\/[^/]+-[\w-]{8,}\.(?:js|css)$/.test(pathname)?'public,max-age=31536000,immutable':'no-cache');
    res.end(req.method==='HEAD'?undefined:body);
  } catch {res.writeHead(404).end('Not found. Run npm run build first.');}
});
const io=new Server<ClientToServerEvents,ServerToClientEvents>(http,{
  maxHttpBufferSize:16_384,
  cors:{origin:origins.length?origins:false},
  allowRequest:(req,cb)=>{
    const origin=req.headers.origin;
    if(!origin)return cb(null,true);
    try { cb(null,new URL(origin).host===req.headers.host || origins.includes(origin)); }
    catch {cb(null,false);}
  },
});
const service=installRooms(io);
http.listen(port,host,()=>console.log(`Tag multiplayer: http://localhost:${port}`));
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{service.close();io.close();});
