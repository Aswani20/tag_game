import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, stepMatch, NO_INPUT, ARENAS, movePlayer, GRASS_MAP, PLAYER_HEIGHT, PLAYER_WIDTH, surfaceAt } from '../dist/index.js';
const idle = [NO_INPUT, NO_INPUT];
const tick = (s, count, inputs = idle) => { for (let i=0;i<count;i++) stepMatch(s,inputs); };

test('players settle on the central spawn ledge and a held jump does not repeat', () => {
  const s=createMatch(60);tick(s,120);
  const p=s.players[0],standing=p.y;
  assert.equal(p.grounded,true);assert.ok(Math.abs(standing+PLAYER_HEIGHT-466.1)<0.01);
  p.x=655;
  const jump=[{...NO_INPUT,jump:true},NO_INPUT];
  tick(s,8,jump);assert.ok(p.y<standing-40);
  tick(s,120,jump);assert.equal(p.grounded,true);assert.equal(p.vy,0);
});
test('all four seats reach exactly 60% of the former unobstructed apex',()=>{
  const s=createMatch(60,4);
  for(const p of s.players){
    Object.assign(p,{x:500,y:270,grounded:true});
    let top=p.y;
    for(let i=0;i<40;i++){movePlayer(p,{...NO_INPUT,jump:i===0},'grass',i);top=Math.min(top,p.y);}
    assert.ok(Math.abs((270-top)/(149+5/6)-0.6)<1e-10);
  }
});
test('floor and world boundaries contain players', () => {
  const s=createMatch(60),p=s.players[0];
  Object.assign(p,{x:930,y:708,vy:0,grounded:false});
  tick(s,40);assert.equal(p.y+PLAYER_HEIGHT,754);
  p.x=10;tick(s,12,[{...NO_INPUT,left:true},NO_INPUT]);assert.equal(p.x,0);
});
test('fast falls land on narrow surfaces and solid undersides block jumps', () => {
  const s=createMatch(60),p=s.players[0];
  Object.assign(p,{x:510,y:466.1-PLAYER_HEIGHT-2,vy:1050,grounded:false});
  tick(s,1);assert.equal(p.y,466.1-PLAYER_HEIGHT);
  Object.assign(p,{x:510,y:480,vy:-760,grounded:false});
  tick(s,1);assert.equal(p.vy,0);assert.ok(Math.abs(p.y-477.3)<0.01);
});
test('desert translucent shelves permit passage up and support players falling down', () => {
  const s=createMatch(60,2,'desert'),p=s.players[0];
  Object.assign(p,{x:570,y:754-PLAYER_HEIGHT,vy:0,grounded:true});
  // This shelf now exceeds normal jump height; a jump pickup still clears it.
  p.effects.jump=120;
  tick(s,12,[{...NO_INPUT,jump:true},NO_INPUT]);assert.ok(p.y+PLAYER_HEIGHT<659.3);
  tick(s,100);assert.equal(p.grounded,true);assert.equal(p.y+PLAYER_HEIGHT,597.3);
});
test('grounded slope traversal follows the measured grass surface', () => {
  const s=createMatch(60),p=s.players[0];
  const slope=GRASS_MAP.platforms.find(p=>p.rampStart!==undefined && p.x+p.width-p.rampStart>160);
  p.x=slope.rampStart+12;p.y=surfaceAt(slope,p.x+PLAYER_WIDTH/2)-PLAYER_HEIGHT;p.grounded=true;
  tick(s,12,[{...NO_INPUT,right:true},NO_INPUT]);
  assert.ok(p.grounded);assert.ok(Math.abs(p.y+PLAYER_HEIGHT-surfaceAt(slope,p.x+PLAYER_WIDTH/2))<0.001);
});
test('tag transfers once on contact; overlap cannot ping-pong; separation allows re-tag', () => {
  const s=createMatch(60); s.players[0].x=s.players[1].x;
  stepMatch(s,idle); assert.equal(s.it,0); assert.equal(s.tags,1);
  tick(s,90); assert.equal(s.tags,1);
  s.players[0].x=470; stepMatch(s,idle);
  s.players[0].x=s.players[1].x; stepMatch(s,idle); assert.equal(s.it,1); assert.equal(s.tags,2);
});
test('all round lengths expire exactly and freeze; a fresh match resets state', () => {
  for (const duration of [60,120,180]) {
    const s=createMatch(duration); tick(s,duration*60-1); assert.equal(s.phase,'playing');
    stepMatch(s,idle); assert.equal(s.phase,'over'); assert.equal(s.loser,1);
    const frozen=JSON.stringify(s); tick(s,100); assert.equal(JSON.stringify(s),frozen);
    const fresh=createMatch(duration); assert.equal(fresh.tick,0); assert.equal(fresh.loser,null); assert.equal(fresh.tags,0);
  }
});
test('final-tick contact resolves before loser selection', () => {
  const s=createMatch(60); s.tick=s.durationTicks-1; s.players[0].x=s.players[1].x;
  stepMatch(s,idle); assert.equal(s.loser,0);
});
test('same inputs reproduce identical state, including JSON snapshot continuation', () => {
  const a=createMatch(60), b=createMatch(60);
  for(let i=0;i<1500;i++) {
    const inputs=[{left:i%200>100,right:i%200<=100,jump:i%43===0},{left:i%160<80,right:i%160>=80,jump:i%59===0}];
    stepMatch(a,inputs); stepMatch(b,inputs);
  }
  assert.deepEqual(a,b);
  const restored=JSON.parse(JSON.stringify(a)); tick(a,200); tick(restored,200); assert.deepEqual(a,restored);
});

test('every welded join stays grounded in both directions at normal and boosted speeds',()=>{
  for(const [mapId,arena] of Object.entries(ARENAS))for(const path of arena.platforms.filter(p=>p.rampStart!==undefined)){
    for(const boosted of [false,true]){
      const p=createMatch(60).players[0],start=path.rampStart-1-PLAYER_WIDTH/2;
      Object.assign(p,{x:start,y:path.y-PLAYER_HEIGHT,grounded:true});
      if(boosted)p.effects.speed=100;
      for(const direction of [1,-1])for(let tick=0;tick<3;tick++){
        const before=p.x;
        movePlayer(p,{left:direction<0,right:direction>0,jump:false},mapId,tick);
        assert.ok(p.grounded,mapId+' lost ground at '+path.rampStart);
        assert.ok(Math.abs(p.x-before-direction*(boosted?620:310)/60)<1e-6);
        assert.ok(Math.abs(p.y+PLAYER_HEIGHT-surfaceAt(path,p.x+PLAYER_WIDTH/2))<1e-6);
      }
      assert.ok(Math.abs(p.x-start)<1e-6);
    }
  }
});
