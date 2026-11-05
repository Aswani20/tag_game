import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { io } from 'socket.io-client';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
const until=async(probe,limit=5000)=>{
  const deadline=performance.now()+limit;
  while(performance.now()<deadline){if(probe())return;await sleep(20);}
  assert.fail('Timed out waiting for '+probe.toString());
};
const request=(s,event,...args)=>s.timeout(4000).emitWithAck(event,...args);

// Delay real TCP bytes in each direction. Preserve order even when jitter changes.
function delayedPipe(source,destination){
  let previous=0,chunk=0;
  source.on('data',data=>{
    const now=performance.now();
    const due=Math.max(previous,now+75+[0,8,-7,4,-4][chunk++%5]);
    previous=due;
    setTimeout(()=>{if(!destination.destroyed)destination.write(data);},Math.max(0,due-now));
  });
  source.on('error',()=>destination.destroy());
  source.on('close',()=>destination.destroy());
}

test('production server: static assets, split origins, 3 clients behind a delayed TCP link, real expiry and rematch',{timeout:95000},async t=>{
  const reservation=net.createServer(),port=await listen(reservation);
  await new Promise(resolve=>reservation.close(resolve));
  const backend='http://127.0.0.1:'+port;
  const origin='https://test-frontend.example';
  const child=spawn(process.execPath,['apps/server/dist/index.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:String(port),PUBLIC_SERVER_URL:backend,CLIENT_ORIGIN:origin},stdio:['ignore','pipe','pipe']});
  const peers=[],streams=new Set();
  const proxy=net.createServer(front=>{
    const back=net.connect(port,'127.0.0.1');
    front.setNoDelay();back.setNoDelay();streams.add(front);streams.add(back);
    delayedPipe(front,back);delayedPipe(back,front);
  });
  let started=false;
  child.stdout.on('data',chunk=>{if(String(chunk).includes('Tag multiplayer:'))started=true;});
  try{
    await until(()=>started,5000);
  }catch(error){child.kill();throw error;}
  async function run(){
    const health=await (await fetch(backend+'/health')).json();assert.equal(health.status,'ok');
    assert.match(await (await fetch(backend+'/tag-config.js')).text(),new RegExp(port));
    const html=await (await fetch(backend)).text();
    const bundle=html.match(/src="(\/assets\/[^"]+\.js)"/)[1];
    const js=await fetch(backend+bundle,{headers:{'Accept-Encoding':'br'}});
    assert.equal(js.headers.get('content-encoding'),'br');assert.ok((await js.text()).length>1000);
    const handshake=await fetch(backend+'/socket.io/?EIO=4&transport=polling',{headers:{Origin:origin}});
    assert.equal(handshake.headers.get('access-control-allow-origin'),origin);
    assert.equal((await fetch(backend+'/socket.io/?EIO=4&transport=polling',{headers:{Origin:'https://unapproved.example'}})).status,403);
    const url='http://127.0.0.1:'+await listen(proxy);
    const connect=async()=>{
      const socket=io(url,{forceNew:true,transports:['websocket'],reconnection:false,extraHeaders:{Origin:origin}});
      peers.push(socket);await once(socket,'connect');return socket;
    };
    const [a,b,c]=await Promise.all([connect(),connect(),connect()]);
    const latest=[null,null,null],history=[new Map(),new Map(),new Map()];
    const observe=(socket,i)=>socket.on('game:snapshot',packet=>{
      latest[i]=packet;
      if(packet.round===1)history[i].set(packet.state.tick,packet);
    });
    [a,b,c].forEach(observe);
    const startPing=performance.now();
    const {session}=await request(a,'room:create',{nickname:'Amber'});
    const rtt=performance.now()-startPing;
    assert.ok(rtt>=115);
    await request(b,'room:join',{nickname:'Blue',code:session.code});
    const third=await request(c,'room:join',{nickname:'Sun',code:session.code});
    assert.ok((await request(a,'room:settings',{mapId:'snow',duration:60,buffsEnabled:true})).ok);
    await Promise.all([a,b,c].map(s=>request(s,'room:ready',true)));
    const startedAt=performance.now();
    assert.ok((await request(a,'room:start')).ok);
    await until(()=>latest.every(p=>p?.state.tick>=15));
    const [red,blue]=latest[0].state.players;
    const ticks=Math.ceil((blue.x-red.x)/ (310/60));
    let sequence=0;
    while(sequence<ticks+14){
      const batch=[];
      for(let i=0;i<2;i++)batch.push({round:1,sequence,left:false,right:sequence++<ticks,jump:false});
      a.emit('game:inputs',batch);await sleep(33);
    }
    await until(()=>latest.every(p=>p.state.tags>=1 && p.state.it===0));
    await until(()=>latest[0].acknowledgements[0]>=sequence-1);
    const finalX=latest[0].state.players[0].x;
    assert.ok(finalX>red.x+15);
    // Rejoin at the same seat from a fresh connection during the match.
    c.disconnect();
    const rejoined=await connect();observe(rejoined,2);
    assert.ok((await request(rejoined,'room:resume',third.session)).ok);
    await until(()=>latest[2].state.tick>=120);
    await until(()=>latest.every(p=>p.state.phase==='over'),66000);
    const elapsed=(performance.now()-startedAt)/1000;
    assert.ok(elapsed>59 && elapsed<65);
    for(const packet of latest){assert.equal(packet.state.tick,3600);assert.equal(packet.state.loser,0);}
    let matched=0;
    for(const [tick,packet] of history[0]){
      if(!history[1].has(tick)||!history[2].has(tick))continue;
      assert.deepEqual(packet,history[1].get(tick));assert.deepEqual(packet,history[2].get(tick));matched++;
    }
    assert.ok(matched>900);
    assert.ok((await request(a,'room:start')).ok);
    await until(()=>latest.every(p=>p.round===2 && p.state.tick<100 && p.state.tags===0));
    t.diagnostic('Observed room-create RTT '+Math.round(rtt)+' ms; '+matched+' matching 3-client snapshots; real round '+elapsed.toFixed(2)+' s.');
  }
  try{await run();}finally{
    peers.forEach(p=>p.disconnect());streams.forEach(s=>s.destroy());
    if(proxy.listening)await new Promise(resolve=>proxy.close(resolve));
    child.kill();
  }
});
