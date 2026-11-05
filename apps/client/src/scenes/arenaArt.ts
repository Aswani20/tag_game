import Phaser from 'phaser';
import { ARENAS, surfaceAt, undersideAt, type MapId, type Snapshot, type Buff } from '@tag/shared';

type Graphics = Phaser.GameObjects.Graphics;
const palettes = {
  grass: [0x4297f3,0x6adce8,0xf44391,0x6ada65,0xa5f273,0xf657be],
  snow: [0xa6aaf5,0xd8e2ff,0x9a9ddc,0xe7efff,0xffffff,0xffd83e],
  desert: [0x28e9ac,0xffab88,0xe6a55e,0xffce77,0xffe2a2,0x6960fd],
} as const;

function tree(g:Graphics,x:number,y:number,size:number,snow=false) {
  g.fillStyle(snow?0x848bc9:0xc92d8b).fillRect(x-5*size,y-61*size,10*size,61*size);
  g.lineStyle(5*size,snow?0x848bc9:0xc92d8b).lineBetween(x,y-20*size,x-19*size,y-38*size).lineBetween(x,y-17*size,x+18*size,y-33*size);
  g.fillStyle(snow?0xe7eaff:0x05cd7d).fillRoundedRect(x-24*size,y-80*size,48*size,36*size,8*size);
  g.fillStyle(snow?0xf4f5ff:0x22dd88).fillRoundedRect(x-30*size,y-50*size,23*size,16*size,5*size).fillRoundedRect(x+10*size,y-43*size,25*size,16*size,5*size);
}
function palm(g:Graphics,x:number,y:number,size:number) {
  g.lineStyle(7*size,0xbb8658).lineBetween(x,y,x+5*size,y-48*size);
  g.fillStyle(0x45b88b);
  for(const direction of [-1,1])for(const lift of [9,18]){
    const top=y-48*size;
    g.fillTriangle(x+5*size,top,x+(5+direction*17)*size,top-lift*size,x+(5+direction*33)*size,top+(lift-14)*size);
  }
}
function cactus(g:Graphics,x:number,y:number){
  g.fillStyle(0x42af82).fillRoundedRect(x-5,y-34,10,34,4).fillRoundedRect(x-14,y-23,6,15,3).fillRect(x-12,y-13,11,5).fillRoundedRect(x+7,y-29,6,16,3).fillRect(x+2,y-18,10,5);
}
function snowman(g:Graphics,x:number,y:number){
  g.fillStyle(0xf7fbff).fillCircle(x,y-9,10).fillCircle(x,y-24,8);
  g.fillStyle(0x3f566e).fillRect(x-6,y-37,12,6).fillRect(x-9,y-32,18,3).fillCircle(x+2,y-25,1);
  g.fillStyle(0xfc8853).fillTriangle(x+3,y-24,x+11,y-22,x+3,y-21);
  g.lineStyle(4,0xee6279).lineBetween(x-6,y-18,x+6,y-18);
}

// The same static foreground is drawn over local and remote runners. It has no collider.
const foregroundTrees: Record<MapId,readonly (readonly [number,number,number])[]> = {
  grass:[[740,466,.68],[1094,516,.7]],
  snow:[[560,683,.83]],
  desert:[],
};
export function paintForeground(g:Graphics,id:MapId){
  g.clear();
  for(const [x,y,size] of foregroundTrees[id]){
    tree(g,x,y,size,id==='snow');
    // A low branch provides opaque cover down to the grass or snow surface.
    g.fillStyle(id==='snow'?0xe7eaff:0x05cd7d)
      .fillRoundedRect(x-24*size,y-39*size,48*size,39*size,7*size);
  }
}
export function underTreeCover(id:MapId,x:number,y:number):boolean {
  return foregroundTrees[id].some(([cx,base,size])=>
    Math.abs(x-cx)<20*size && y<=base && y>=base-39*size);
}

export function paintArena(g:Graphics,id:MapId) {
  g.clear();
  const [sky,horizon,earth,cap,rim,pad]=palettes[id];
  g.fillGradientStyle(sky,sky,horizon,horizon).fillRect(0,0,1280,800);
  if(id==='grass'){
    g.fillStyle(0x578de0,.22);
    for(const x of [40,330,630,940,1190])g.fillRoundedRect(x,410,110,20,10).fillRect(x+12,426,18,220).fillRect(x+81,426,18,220);
  }
  g.fillStyle(id==='snow'?0x8389d3:id==='desert'?0xa6ac78:0x78c6e8,.35);
  for(const [x,y,w,h] of [[0,605,680,255],[485,690,780,365],[1090,615,540,280]])g.fillEllipse(x!,y!,w!,h!);
  // Distant silhouettes sit behind every playable surface.
  for(let i=0;i<7;i++){
    const x=i*219-44,y=425+Math.sin(i*2.3)*40;
    if(id==='snow'){
      g.fillStyle(0x909cda,.47).fillTriangle(x-175,610,x,y-68,x+208,610);
      g.fillStyle(0xe9edff,.62).fillPoints([{x:x-52,y:y-3},{x,y:y-68},{x:x+58,y:y+10},{x:x+18,y:y-10},{x:x-2,y:y+1},{x:x-19,y:y-17}],true);
    }else if(id==='desert'){
      g.fillStyle(0xb7b58d,.35).fillTriangle(x-115,570,x,y+5,x+126,570);
      g.fillStyle(0xffd4a0,.22).fillTriangle(x,y+5,x+126,570,x+19,570);
    }else{
      g.fillStyle(0x528ed8,.20).fillRoundedRect(x,y,95,15,6).fillRect(x+11,y+12,74,180);
    }
  }
  for(const [x,y,scale] of [[130,235,1],[1010,190,.76],[780,265,.5]]){
    g.fillStyle(0xffffff,id==='snow'?.28:.17)
     .fillEllipse(x!,y!,117*scale!,17*scale!).fillEllipse(x!-12*scale!,y!-5*scale!,50*scale!,22*scale!)
     .fillEllipse(x!+17*scale!,y!-9*scale!,39*scale!,27*scale!);
  }
  const arena=ARENAS[id];
  for(const p of arena.platforms){
    if(p.kind==='crate'){
      const {x,y,width,thickness=17}=p;
      g.fillStyle(0xfcb35c).fillRoundedRect(x,y,width,thickness,2);
      g.lineStyle(2,0xffd491).lineBetween(x+3,y+3,x+width-3,y+thickness-3);
      continue;
    }
    const depth=p.thickness ?? 11;
    const xs=p.rampStart===undefined?[p.x,p.x+p.width]:[p.x,p.rampStart,p.x+p.width];
    const top=xs.map(x=>({x,y:surfaceAt(p,x)}));
    const bottom=xs.map(x=>({x,y:undersideAt(p,x)}));
    g.fillStyle(earth).fillPoints([...top,...bottom.slice().reverse()],true);
    g.lineStyle(p.oneWay?2:5,cap,p.oneWay?.7:1).strokePoints(top.map(({x,y})=>({x,y:y+1})),false);
    g.lineStyle(1.5,rim).strokePoints(top,false);
    if(!p.oneWay && depth>7 && p.width>20){
      for(let offset=6;offset<p.width-8;offset+=id==='snow'?14:16){
        const x=p.x+offset, y=surfaceAt(p,x);
        if(id==='grass')g.fillStyle(cap).fillEllipse(x,y+2,10,6);
        else if(id==='snow')g.fillStyle(0xf2f5ff).fillRect(x,y+1,6,3);
        else g.fillStyle(cap).fillTriangle(x-4,y+1,x+5,y+1,x+1,y+5);
      }
      g.lineStyle(1.5,earth,.8).strokePoints(bottom,false);
    }
  }
  if(id==='grass'){
    tree(g,638,321,1);tree(g,133,676,.72);tree(g,175,410,.55);
    for(const [x,y] of [[220,535],[603,385],[350,610],[785,536],[1220,680],[800,754]]){
      g.lineStyle(2,0xbb388a).lineBetween(x!,y!,x!,y!-14);
      g.fillStyle(x!%2?0xff69a3:0xffd76a); for(let petal=0;petal<5;petal++)g.fillCircle(x!+Math.cos(petal*1.257)*3.5,y!-17+Math.sin(petal*1.257)*3.5,3.3);g.fillStyle(0xffffff).fillCircle(x!,y!-17,2.5);
    }
  }else if(id==='snow'){
    tree(g,695,383,.68,true);snowman(g,433,314);snowman(g,1022,754);
    g.lineStyle(8,0xffffff).lineBetween(909,558,909,517).beginPath().arc(903,517,6,Math.PI,2*Math.PI).strokePath();
    for(let y=526;y<556;y+=11)g.lineStyle(4,0xf45c69).lineBetween(905,y,913,y-4);
    for(const [x,y,dx,dy] of [[468,414,16,52],[529,542,75,-76],[1006,321,23,-45],[758,683,33,-52]]){
      g.lineStyle(2,0x595577).lineBetween(x!,y!,x!+dx!,y!+dy!);
      for(let i=1;i<6;i++)g.fillStyle(i%2?0xf86b76:0xffda66).fillCircle(x!+dx!*i/6,y!+dy!*i/6+2,2);
    }
  }else{
    palm(g,643,466,.9);palm(g,392,423,.68);palm(g,1116,754,1);cactus(g,920,403);cactus(g,475,540);cactus(g,1220,601);
    for(const [x,y,size] of [[869,540,34],[28,686,12]]){g.fillStyle(0xeeb966).fillTriangle(x!-size!,y!,x!,y!-size!*1.4,x!+size!,y!);g.fillStyle(0xffce7f).fillTriangle(x!,y!-size!*1.4,x!+size!,y!,x!+4,y!);}
    g.fillStyle(0xe5a761).fillRoundedRect(244,568,59,11,3).fillRect(262,550,22,19).fillEllipse(273,542,32,31);
    g.fillStyle(0xfac57b).fillTriangle(254,553,263,525,276,546).fillTriangle(277,545,284,525,292,554);
  }
  if(id==='grass'){
    for(const [x,y] of [[578,536],[317,610],[972,327],[166,754]])g.fillStyle(0x3fdf88).fillRoundedRect(x!,y!-12,29,12,{tl:14,tr:14,bl:0,br:0});
  }else if(id==='snow'){
    for(const [x,y] of [[1074,275],[483,543],[780,630],[1204,608],[600,754]])g.fillStyle(0xf5f6ff).fillEllipse(x!,y!-3,43,10).fillEllipse(x!+8,y!-6,23,12);
  }else{
    for(const [x,y] of [[455,540],[287,659],[1150,600],[644,754]])g.fillStyle(0xe8b87c).fillEllipse(x!,y!-2,16,4).fillEllipse(x!+16,y!-1,6,3);
  }
  for(const p of arena.pads){
    g.fillStyle(0x57446e,.38).fillRoundedRect(p.x-21,p.y-5,42,7,3);
    g.fillStyle(pad).fillRoundedRect(p.x-18,p.y-13,36,13,{tl:8,tr:8,bl:2,br:2});
    g.fillStyle(0xffffff,.56).fillRoundedRect(p.x-12,p.y-10,24,8,4);
    g.fillStyle(0xffffff,.84).fillEllipse(p.x-6,p.y-9,7,2);
  }
}

export const BUFF_LABELS:Record<Buff,string>={speed:'Speed',jump:'Jump',swap:'Swap',shield:'Shield',super:'Super',float:'Float',spring:'Group jump',fade:'Fade'};
const symbols:Record<Buff,string>={speed:'»',jump:'↑',swap:'⇄',shield:'◇',super:'★',float:'☁',spring:'⇈',fade:'◌'};
export function paintTriggers(g:Graphics, labels:Phaser.GameObjects.Text[], scene:Phaser.Scene,state:Snapshot['state']|undefined){
  g.clear();
  if(!state){labels.forEach(t=>t.setVisible(false));return;}
  const arena=ARENAS[state.mapId];
  if(state.tick>=state.portalReadyAt){
    for(const point of arena.portals[state.portalPair]!){
      g.fillStyle(0x8bffff,.14).fillCircle(point.x,point.y,15);
      g.fillStyle(0x493e8c,.88).fillCircle(point.x,point.y,9);
      g.fillStyle(0xffa74c).fillCircle(point.x,point.y,4.5);
      for(let i=0;i<3;i++){const start=state.tick*.055+i*2*Math.PI/3;
        const color=[0x71fff1,0xffc357,0xef68da][i]!;
        g.lineStyle(2.2,color).beginPath();
        for(let j=0;j<=8;j++){const r=3+j*.95,a=start+j*.32;
          const x=point.x+Math.cos(a)*r,y=point.y+Math.sin(a)*r;
          if(j===0)g.moveTo(x,y);else g.lineTo(x,y);}
        g.strokePath();}
    }
  }
  for(const pad of arena.pads){
    const launched=state.players.find(p=>p.vy< -850 && Math.abs(p.x+8-pad.x)<27 && Math.abs(p.y+22-pad.y)<74);
    if(launched){
      const rise=Math.abs(launched.y+22-pad.y);
      g.lineStyle(2,0xffffff,Math.max(0,1-rise/75));
      for(const dx of [-12,0,12])g.lineBetween(pad.x+dx,pad.y-17-rise*.15,pad.x+dx*1.3,pad.y-23-rise*.24);
    }
  }
  state.pickups.forEach(({site,kind},i)=>{
    const point=arena.sites[site]!,y=point.y+Math.sin(state.tick*.08+site)*2;
    g.fillStyle(0x236caa,.95).fillCircle(point.x,y,10);g.lineStyle(1.5,0xa9f5ff).strokeCircle(point.x,y,10);
    const label=labels[i] ?? (labels[i]=scene.add.text(0,0,'',{fontFamily:'sans-serif',fontSize:'15px',color:'#fff'}).setOrigin(.5).setDepth(5));
    label.setVisible(true).setPosition(point.x,y).setText(symbols[kind]);
  });
  labels.slice(state.pickups.length).forEach(l=>l.setVisible(false));
}
