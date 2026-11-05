import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { Server, Socket } from 'socket.io';
import { createMatch, stepMatch, NO_INPUT, type ClientToServerEvents, type ServerToClientEvents, type RoomView, type Member, type InputCommand, type MatchState, type Reply, type Session } from '@tag/shared';

type IO = Server<ClientToServerEvents,ServerToClientEvents>;
type Client = Socket<ClientToServerEvents,ServerToClientEvents>;
interface Seat extends Member {
  token: string; socketId: string | null; expires: number;
  queue: InputCommand[]; ack: number; received: number; lastAt: number; last: typeof NO_INPUT;
}
interface Room extends Omit<RoomView,'members'> { members: Seat[]; match: MatchState | null; accumulator: number; updated: number }
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const nickname = (n: unknown) => typeof n === 'string' ? n.trim().replace(/[\u0000-\u001f<>]/g,'').slice(0,20) : '';
const callback = (fn: unknown, value: Reply) => { if (typeof fn === 'function') fn(value); };

export function installRooms(io: IO, graceMs=30_000) {
  const rooms = new Map<string,Room>();
  const locate = (s: Client): [Room,Seat] | null => {
    const room=rooms.get(s.data.code as string); const seat=room?.members.find(m=>m.socketId===s.id);
    return room && seat ? [room,seat] : null;
  };
  const view = (r: Room): RoomView => ({inputBatch:true,code:r.code,hostId:r.hostId,duration:r.duration,mapId:r.mapId,buffsEnabled:r.buffsEnabled,phase:r.phase,round:r.round,roster:r.roster,notice:r.notice,members:r.members.map(({id,nickname,color,ready,connected})=>({id,nickname,color,ready,connected}))});
  const broadcast = (r: Room) => io.to(r.code).emit('room:state',view(r));
  function snapshot(room: Room, periodic = false) {
    if (!room.match) return;
    const {seed, unusedSites, contacts, ...state} = room.match;
    const channel=io.to(room.code);
    (periodic ? channel.volatile : channel).emit('game:snapshot',{
      round:room.round, state,
      acknowledgements:room.roster.map(id=>room.members.find(m=>m.id===id)?.ack ?? -1),
    });
  }
  const lobby = (r:Room,notice='') => {
    r.phase='lobby';r.match=null;r.roster=[];r.notice=notice;r.accumulator=0;
    r.members.forEach(m=>{m.ready=false;m.queue=[];m.last=NO_INPUT;}); broadcast(r);
  };
  const host = (r:Room) => {
    if(!r.members.some(m=>m.id===r.hostId && m.connected)) r.hostId=r.members.find(m=>m.connected)?.id ?? r.members[0]?.id ?? '';
  };
  const remove = (r:Room,m:Seat) => {
    r.members=r.members.filter(p=>p!==m);host(r);
    if(!r.members.length) {rooms.delete(r.code);return;}
    if(r.phase!=='lobby') lobby(r,`${m.nickname} left. The round ended; ready up to play again.`);
    else broadcast(r);
  };
  const bind = (s:Client,r:Room,m:Seat,cb:unknown) => {
    m.socketId=s.id;m.connected=true;m.expires=0;m.queue=[];m.last=NO_INPUT;m.lastAt=0;
    s.data.code=r.code; s.join(r.code);
    callback(cb,{ok:true,session:{code:r.code,playerId:m.id,token:m.token}});
    broadcast(r);snapshot(r);
  };
  io.on('connection',s=> {
    let windowAt=Date.now(),requests=0,inputAt=Date.now(),inputCount=0;
    const guard=(cb:unknown) => {
      if(Date.now()-windowAt>10_000){windowAt=Date.now();requests=0;}
      if(++requests>40){callback(cb,{ok:false,error:'Too many requests. Please wait.'});return false;} return true;
    };
    const fail=(cb:unknown,error:string)=>callback(cb,{ok:false,error});
    const enter=(data:unknown,cb:unknown,create:boolean)=>{
      if(!guard(cb))return;
      if(locate(s))return fail(cb,'Leave your current room first.');
      if(!data || typeof data!=='object')return fail(cb,'Invalid request.');
      const d=data as {nickname?:unknown;code?:unknown};const name=nickname(d.nickname);
      if(!name)return fail(cb,'Enter a nickname (1–20 characters).');
      let room:Room|undefined;
      if(create){
        if(rooms.size>=500)return fail(cb,'Server is full. Try again shortly.');
        let code:string; do {code=Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');}while(rooms.has(code));
        room={code,hostId:'',members:[],duration:120,mapId:'grass',buffsEnabled:false,phase:'lobby',round:0,roster:[],notice:'',match:null,accumulator:0,updated:performance.now()}; rooms.set(code,room);
      }else room=typeof d.code==='string'? rooms.get(d.code.trim().toUpperCase()):undefined;
      if(!room)return fail(cb,'Room not found. Check the 6-character code.');
      if(room.phase!=='lobby')return fail(cb,'This room is playing. Join after it returns to the lobby.');
      if(room.members.length>=4)return fail(cb,'Room is full (4 players).');
      const color=[0,1,2,3].find(c=>!room!.members.some(m=>m.color===c))!;
      const seat:Seat={id:randomUUID(),nickname:name,color,ready:false,connected:true,token:randomBytes(24).toString('hex'),socketId:s.id,expires:0,queue:[],ack:-1,received:-1,lastAt:0,last:NO_INPUT};
      room.members.push(seat);if(!room.hostId)room.hostId=seat.id; bind(s,room,seat,cb);
    };
    s.on('room:create',(d,cb)=>enter(d,cb,true));
    s.on('room:join',(d,cb)=>enter(d,cb,false));
    s.on('room:resume',(d:Session,cb)=>{
      if(!guard(cb))return;
      if(locate(s))return fail(cb,'Already in a room.');
      const r=d && typeof d.code==='string'?rooms.get(d.code):undefined;
      const m=r?.members.find(p=>p.id===d.playerId && p.token===d.token);
      if(!r || !m || (m.expires && m.expires<Date.now()))return fail(cb,'Your session expired. Join the room again.');
      if(m.connected)return fail(cb,'This player is already connected in another session.');
      bind(s,r,m,cb);host(r);broadcast(r);
    });
    s.on('room:leave',cb=>{
      if(!guard(cb))return; const pair=locate(s);
      if(pair){s.leave(pair[0].code);delete s.data.code;remove(...pair);} callback(cb,{ok:true});
    });
    s.on('room:ready',(ready,cb)=>{
      if(!guard(cb))return; const pair=locate(s);
      if(!pair || pair[0].phase!=='lobby' || typeof ready!=='boolean')return fail(cb,'Ready is only available in the lobby.');
      pair[1].ready=ready;broadcast(pair[0]);callback(cb,{ok:true});
    });
    s.on('room:settings',(settings,cb)=>{
      if (!guard(cb)) return;
      const pair = locate(s);
      if (!pair || pair[0].hostId !== pair[1].id || pair[0].phase !== 'lobby')
        return fail(cb,'Only the host can change lobby settings.');
      const [room] = pair;
      const next = typeof settings === 'number'
        ? { duration: settings, mapId: room.mapId, buffsEnabled: room.buffsEnabled }
        : settings;
      if (!next || ![60,120,180].includes(next.duration) ||
          !['grass','snow','desert'].includes(next.mapId) || typeof next.buffsEnabled !== 'boolean')
        return fail(cb,'Invalid match settings.');
      room.duration = next.duration;
      room.mapId = next.mapId;
      room.buffsEnabled = next.buffsEnabled;
      room.members.forEach(member => member.ready = false);
      broadcast(room);
      callback(cb,{ok:true});
    });
    s.on('room:start',cb=>{
      if(!guard(cb))return;const pair=locate(s);
      if(!pair || pair[0].hostId!==pair[1].id)return fail(cb,'Only the host can start.');
      const [r]=pair;
      if(r.phase==='playing')return fail(cb,'A round is already running.');
      if(r.members.length<2 || r.members.some(m=>!m.connected || (r.phase==='lobby' && !m.ready)))return fail(cb,'Need 2–4 connected, ready players.');
      r.roster=r.members.map(m=>m.id);r.match=createMatch(r.duration,r.members.length,r.mapId,r.buffsEnabled,randomInt(1,0xffffffff));r.phase='playing';r.round++;r.accumulator=0;r.updated=performance.now();r.notice='';
      r.members.forEach(m=>{m.queue=[];m.ack=-1;m.received=-1;m.last=NO_INPUT;m.lastAt=0;});
      broadcast(r);snapshot(r);callback(cb,{ok:true});
    });
    s.on('room:lobby',cb=>{
      if(!guard(cb))return;const pair=locate(s);
      if(!pair || pair[0].hostId!==pair[1].id)return fail(cb,'Only the host can return everyone to the lobby.');
      lobby(pair[0]);callback(cb,{ok:true});
    });
    const acceptInput=(command:InputCommand)=>{
      if(Date.now()-inputAt>1000){inputAt=Date.now();inputCount=0;}
      if(++inputCount>120)return;
      const pair=locate(s);if(!pair || pair[0].phase!=='playing')return;
      const [r,m]=pair;
      if(!command || command.round!==r.round || !Number.isSafeInteger(command.sequence) || command.sequence<0 || command.sequence<=m.received || command.sequence>m.received+600 || ['left','right','jump'].some(k=>typeof command[k as keyof InputCommand]!=='boolean'))return;
      if(m.queue.length>=90)return;
      m.received=command.sequence;m.lastAt=Date.now();
      m.queue.push({sequence:command.sequence,round:r.round,left:command.left,right:command.right,jump:command.jump});
    };
    s.on('game:input',acceptInput);
    s.on('game:inputs',commands=>{
      if (Array.isArray(commands) && commands.length<=6) commands.forEach(acceptInput);
    });
    s.on('game:neutral',()=>{const pair=locate(s);if(pair){const m=pair[1];m.ack=m.received;m.queue=[];m.last=NO_INPUT;m.lastAt=0;}});
    s.on('disconnect',()=>{
      const pair=locate(s);if(!pair)return;const [r,m]=pair;
      m.connected=false;m.ready=false;m.socketId=null;m.expires=Date.now()+graceMs;m.queue=[];m.last=NO_INPUT;m.ack=m.received;
      host(r);broadcast(r);
    });
  });
  const timer=setInterval(()=>{
    const now=performance.now();
    for(const r of rooms.values()){
      for(const m of [...r.members]) if(!m.connected && m.expires<=Date.now())remove(r,m);
      if(!rooms.has(r.code))continue;
      const elapsed=now-r.updated;r.updated=now;
      if(r.phase!=='playing' || !r.match)continue;
      r.accumulator+=elapsed;
      // Fixed 60 Hz authority; cap per-pass work but retain debt instead of slowing the match timer.
      const previousTick=r.match.tick;
      let ticks=0;
      while(r.accumulator>=1000/60 && ticks++<120 && r.match.phase==='playing'){
        const inputs=r.roster.map(id=>{
          const m=r.members.find(p=>p.id===id)!;const input=m.queue.shift();
          if(input){m.ack=input.sequence;m.last=input;}
          return m.connected && Date.now()-m.lastAt<250 ? m.last : NO_INPUT;
        });
        stepMatch(r.match,inputs);r.accumulator-=1000/60;

      }
      if(r.match.phase==='playing' && Math.floor(previousTick/3)!==Math.floor(r.match.tick/3))snapshot(r,true);
      if(r.match.phase==='over'){r.phase='over';snapshot(r);broadcast(r);}
    }
  },8);
  return {rooms,close:()=>clearInterval(timer)};
}
