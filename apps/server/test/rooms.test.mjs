import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';
import { installRooms } from '../dist/rooms/service.js';

const wait=ms=>new Promise(r=>setTimeout(r,ms));
const request=(s,event,...args)=>new Promise((resolve,reject)=>s.timeout(2000).emit(event,...args,(err,result)=>err?reject(err):resolve(result)));
const until=async(fn)=>{for(let i=0;i<100;i++){if(fn())return;await wait(20);}throw new Error('Timed out');};

test('online lifecycle: 4 seats, authority, inputs, recovery, host transfer, expiry, rematch and cleanup',async()=>{
  const http=createServer(),io=new Server(http),service=installRooms(io,250);
  await new Promise(r=>http.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${http.address().port}`;
  const clients=[];
  const client=async()=>{
    const s=connect(url,{forceNew:true,reconnection:false});clients.push(s);
    await new Promise((r,j)=>{s.on('connect',r);s.on('connect_error',j);});return s;
  };
  try {
    const a=await client(),b=await client(),c=await client(),d=await client(),extra=await client();
    const created=await request(a,'room:create',{nickname:'Alice'});assert.equal(created.ok,true);
    const {code}=created.session;assert.match(code,/^[A-Z2-9]{6}$/);
    const sa=created.session;
    const joined=await request(b,'room:join',{code:code.toLowerCase(),nickname:'Bob'});assert.equal(joined.ok,true);
    await request(c,'room:join',{code,nickname:'Cara'});await request(d,'room:join',{code,nickname:'Dan'});
    assert.equal((await request(extra,'room:join',{code,nickname:'Eve'})).ok,false);
    const room=service.rooms.get(code);
    assert.deepEqual(room.members.map(m=>m.color),[0,1,2,3]);
    assert.equal((await request(b,'room:settings',180)).ok,false);
    assert.equal((await request(b,'room:start')).ok,false);
    assert.equal((await request(a,'room:settings',99)).ok,false);
    assert.equal((await request(a,'room:start')).ok,false);
    assert.equal((await request(a,'room:settings',120)).ok,true);
    for(const s of [a,b,c,d])await request(s,'room:ready',true);
    assert.equal((await request(a,'room:start')).ok,true);
    assert.equal(room.match.durationTicks,7200);assert.equal(room.match.players.length,4);
    const views=[];a.on('game:snapshot',s=>views.push(s));
    const x=room.match.players[0].x;
    for(let sequence=0;sequence<30;sequence++)a.emit('game:input',{sequence,round:room.round,left:false,right:true,jump:sequence===0});
    await until(()=>room.members[0].ack>=25);
    assert.ok(room.match.players[0].x>x);assert.ok(views.length>0);
    // A client cannot submit a forged state, move another seat, or send an old-round input.
    const received=room.members[0].received;
    a.emit('game:input',{sequence:31,round:room.round-1,left:false,right:true,jump:false,x:99999});
    a.emit('game:input',{sequence:32,round:room.round,left:0,right:true,jump:false});
    await wait(40);assert.equal(room.members[0].received,received);
    // Server final-tick contact, then frozen authoritative result and host-only rematch.
    room.match.players[0]={...room.match.players[1]};room.match.contacts=[];room.match.tagLock=0;room.match.it=1;room.match.tick=room.match.durationTicks-1;
    room.members.forEach(m=>{m.queue=[];m.lastAt=0;});
    await until(()=>room.phase==='over');assert.equal(room.match.loser,0);
    assert.equal((await request(b,'room:start')).ok,false);
    assert.equal((await request(a,'room:start')).ok,true);assert.equal(room.round,2);assert.ok(room.match.tick<5);
    a.disconnect();await until(()=>!room.members[0].connected);
    assert.equal(room.hostId,joined.session.playerId);
    const resumed=await client();assert.equal((await request(resumed,'room:resume',sa)).ok,true);
    assert.equal(room.members[0].connected,true);assert.equal(room.hostId,joined.session.playerId);
    const thief=await client();assert.equal((await request(thief,'room:resume',{...sa,token:'wrong'})).ok,false);
    assert.equal((await request(resumed,'room:lobby')).ok,false);
    assert.equal((await request(b,'room:lobby')).ok,true);assert.equal(room.phase,'lobby');
    for(const s of [resumed,b,c,d])await request(s,'room:ready',true);
    assert.equal((await request(b,'room:start')).ok,true);
    d.disconnect();await until(()=>room.members.length===3);assert.equal(room.phase,'lobby');assert.match(room.notice,/left/);
    await request(resumed,'room:leave');await request(b,'room:leave');await request(c,'room:leave');
    assert.equal(service.rooms.has(code),false);
  }finally{clients.forEach(s=>s.disconnect());service.close();await new Promise(r=>io.close(r));}
});

for (const [index,mapId] of ['grass','snow','desert'].entries()) {
  test(`two connected players synchronize ${mapId}: settings, spawn, input, pad, portal, pickup and restart`,async()=>{
    const {ARENAS,PLAYER_WIDTH,PLAYER_HEIGHT}=await import('@tag/shared');
    const http=createServer(),io=new Server(http),service=installRooms(io);
    await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
    const url=`http://127.0.0.1:${http.address().port}`;
    const peers=[connect(url,{forceNew:true}),connect(url,{forceNew:true})];
    const [host,guest]=peers;
    const streams=[new Map(),new Map()];
    try {
      await Promise.all(peers.map((socket,i)=>new Promise(resolve=>{
        socket.on('game:snapshot',packet=>streams[i].set(packet.round+':'+packet.state.tick,packet));
        socket.once('connect',resolve);
      })));
      const session=(await request(host,'room:create',{nickname:'Host'})).session;
      assert.ok((await request(guest,'room:join',{nickname:'Guest',code:session.code})).ok);
      const room=service.rooms.get(session.code),arena=ARENAS[mapId];
      const settings={mapId,buffsEnabled:true,duration:[60,120,180][index]};
      assert.equal((await request(guest,'room:settings',settings)).ok,false);
      assert.ok((await request(host,'room:settings',settings)).ok);
      for(const socket of peers)await request(socket,'room:ready',true);
      assert.ok((await request(host,'room:start')).ok);
      const match=room.match;
      assert.equal(match.mapId,mapId);assert.equal(match.durationTicks,settings.duration*60);
      assert.ok(match.players.every(p=>p.x>=arena.spawnLeft && p.x<=arena.spawnRight && p.y===arena.spawnY-PLAYER_HEIGHT/2) || match.tick>0);
      const initial=match.players.map(p=>p.x);
      for(let sequence=0;sequence<12;sequence++)peers.forEach((s,i)=>s.emit('game:input',{round:room.round,sequence,left:i===0,right:i===1,jump:false}));
      await until(()=>room.members.every(m=>m.ack>=11));
      assert.ok(match.players[0].x<initial[0] && match.players[1].x>initial[1]);
      for(const s of peers)s.emit('game:neutral');await wait(30);
      async function both(predicate){
        let found;
        await until(()=>{
          found=[...streams[0]].find(([key,p])=>p.round===room.round && predicate(p.state) && streams[1].has(key));
          return !!found;
        });
        assert.deepEqual(found[1],streams[1].get(found[0]));
        return found[1].state;
      }
      // Controlled server-side fixtures put pad/portal contacts inside the test window.
      // Peers have no event that accepts positions, effects, or a clock override.
      const p=match.players[0],pad=arena.pads[0];
      Object.assign(p,{x:pad.x-PLAYER_WIDTH/2,y:pad.y-PLAYER_HEIGHT-5,vy:260,grounded:false});
      await both(state=>state.players[0].vy < -800);
      const gate=arena.portals[match.portalPair][0];
      Object.assign(p,{x:gate.x-PLAYER_WIDTH/2,y:gate.y-PLAYER_HEIGHT/2,vy:0});
      await both(state=>!!state.players[0].transit);
      // Let the ordinary 60 Hz server complete the flight.
      for(let i=0;i<80 && (p.transit || match.portalReadyAt===0);i++)await wait(50);
      await both(state=>state.portalReadyAt>state.tick && !state.players[0].transit);
      match.tick=479;
      await both(state=>state.pickups.length>0);
      const pickup=match.pickups[0],site=arena.sites[pickup.site];pickup.kind='speed';
      Object.assign(p,{x:site.x-PLAYER_WIDTH/2,y:site.y-PLAYER_HEIGHT/2,vy:0});
      await both(state=>state.pickups.length===0 && state.players[0].effects.speed>state.tick);
      assert.ok((await request(host,'room:lobby')).ok);
      assert.ok((await request(host,'room:settings',{...settings,buffsEnabled:false})).ok);
      for(const socket of peers)await request(socket,'room:ready',true);
      assert.ok((await request(host,'room:start')).ok);
      room.match.tick=479;
      await both(state=>state.tick>=480 && !state.buffsEnabled && state.pickups.length===0);
    }finally{peers.forEach(s=>s.disconnect());service.close();await new Promise(resolve=>io.close(resolve));}
  });
}

test('two peers agree on seam traversal, both crate faces, a crate-top landing and a walk through tree cover', async()=>{
  const {PLAYER_WIDTH:w,PLAYER_HEIGHT:h,ARENAS,surfaceAt}=await import('@tag/shared');
  const http=createServer(),io=new Server(http),service=installRooms(io);
  await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
  const peers=Array.from({length:2},()=>connect('http://127.0.0.1:'+http.address().port,{forceNew:true,reconnection:false}));
  const frames=[new Map(),new Map()],sequence=[0,0];
  try{
    await Promise.all(peers.map((peer,i)=>new Promise(resolve=>{
      peer.on('game:snapshot',s=>frames[i].set(s.state.tick,s.state));peer.once('connect',resolve);
    })));
    const {session}=await request(peers[0],'room:create',{nickname:'Left'});
    await request(peers[1],'room:join',{code:session.code,nickname:'Right'});
    for(const peer of peers)await request(peer,'room:ready',true);
    assert.ok((await request(peers[0],'room:start')).ok);
    const room=service.rooms.get(session.code),s=room.match;
    const put=(i,x,feet)=>Object.assign(s.players[i],{x,y:feet-h,grounded:true,vx:0,vy:0,jumpHeld:false});
    const send=(i,count,direction,jump=false)=>{
      for(let t=0;t<count;t++)peers[i].emit('game:input',{round:room.round,sequence:sequence[i]++,left:direction<0,right:direction>0,jump:jump && t===0});
      peers[i].emit('game:input',{round:room.round,sequence:sequence[i]++,left:false,right:false,jump:false});
    };
    const check=async(after,predicate)=>{
      let frame;
      await until(()=>{frame=[...frames[0]].find(([tick,state])=>tick>after && frames[1].has(tick) && predicate(state.players));return !!frame;});
      assert.deepEqual(frame[1],frames[1].get(frame[0]));
    };
    s.portalReadyAt=s.durationTicks;
    for(const path of ARENAS.grass.platforms.filter(p=>p.rampStart!==undefined)){
      const join=path.rampStart;
      put(0,join-20-w/2,path.y);put(1,join+20-w/2,surfaceAt(path,join+20));
      const start=s.tick;send(0,7,1);send(1,7,-1);
      await check(start,([a,b])=>a.x+w/2>join+10 && b.x+w/2<join-10 && a.grounded && b.grounded);
      await until(()=>room.members.every((m,i)=>m.ack===sequence[i]-1));
    }
    put(0,1068,515.8);put(1,1163,515.8);
    let start=s.tick;send(0,12,1);send(1,12,-1);
    await check(start,([a,b])=>a.x===1107-w && b.x===1141 && a.grounded && b.grounded);
    await until(()=>room.members.every((m,i)=>m.ack===sequence[i]-1));
    start=s.tick;send(0,10,1,true);
    await check(start,([a])=>a.grounded && Math.abs(a.y+h-481.8)<1e-6 && a.x+w>1124);
    // The existing central tree straddles x=740. The server must accept ordinary motion under its canopy.
    put(0,710,466.1);put(1,755,466.1);start=s.tick;send(0,4,1);send(1,4,-1);
    await check(start,players=>players.every(p=>Math.abs(p.x+w/2-740)<13 && p.grounded));
    await until(()=>room.members.every((m,i)=>m.ack===sequence[i]-1));
    start=s.tick;send(0,4,1);send(1,4,-1);
    await check(start,([a,b])=>a.x+w/2>752 && b.x+w/2<728);
  }finally{peers.forEach(p=>p.disconnect());service.close();await new Promise(resolve=>io.close(resolve));}
});
