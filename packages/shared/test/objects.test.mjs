import test from 'node:test';
import assert from 'node:assert/strict';
import { MOVEMENT, STEP_SECONDS, ARENAS, BUFFS, PLAYER_WIDTH, PLAYER_HEIGHT, createMatch, stepMatch, NO_INPUT, hasEffect } from '../dist/index.js';
const idle=[NO_INPUT,NO_INPUT];
for(const kind of BUFFS)test('pickup applies '+kind+' on the authoritative tick',()=>{
  const s=createMatch(60,2,'grass',true);
  const site=ARENAS.grass.sites[0],p=s.players[0],other=s.players[1];
  p.x=site.x-PLAYER_WIDTH/2;p.y=466.1-PLAYER_HEIGHT;p.grounded=true;
  other.x=705;other.y=p.y;other.grounded=true;
  s.pickups.push({site:0,kind});stepMatch(s,idle);
  assert.equal(s.pickups.length,0);
  if(kind==='swap'){assert.equal(p.x,705);assert.equal(other.warp,1);return;}
  if(kind==='spring'){assert.ok(p.vy<0 && other.vy<0);return;}
  assert.ok(hasEffect(p,kind,s.tick));assert.equal(p.effects[kind],420);
  if(kind==='speed' || kind==='super'){
    stepMatch(s,[{...NO_INPUT,right:true},NO_INPUT]);assert.equal(p.vx,620);
  }
  if(kind==='jump' || kind==='super'){
    stepMatch(s,[{...NO_INPUT,jump:true},NO_INPUT]);assert.equal(p.vy,-MOVEMENT.jumpSpeed*(kind==='super'?2:1.5)+MOVEMENT.gravity*(kind==='super'?.75:.9)*STEP_SECONDS);
  }
  if(kind==='float'){p.grounded=false;p.y=200;p.vy=0;stepMatch(s,idle);assert.ok(p.vy>0 && p.vy<4);}
  if(kind==='shield'){other.x=p.x;other.y=p.y;stepMatch(s,idle);assert.equal(s.it,1);}
  while(s.tick<420)stepMatch(s,idle);
  assert.equal(hasEffect(p,kind,s.tick),false);
});
test('seeded spawners yield one pickup per eight seconds without reusing sites',()=>{
  const s=createMatch(180,2,'snow',true,183),seen=new Set();
  for(let cycle=0;cycle<12;cycle++){
    s.tick=(cycle+1)*480-1;stepMatch(s,idle);
    const used=ARENAS.snow.sites.map((_,i)=>i).filter(i=>!s.unusedSites.includes(i));
    assert.equal(used.length,cycle+1);used.forEach(i=>seen.add(i));
  }
  assert.equal(seen.size,12);
});
