import Phaser from 'phaser';
import { ARENAS, PLAYER_HEIGHT, PLAYER_WIDTH, type Snapshot, type SimPlayer } from '@tag/shared';

type Cue = 'click'|'go'|'jump'|'land'|'tag'|'pad'|'portal'|'pickup'|'count'|'win'|'lose';
type Note = [number,number,number,number,OscillatorType?]; // delay, start Hz, end Hz, seconds
const cues:Record<Cue,Note[]>={
  click:[[0,520,720,.055]], go:[[0,400,550,.07],[.08,650,860,.15]],
  jump:[[0,310,720,.095]],land:[[0,170,86,.045,'triangle']],
  tag:[[0,880,370,.085,'triangle'],[.075,440,920,.12]],
  pad:[[0,150,600,.12,'triangle'],[.1,480,1050,.13]],
  portal:[[0,240,1020,.18],[.14,930,310,.16]],
  pickup:[[0,740,940,.08],[.065,1050,1350,.13]], count:[[0,640,590,.07]],
  win:[[0,523,523,.12],[.12,659,659,.12],[.24,784,980,.25]],
  lose:[[0,490,430,.12,'triangle'],[.12,375,310,.14,'triangle'],[.26,275,175,.27,'triangle']],
};

export class GameSound {
  muted=localStorage.getItem('tag-muted')==='yes';
  private context?:AudioContext;
  private voices=0;
  unlock=()=> {
    if(this.muted)return;
    try {
      this.context ??= new AudioContext();
      if(this.context.state==='suspended')void this.context.resume().catch(()=>{});
    }catch{/* Audio is optional on devices without Web Audio. */}
  };
  toggle(){this.muted=!this.muted;localStorage.setItem('tag-muted',this.muted?'yes':'no');if(!this.muted){this.unlock();this.play('click');}}
  play(cue:Cue){
    const ctx=this.context;
    if(!ctx || ctx.state!=='running' || this.muted || document.hidden || this.voices>=8)return;
    for(const [delay,frequency,end,length,type] of cues[cue]){
      const start=ctx.currentTime+delay, osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type=type ?? 'sine';osc.frequency.setValueAtTime(frequency,start);
      osc.frequency.exponentialRampToValueAtTime(end,start+length);
      gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(cue==='land'?.024:.055,start+.009);
      gain.gain.exponentialRampToValueAtTime(.0001,start+length);
      osc.connect(gain);gain.connect(ctx.destination);this.voices++;
      osc.onended=()=>{osc.disconnect();gain.disconnect();this.voices--;};
      osc.start(start);osc.stop(start+length+.01);
    }
  }
}

interface Puff {x:number;y:number;vx:number;vy:number;life:number;max:number;size:number;color:number}
interface Seen {ground:boolean;vy:number;transit:boolean;warp:number;dust:number}
export class Feedback {
  private dots:Puff[]=[];
  private seen:Seen[]=[];
  private tagUntil=0;
  private previousTags=0;
  private seconds=0;
  private items=new Set<number>();
  private lastTick=-1;
  private round=-1;
  private ended=false;
  readonly reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor(private g:Phaser.GameObjects.Graphics,readonly sound:GameSound){}
  private burst(x:number,y:number,color:number,count:number,power:number){
    if(this.reduced)return;
    for(let i=0;i<count && this.dots.length<48;i++){
      const angle=Math.PI*2*i/count-.6,life=.18+(i%3)*.045;
      this.dots.push({x,y,vx:Math.cos(angle)*power,vy:Math.sin(angle)*power-12,life,max:life,size:2+(i%3),color});
    }
  }
  draw(state:Snapshot['state']|undefined,round:number,players:SimPlayer[],own:number,time:number,delta:number){
    this.g.clear();if(!state){this.round=-1;this.dots.length=0;return;}
    const fresh=round!==this.round;
    if(fresh){this.round=round;this.previousTags=state.tags;this.seen=[];this.items.clear();this.dots.length=0;this.ended=false;this.seconds=0;this.lastTick=-1;
      if(state.tick<60)this.sound.play('go');}
    const sec=Math.ceil((state.durationTicks-state.tick)/60);
    if(sec!==this.seconds && sec>0 && sec<=3)this.sound.play('count');
    this.seconds=sec;
    if(state.tags!==this.previousTags){
      this.previousTags=state.tags;this.tagUntil=time+320;this.sound.play('tag');
      const p=players[state.it];if(p)this.burst(p.x+8,p.y+10,0xffe77d,14,93);
    }
    if(!this.ended && state.phase==='over'){this.ended=true;this.sound.play(state.loser===own?'lose':'win');}
    if(this.lastTick!==state.tick){
      const next=new Set(state.pickups.map(i=>i.site));
      for(const site of this.items)if(!next.has(site)){const pt=ARENAS[state.mapId].sites[site]!;this.burst(pt.x,pt.y,0x9effee,8,54);this.sound.play('pickup');}
      this.items=next;this.lastTick=state.tick;
    }
    for(let i=0;i<players.length;i++){
      const p=players[i]!,x=p.x+PLAYER_WIDTH/2,y=p.y+PLAYER_HEIGHT;
      const last=this.seen[i] ?? {ground:p.grounded,vy:p.vy,transit:!!p.transit,warp:p.warp,dust:time};
      if(!fresh){
        if(p.transit && !last.transit || p.warp!==last.warp){this.burst(x,y-9,0x9dffff,10,71);this.sound.play('portal');}
        if(p.vy< -300 && last.vy>=-1 && !p.transit){
          const pad=ARENAS[state.mapId].pads.some(pt=>Math.abs(pt.x-x)<32 && Math.abs(pt.y-y)<75);
          this.burst(x,y,pad?0xffe59c:0xffffff,pad?9:5,35);
          if(i===own || pad)this.sound.play(pad?'pad':'jump');
        }
        if(!last.ground && p.grounded){this.burst(x,y,0xffffff,5,34);if(i===own)this.sound.play('land');}
        if(p.grounded && p.vx && time-last.dust>130){this.burst(x-7*p.facing,y-1,0xffffff,2,17);last.dust=time;}
      }
      last.ground=p.grounded;last.vy=p.vy;last.transit=!!p.transit;last.warp=p.warp;this.seen[i]=last;
      if(i===state.it && time<this.tagUntil && !this.reduced){
        const t=1-(this.tagUntil-time)/320;this.g.lineStyle(2,0xffffff,1-t).strokeCircle(x,y-10,13+t*23);
      }
    }
    const dt=Math.min(delta,50)/1000;
    for(let i=this.dots.length-1;i>=0;i--){const d=this.dots[i]!;d.life-=dt;if(d.life<=0){this.dots.splice(i,1);continue;}
      d.x+=d.vx*dt;d.y+=d.vy*dt;d.vy+=75*dt;
      this.g.fillStyle(d.color,d.life/d.max*.8).fillCircle(d.x,d.y,d.size*d.life/d.max);}
  }
}
