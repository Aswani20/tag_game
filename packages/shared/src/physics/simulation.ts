import { ARENAS } from '../maps/arenas.js';
import type { MapId, Vec2 } from '../types.js';
import { type Platform } from '../maps/grass.js';
export const STEP_SECONDS = 1 / 60;
// Gravity is applied before displacement. After n ticks the rise is
// n*dt*v - g*dt²*n*(n+1)/2. The old 760 impulse peaked at 149 5/6
// units on tick 24; the shorter arc peaks on tick 19.
const GRAVITY = 1850;
const jumpSpeed = 89.9 / (19 * STEP_SECONDS) + GRAVITY * STEP_SECONDS * 10;
const OBJECT_LAUNCH_SPEED = 760; // Pads and group-spring pickups retain their original impulses.
export const MOVEMENT = { speed: 310, gravity: GRAVITY, jumpSpeed, maxFallSpeed: 1050, coyoteTicks: 6, bufferTicks: 6 } as const;
export const TAG_LOCK_TICKS = 45;
export interface Input { left: boolean; right: boolean; jump: boolean }
export const NO_INPUT: Input = { left: false, right: false, jump: false };
export const BUFFS = ['speed','jump','swap','shield','super','float','spring','fade'] as const;
export type Buff = typeof BUFFS[number];
export interface Pickup { site: number; kind: Buff }
export interface SimPlayer {
  effects: Partial<Record<Buff,number>>; transit: Vec2 | null; warp: number;
  x: number; y: number; vx: number; vy: number; grounded: boolean;
  facing: number; coyote: number; jumpBuffer: number; jumpHeld: boolean;
}
export interface MatchState {
  mapId: MapId; buffsEnabled: boolean; seed: number; portalPair: number; portalReadyAt: number;
  pickups: Pickup[]; unusedSites: number[];
  players: SimPlayer[]; tick: number; durationTicks: number; it: number;
  tagLock: number; contacts: string[]; phase: 'playing' | 'over'; loser: number | null; tags: number;
}
export const PLAYER_WIDTH = 17;
export const PLAYER_HEIGHT = 22;
function choose(state: {seed:number}, limit:number):number {
  state.seed = (Math.imul(state.seed,1664525) + 1013904223) >>> 0;
  return Math.floor(state.seed / 0x100000000 * limit);
}

export function createMatch(duration:60|120|180, count=2, mapId:MapId='grass', buffsEnabled=false, seed=1):MatchState {
  if (![2,3,4].includes(count)) throw new Error('2–4 players required');
  const arena = ARENAS[mapId];
  const state:MatchState = {mapId,buffsEnabled,seed,portalPair:0,portalReadyAt:0,pickups:[],
    unusedSites:arena.sites.map((_,i)=>i),players:[],tick:0,durationTicks:duration*60,it:1,
    tagLock:0,contacts:[],phase:'playing',loser:null,tags:0};
  state.portalPair = choose(state,arena.portals.length);
  // Randomize within the original central spawn band, one lane per player to avoid overlap.
  const lane=(arena.spawnRight-arena.spawnLeft)/count;
  for(let i=0;i<count;i++){
    const x=arena.spawnLeft+i*lane+choose(state,Math.floor(lane-PLAYER_WIDTH));
    state.players.push({x,y:arena.spawnY-PLAYER_HEIGHT/2,vx:0,vy:0,grounded:false,facing:1,
      coyote:0,jumpBuffer:0,jumpHeld:false,effects:{},transit:null,warp:0});
  }
  return state;
}
export function hasEffect(player:SimPlayer,kind:Buff,tick:number):boolean {
  return (player.effects[kind] ?? 0)>tick;
}
function inclineFraction(p:Platform,x:number):number {
  const start=p.rampStart ?? p.x;
  return Math.max(0,Math.min(1,(x-start)/(p.x+p.width-start)));
}
export function surfaceAt(p: Platform, x: number): number {
  return p.y + ((p.endY ?? p.y) - p.y) * inclineFraction(p,x);
}
export function undersideAt(p:Platform,x:number):number {
  const depth=p.thickness ?? 11;
  return surfaceAt(p,x)+depth+((p.endThickness ?? depth)-depth)*inclineFraction(p,x);
}
export function movePlayer(p: SimPlayer, input: Input, mapId:MapId='grass', tick=0): void {
  const arena=ARENAS[mapId];
  if(p.transit){
    const dx=p.transit.x-p.x, dy=p.transit.y-p.y;
    const distance=Math.hypot(dx,dy), stride=508*STEP_SECONDS;
    if(distance<=stride){p.x=p.transit.x;p.y=p.transit.y;p.transit=null;}
    else {p.x+=dx/distance*stride;p.y+=dy/distance*stride;}
    p.vx=p.vy=0;p.grounded=false;p.jumpHeld=input.jump;return;
  }
  const superActive=hasEffect(p,'super',tick);
  const speedFactor=superActive || hasEffect(p,'speed',tick) ? 2 : 1;
  const jumpFactor=superActive ? 2 : hasEffect(p,'jump',tick) ? 1.5 : 1;
  const gravityFactor=hasEffect(p,'float',tick) ? 0.1 : superActive ? 0.75 : hasEffect(p,'jump',tick) ? 0.9 : 1;
  const oldX = p.x, oldBottom = p.y + PLAYER_HEIGHT, wasGrounded = p.grounded;
  p.coyote = wasGrounded ? MOVEMENT.coyoteTicks : Math.max(0, p.coyote - 1);
  p.jumpBuffer = input.jump && !p.jumpHeld ? MOVEMENT.bufferTicks : Math.max(0, p.jumpBuffer - 1);
  p.jumpHeld = input.jump;
  p.vx = (Number(input.right) - Number(input.left)) * MOVEMENT.speed * speedFactor;
  if (p.vx) p.facing = Math.sign(p.vx);
  if (p.jumpBuffer > 0 && p.coyote > 0) { p.vy = -MOVEMENT.jumpSpeed * jumpFactor; p.jumpBuffer = 0; p.coyote = 0; }
  p.x = Math.max(0, Math.min(1280 - PLAYER_WIDTH, p.x + p.vx * STEP_SECONDS));
  for(const platform of arena.platforms){
    if(platform.oneWay || p.vx===0) continue;
    const edge=p.vx>0?platform.x:platform.x+platform.width;
    const top=surfaceAt(platform,edge);
    if(oldBottom<=top+(platform.kind==='crate'?1e-7:1) || p.y>=undersideAt(platform,edge)-1e-7)continue;
    if(oldX+PLAYER_WIDTH<=edge && p.x+PLAYER_WIDTH>edge && p.vx>0){p.x=edge-PLAYER_WIDTH;p.vx=0;}
    if(oldX>=edge && p.x<edge && p.vx<0){p.x=edge;p.vx=0;}
  }
  p.vy = Math.min(MOVEMENT.maxFallSpeed, p.vy + MOVEMENT.gravity * gravityFactor * STEP_SECONDS);
  p.y += p.vy * STEP_SECONDS;
  p.grounded = false;
  if(p.vy<0){
    let ceiling=0;
    for(const platform of arena.platforms){
      if(platform.oneWay || p.x+PLAYER_WIDTH<=platform.x || p.x>=platform.x+platform.width)continue;
      const underside=undersideAt(platform,p.x+PLAYER_WIDTH/2);
      if(oldBottom-PLAYER_HEIGHT>=underside-0.1 && p.y<=underside)ceiling=Math.max(ceiling,underside);
    }
    if(p.y<ceiling){p.y=ceiling;p.vy=0;}
  }
  // Use the same swept top surfaces for slopes and jump-through ledges on both peers.
  if (p.vy >= 0) {
    let landing = Infinity;
    for (const platform of arena.platforms) {
      if (p.x + PLAYER_WIDTH <= platform.x || p.x >= platform.x + platform.width) continue;
      const before = surfaceAt(platform, oldX + PLAYER_WIDTH / 2);
      const after = surfaceAt(platform, p.x + PLAYER_WIDTH / 2);
      const wasOver = oldX + PLAYER_WIDTH > platform.x && oldX < platform.x + platform.width;
      const crossed = oldBottom <= before + 0.1 && p.y + PLAYER_HEIGHT >= after;
      const follow = wasGrounded && wasOver && Math.abs(oldBottom - before) < 0.5;
      if ((crossed || follow) && after < landing) landing = after;
    }
    if (landing < Infinity) { p.y = landing - PLAYER_HEIGHT; p.vy = 0; p.grounded = true; }
  }
  if(p.grounded && arena.pads.some(pad=>Math.abs(p.x+PLAYER_WIDTH/2-pad.x)<24 && Math.abs(p.y+PLAYER_HEIGHT-pad.y)<3)){
    p.vy=-OBJECT_LAUNCH_SPEED*1.8;p.grounded=false;p.coyote=0;
  }
}
function near(player:SimPlayer, point:Vec2, radius:number){
  return Math.abs(player.x+PLAYER_WIDTH/2-point.x)<PLAYER_WIDTH/2+radius &&
         Math.abs(player.y+PLAYER_HEIGHT/2-point.y)<PLAYER_HEIGHT/2+radius;
}
function applyPickup(state:MatchState,player:SimPlayer,kind:Buff){
  if(kind==='swap'){
    const others=state.players.filter(other=>other!==player && !other.transit);
    if(others.length){
      const other=others[choose(state,others.length)]!;
      [other.x,player.x]=[player.x,other.x];[other.y,player.y]=[player.y,other.y];
      other.warp++;player.warp++;
    }
  }else if(kind==='spring'){
    for(const other of state.players)if(other.grounded && !other.transit){
      other.vy=-OBJECT_LAUNCH_SPEED;other.grounded=false;other.coyote=0;
    }
  }else player.effects[kind]=state.tick+420;
}
function updateObjects(state:MatchState, arrived:boolean){
  const arena=ARENAS[state.mapId];
  if(arrived){
    state.portalReadyAt=state.tick+900;
    state.portalPair=(state.portalPair+1+choose(state,arena.portals.length-1))%arena.portals.length;
  }
  if(state.tick>=state.portalReadyAt && !state.players.some(p=>p.transit)){
    const pair=arena.portals[state.portalPair]!;
    for(const player of state.players){
      const end=pair.findIndex(point=>near(player,point,10));
      if(end<0)continue;
      const dest=pair[1-end]!;
      let exitY=dest.y-PLAYER_HEIGHT/2;
      for(const ledge of arena.platforms){
        if(dest.x<ledge.x || dest.x>ledge.x+ledge.width)continue;
        const top=surfaceAt(ledge,dest.x);
        if(dest.y<=top && exitY+PLAYER_HEIGHT>top)exitY=top-PLAYER_HEIGHT;
      }
      player.transit={x:dest.x-PLAYER_WIDTH/2,y:exitY};
      player.vx=player.vy=0;player.grounded=false;break;
    }
  }
  if(!state.buffsEnabled)return;
  if((state.tick+1)%480===0 && state.unusedSites.length){
    const [site]=state.unusedSites.splice(choose(state,state.unusedSites.length),1);
    state.pickups.push({site:site!,kind:BUFFS[choose(state,BUFFS.length)]!});
  }
  state.pickups=state.pickups.filter(item=>{
    const player=state.players.find(p=>!p.transit && near(p,arena.sites[item.site]!,8));
    if(!player)return true;
    applyPickup(state,player,item.kind);return false;
  });
}
/** Advance one deterministic tick in-place; state is JSON-serializable. */
export function stepMatch(state: MatchState, inputs: readonly Input[]): void {
  if (state.phase !== 'playing') return;
  const traveler=state.players.find(p=>p.transit);
  state.players.forEach((p,i) => movePlayer(p, inputs[i] ?? NO_INPUT,state.mapId,state.tick));
  updateObjects(state,!!traveler && !traveler.transit);
  state.tagLock = Math.max(0, state.tagLock - 1);
  const contacts: string[] = [];
  const oldIt = state.it;
  for (let i=0;i<state.players.length;i++) for (let j=i+1;j<state.players.length;j++) {
    const a=state.players[i]!, b=state.players[j]!, key=`${i}:${j}`;
    if (a.x < b.x + PLAYER_WIDTH && a.x + PLAYER_WIDTH > b.x && a.y < b.y + PLAYER_HEIGHT && a.y + PLAYER_HEIGHT > b.y) {
      contacts.push(key);
      if (!a.transit && !b.transit && !hasEffect(state.players[i===oldIt?j:i]!,'shield',state.tick) && (i===oldIt || j===oldIt) && !state.contacts.includes(key) && state.tagLock===0) {
        state.it=i===oldIt ? j : i; state.tags++; state.tagLock=TAG_LOCK_TICKS;
      }
    }
  }
  state.contacts = contacts;
  state.tick++;
  // A contact on the last tick resolves before expiry.
  if (state.tick >= state.durationTicks) { state.phase = 'over'; state.loser = state.it; }
}
