import { BAND, portrait, runnerArt } from './runnerArt';
import { gardenCast, speakerIcon, titleArt } from './menuArt';
import { Feedback, GameSound } from './feedback';
import { paintForeground, underTreeCover, paintArena, paintTriggers, BUFF_LABELS } from './arenaArt';
import Phaser from 'phaser';
import { ARENAS, BUFFS, PLAYER_WIDTH, PLAYER_HEIGHT, hasEffect, type MapId, type ArenaSettings, type Snapshot } from '@tag/shared';
import { OnlineGame } from '../network/OnlineGame';

const colors=BAND.map(hex=>parseInt(hex.slice(1),16));
const colorNames=['RED','BLUE','YELLOW','GREEN'];
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

export class GameScene extends Phaser.Scene {
  private net=new OnlineGame();
  private foreground!:Phaser.GameObjects.Graphics;
  private background!:Phaser.GameObjects.RenderTexture;
  private soundFx=new GameSound();
  private feedback!:Feedback;
  private entry:'home'|'create'|'join'=new URLSearchParams(location.search).has('room')?'join':'home';
  private connection!:HTMLElement;
  private ui!:HTMLElement;
  private labelCache:string[]=[];
  private previousRound=-1;
  private taggedAt=0;
  private lastTags=-1;
  private lastGround:boolean[]=[];
  private liftedAt:number[]=[];
  private standingY:number[]=[];
  private landedAt:number[]=[];
  private objects!:Phaser.GameObjects.Graphics;
  private triggerFrame:Snapshot['state']|undefined;
  private pickupLabels:Phaser.GameObjects.Text[]=[];
  private painted:MapId='grass';
  private bodies:Phaser.GameObjects.Container[]=[];
  private labels:Phaser.GameObjects.Text[]=[];
  private marker!:Phaser.GameObjects.Graphics;
  private keys!:Record<string,Phaser.Input.Keyboard.Key>;
  private panel!:HTMLElement;
  private timer!:HTMLElement;
  private badge!:HTMLElement;
  private menu=false;
  private nickname=sessionStorage.getItem('tag-name') ?? '';
  private code=new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';

  constructor(){super('game');}
  preload():void {
    for(let slot=0;slot<BAND.length;slot++){
      this.load.image('runner-'+slot,'data:image/svg+xml;base64,'+btoa(runnerArt(slot)));
    }
  }
  private drawArena(map:MapId){
    const brush=this.make.graphics({},false);
    paintArena(brush,map);
    this.background.clear().draw(brush);
    paintForeground(this.foreground,map);
    brush.destroy();
  }
  create():void {
    this.background=this.add.renderTexture(0,0,1280,800).setOrigin(0).setDepth(-2);
    this.objects=this.add.graphics().setDepth(4);
    this.foreground=this.add.graphics().setDepth(25);
    this.drawArena(this.painted);
    this.bodies=colors.map((_,slot)=>this.character(slot).setVisible(false));
    this.labels=colors.map(()=>this.add.text(0,0,'',{fontFamily:'sans-serif',fontSize:'12px',color:'#ffffff',backgroundColor:'#193e5188',padding:{x:5,y:2}}).setOrigin(.5,0).setDepth(22).setVisible(false));
    this.marker=this.add.graphics().setDepth(20);
    this.feedback=new Feedback(this.add.graphics().setDepth(18),this.soundFx);
    this.keys=this.input.keyboard!.addKeys('A,D,W,LEFT,RIGHT,UP',false) as Record<string,Phaser.Input.Keyboard.Key>;
    document.querySelector('#ui')?.remove();
    const ui=document.createElement('div');ui.id='ui';
    ui.innerHTML=`<header class="hud"><div class="brand">TAG<span id="arena-name">GRASS GARDENS</span></div><div class="clock"><span id="timer">60</span><small>SECONDS</small></div><div class="status"><span id="it-badge">ONLINE</span><button id="sound" aria-label="Toggle sound"></button><button id="pause" aria-label="Room menu">☰</button></div></header><div id="panel" class="panel"></div><footer><span>W A D <i>or</i> ← ↑ →</span><span class="local">ONLINE · 2–4 PLAYERS</span><span id="connection">CONNECTING</span></footer>`;
    document.body.append(ui);
    this.ui=ui;this.connection=ui.querySelector('#connection')!;
    const soundButton=ui.querySelector<HTMLButtonElement>('#sound')!;
    const showSound=()=>{
      soundButton.innerHTML=speakerIcon(this.soundFx.muted);
      soundButton.setAttribute('aria-label',this.soundFx.muted?'Unmute sounds':'Mute sounds');
      soundButton.setAttribute('aria-pressed',String(!this.soundFx.muted));
    };
    showSound();soundButton.onclick=()=>{this.soundFx.toggle();showSound();};
    ui.addEventListener('pointerdown',this.soundFx.unlock,{passive:true});
    ui.addEventListener('keydown',this.soundFx.unlock);
    ui.addEventListener('click',event=>{
      const target=(event.target as Element).closest('button');
      if(target && target.id!=='sound')this.soundFx.play('click');
    });
    this.panel=ui.querySelector('#panel')!;this.timer=ui.querySelector('#timer')!;this.badge=ui.querySelector('#it-badge')!;
    ui.querySelector('#pause')!.addEventListener('click',()=>this.toggleMenu());
    this.input.keyboard!.on('keydown-ESC',()=>this.toggleMenu());
    this.game.events.on(Phaser.Core.Events.BLUR,()=>{this.input.keyboard?.resetKeys();this.net.neutral();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.input.keyboard?.resetKeys();this.net.neutral();}});
    this.net.onUI=()=>this.showUI();this.showUI();this.net.socket.connect();
  }
  private toggleMenu(){if(this.net.room?.phase==='playing'){this.menu=!this.menu;this.net.neutral();this.input.keyboard!.resetKeys();this.showUI();}}
  private button(id:string,fn:()=>void){const el=this.panel.querySelector<HTMLButtonElement>('#'+id);if(el)el.onclick=()=>{fn();(document.activeElement as HTMLElement|null)?.blur();};}
  private leave(){this.net.socket.emit('room:leave',r=>{if(r.ok){this.net.forget();this.menu=false;this.entry='home';history.replaceState(null,'',location.pathname);this.code='';}this.net.reply(r);});}
  private showUI():void {
    const n=this.net,r=n.room,me=r?.members.find(m=>m.id===n.session?.playerId),host=r?.hostId===me?.id;
    this.panel.hidden=false;
    const message=n.notice || r?.notice || '';
    const note=message?`<p class="net-notice" role="status">${escape(message)}</p>`:'';
    this.ui.dataset.screen=!r?'entry':r.phase==='over'?'result':r.phase;
    if(!r){
      if(this.entry==='home'){
        this.panel.innerHTML=`<div class="garden-screen">${gardenCast()}<section class="title-stack"><h1 class="game-title">${titleArt}</h1><div class="menu-plinth"><button id="new-room" class="arcade red-action">Create room</button><button id="join-room" class="arcade blue-action">Join room</button></div><div class="key-guide"><kbd>A</kbd><kbd>D</kbd> move <b>·</b> <kbd>W</kbd> jump <b>·</b> or arrow keys</div>${note}</section></div>`;
        this.button('new-room',()=>{this.entry='create';this.showUI();});
        this.button('join-room',()=>{this.entry='join';this.showUI();});
      }else{
        const join=this.entry==='join';
        this.panel.innerHTML=`<div class="garden-screen">${gardenCast()}<form id="entry-form" class="card entry-form"><div class="form-hero">${portrait(join?1:0)}</div><h1>${join?'Join room':'Create room'}</h1>${note}<label for="nickname">Nickname</label><input id="nickname" maxlength="20" required placeholder="Your name" value="${escape(this.nickname)}">${join?`<label for="code">Room code</label><input id="code" maxlength="6" minlength="6" required placeholder="6-character code" value="${escape(this.code)}">`:''}<button class="arcade ${join?'blue-action':'red-action'}" type="submit" ${!n.connected?'disabled':''}>${join?'Join room':'Create room'}</button><button id="back" class="secondary" type="button">← Back</button></form></div>`;
        this.panel.querySelector<HTMLInputElement>('#nickname')!.oninput=e=>{this.nickname=(e.target as HTMLInputElement).value;sessionStorage.setItem('tag-name',this.nickname);};
        const code=this.panel.querySelector<HTMLInputElement>('#code');
        if(code)code.oninput=()=>{this.code=code.value.trim().toUpperCase();};
        this.panel.querySelector<HTMLFormElement>('#entry-form')!.onsubmit=e=>{e.preventDefault();this.soundFx.unlock();n.enter(this.nickname,join?this.code:undefined);};
        this.button('back',()=>{this.entry='home';this.showUI();});
      }
      return;
    }
    const invite=new URL(location.href);invite.search='';invite.searchParams.set('room',r.code);
    if(!n.connected){this.panel.innerHTML=`<section class="card compact"><h1>Reconnecting…</h1>${note}<p>The server keeps the match running.<br>Your seat is reserved for 30 seconds.</p></section>`;return;}
    if(r.phase==='playing' && !this.menu){this.panel.hidden=true;return;}
    if(r.phase==='playing'){
      this.panel.innerHTML=`<section class="card compact"><div class="eyebrow">ROOM ${r.code}</div><h1>Room menu</h1><p>The online match continues while this menu is open.</p><button id="resume" class="primary">BACK TO THE CHASE →</button>${host?'<button id="lobby" class="secondary">RETURN TO LOBBY</button>':''}<button id="leave" class="secondary">LEAVE ROOM</button></section>`;
      this.button('resume',()=>{this.menu=false;this.showUI();});this.button('lobby',()=>n.socket.emit('room:lobby',n.reply));this.button('leave',()=>this.leave());return;
    }
    if(r.phase==='over'){
      const loser=r.members.find(m=>m.id===r.roster[n.latest?.state.loser ?? -1]);
      this.panel.innerHTML=`<section class="result-layout"><div class="result-actions"><h1>Game over</h1><p>${loser?.id===me?.id?'You were IT when time ran out.':`${escape(loser?.nickname ?? 'The tagged player')} was IT when time ran out.`}</p>${note}${host?'<button id="again" class="arcade green-action">Play again</button><button id="lobby" class="arcade blue-action">Return to lobby</button>':'<p>Waiting for the host.</p>'}<button id="leave" class="secondary">Leave room</button></div><div class="loser-portrait" style="--band:${BAND[loser?.color ?? 0]}"><b>IT</b>${portrait(loser?.color ?? 0,true)}<strong>${escape(loser?.nickname ?? '')}</strong></div></section>`;
      this.button('again',()=>n.socket.emit('room:start',n.reply));this.button('lobby',()=>n.socket.emit('room:lobby',n.reply));this.button('leave',()=>this.leave());return;
    }
    this.menu=false;
    const settingsControls=`<div class="arena-controls"><label>Arena <select id="arena-choice" ${host?'':'disabled'}>${Object.entries(ARENAS).map(([id,arena])=>`<option value="${id}" ${r.mapId===id?'selected':''}>${arena.name}</option>`).join('')}</select></label><label><input id="buff-choice" type="checkbox" ${r.buffsEnabled?'checked':''} ${host?'':'disabled'}> Buffs</label></div>`;
    this.panel.innerHTML=`<section class="card lobby"><div class="lobby-heading"><strong>Lobby</strong><small>Room code</small></div><h1 class="room-code">${r.code}</h1><div class="invite-row"><input id="invite" aria-label="Invitation link" readonly value="${escape(invite.href)}"><button id="copy">COPY LINK</button></div><ul class="players">${r.members.map(m=>`<li><span class="seat-avatar">${portrait(m.color)}</span><span>${escape(m.nickname)}${m.id===me?.id?' (you)':''}<small>${colorNames[m.color]}${m.id===r.hostId?' · HOST':''}</small></span><b class="${m.ready?'is-ready':''}">${!m.connected?'Reconnecting':m.ready?'Ready ✓':'Not ready'}</b></li>`).join('')}</ul>${note}${settingsControls}<div class="duration-label">ROUND LENGTH ${host?'':'· HOST CONTROLS'}</div><div class="durations">${[60,120,180].map(d=>`<button data-duration="${d}" class="${r.duration===d?'selected':''}" ${!host?'disabled':''}>${d}<small> sec</small></button>`).join('')}</div><button id="ready" class="${me?.ready?'secondary':'primary'}">${me?.ready?'NOT READY':'I’M READY ✓'}</button>${host?`<button id="start" class="${me?.ready?'primary':'secondary'}" ${r.members.length<2 || r.members.some(m=>!m.ready || !m.connected)?'disabled':''}>START GAME →</button>`:'<p class="hint">The host starts when everyone is ready.</p>'}<button id="leave" class="secondary">LEAVE ROOM</button></section>`;
    this.button('copy',()=>{if(!navigator.clipboard){this.panel.querySelector<HTMLInputElement>('#invite')?.select();return;}navigator.clipboard.writeText(invite.href).then(()=>{const b=this.panel.querySelector('#copy');if(b)b.textContent='COPIED';}).catch(()=>{this.panel.querySelector<HTMLInputElement>('#invite')?.select();});});
    const settings=(patch:Partial<ArenaSettings>)=>n.socket.emit('room:settings',{mapId:r.mapId,buffsEnabled:r.buffsEnabled,duration:r.duration,...patch},n.reply);
    this.panel.querySelector<HTMLSelectElement>('#arena-choice')!.onchange=e=>settings({mapId:(e.target as HTMLSelectElement).value as MapId});
    this.panel.querySelector<HTMLInputElement>('#buff-choice')!.onchange=e=>settings({buffsEnabled:(e.target as HTMLInputElement).checked});
    this.panel.querySelectorAll<HTMLButtonElement>('[data-duration]').forEach(b=>b.onclick=()=>settings({duration:Number(b.dataset.duration) as 60|120|180}));
    this.button('ready',()=>n.socket.emit('room:ready',!me?.ready,n.reply));this.button('start',()=>n.socket.emit('room:start',n.reply));this.button('leave',()=>this.leave());
  }
  update(_time:number,delta:number):void {
    const k=this.keys;if(!k)return;
    const allowed=!this.menu && this.panel.hidden;
    this.net.tick(delta,{left:allowed && (k.A!.isDown || k.LEFT!.isDown),right:allowed && (k.D!.isDown || k.RIGHT!.isDown),jump:allowed && (k.W!.isDown || k.UP!.isDown)});
    const n=this.net,s=n.latest?.state,r=n.room;
    const mapId=s?.mapId ?? r?.mapId ?? 'grass';
    if(mapId!==this.painted){
      this.drawArena(mapId);
      this.painted=mapId;
      document.querySelector('#arena-name')!.textContent=ARENAS[mapId].name.toUpperCase();
    }
    if(this.triggerFrame!==s){paintTriggers(this.objects,this.pickupLabels,this,s);this.triggerFrame=s;}
    const seconds=String(s?Math.ceil((s.durationTicks-s.tick)/60):r?.duration ?? 60);
    if(this.timer.textContent!==seconds)this.timer.textContent=seconds;
    this.timer.classList.toggle('urgent',!!s && s.durationTicks-s.tick<=600);
    const it=r?.members.find(m=>m.id===r.roster[s?.it ?? -1]);
    const badge=it?`${it.nickname} IS IT`:r?`ROOM ${r.code}`:'ONLINE';
    if(this.badge.textContent!==badge){this.badge.textContent=badge;this.badge.style.setProperty('--band',it?BAND[it.color]!:'#fff');}
    const status=n.connected?(r?`${r.members.filter(m=>m.connected).length} CONNECTED`:'CONNECTED'):'RECONNECTING';
    if(this.connection.textContent!==status)this.connection.textContent=status;
    this.marker.clear();
    const players=n.renderedPlayers();
    const activeColors=r?.roster.map(id=>r.members.find(m=>m.id===id)?.color) ?? [];
    this.bodies.forEach((body,i)=>{if(!activeColors.includes(i) || !s){body.setVisible(false);this.labels[i]!.setVisible(false);}});
    this.feedback.draw(s,r?.round ?? 0,players,n.index,_time,delta);
    if(this.previousRound!==r?.round){this.previousRound=r?.round ?? -1;this.lastTags=s?.tags ?? 0;this.lastGround=[];this.landedAt=[];this.liftedAt=[];this.standingY=[];}
    if(s && this.lastTags!==s.tags){this.lastTags=s.tags;this.taggedAt=_time;}
    this.followPlayers(players);
    players.forEach((p,i)=>{
      const member=r?.members.find(m=>m.id===r.roster[i]);if(!member)return;
      const body=this.bodies[member.color]!,x=p.x+PLAYER_WIDTH/2,y=p.y+PLAYER_HEIGHT-4;
      body.setVisible(true).setPosition(x,y).setScale(p.facing*.7,.7).setDepth(s?.it===i?11:10).setAlpha((member.connected?1:.45)*(hasEffect(p,'fade',s?.tick ?? 0)?.25:1));
      const feet=body.getData('feet') as Phaser.GameObjects.Rectangle[];
      const moving=p.grounded && Math.abs(p.vx)>1;
      const phase=_time*.021+i;
      const stride=moving?Math.sin(phase):0;
      const reduced=this.feedback.reduced;
      if(this.lastGround[i]===false && p.grounded)this.landedAt[i]=_time;
      if(this.lastGround[i] && !p.grounded && p.vy<0)this.liftedAt[i]=_time;
      if(p.grounded){this.standingY[i]=y;this.liftedAt[i]=-Infinity;}
      this.lastGround[i]=p.grounded;
      const lift=Math.min(1,(_time-(this.liftedAt[i] ?? -Infinity))/70);
      const land=Math.min(1,(_time-(this.landedAt[i] ?? -Infinity))/95);
      const release=lift*lift*(3-2*lift);
      // Anticipation holds only the painted feet; the predicted jump starts immediately.
      if(!reduced && !p.transit && lift<1)body.y=y+Math.max(0,Math.min(18,(this.standingY[i] ?? y)-y))*(1-release);
      const compress=p.grounded?.075*Math.sin(Math.PI*land)**2:.06*Math.sin(Math.PI*lift)**2;
      const stretch=p.grounded?0:.055*Math.min(1,Math.max(0,-p.vy)/560)*release;
      const pose=reduced?0:stretch-compress;
      body.setScale(p.facing*.7*(1-pose),.7*(1+pose));
      body.rotation=reduced?0:p.transit?Math.sin(_time*.025)*.35:!p.grounded?p.vx/3900:moving?.055*p.facing:0;
      feet[0]!.setPosition(-6-stride*3,2+stride*3).setRotation(-stride*.55);
      feet[1]!.setPosition(6+stride*3,2-stride*3).setRotation(stride*.55);
      const face=body.getData('face') as Phaser.GameObjects.Image;
      face.y=-18+(reduced?0:moving?-Math.abs(stride)*2:Math.sin(_time*.004+i)*.45);
      const effects=BUFFS.filter(kind=>hasEffect(p,kind,s?.tick ?? 0)).map(kind=>BUFF_LABELS[kind]);
      if(hasEffect(p,'shield',s?.tick ?? 0))this.marker.lineStyle(2,0x66fbff,.9).strokeCircle(x,y-13,23);
      if(p.transit)this.marker.lineStyle(3,0xffef91).strokeCircle(x,y-13,24);
      const label=member.nickname+(member.id===n.session?.playerId?' · YOU':'')+(effects.length?' · '+effects.join(' + '):'');
      const hidden=underTreeCover(mapId,x,p.y+PLAYER_HEIGHT/2);
      const caption=this.labels[member.color]!.setVisible(!hidden).setAlpha(body.alpha).setPosition(x,y+10);
      if(this.labelCache[member.color]!==label){caption.setText(label);this.labelCache[member.color]=label;}
      if(s?.it===i && !hidden){
        const arrowY=y-37+(reduced?0:Math.sin(_time*.007)*1.8);
        this.marker.fillStyle(0x284257,.35).fillTriangle(x-7,arrowY+1,x+7,arrowY+1,x,arrowY+10);
        this.marker.fillStyle(0xffffff).fillTriangle(x-7,arrowY,x+7,arrowY,x,arrowY+8);
        if(!reduced && _time-this.taggedAt<280 && s.tags>0)body.rotation+=Math.sin((_time-this.taggedAt)*.04)*.14;
      }
    });
  }
  private followPlayers(players:{x:number;y:number}[]){
    const camera=this.cameras.main;
    if(!players.length || this.net.room?.phase!=='playing'){camera.setZoom(1).centerOn(640,400);return;}
    const xs=players.map(p=>p.x+PLAYER_WIDTH/2),ys=players.map(p=>p.y+PLAYER_HEIGHT/2);
    const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
    const zoom=Math.max(1,Math.min(1.85,1280/(right-left+240),800/(bottom-top+200)));
    camera.setZoom(Phaser.Math.Linear(camera.zoom,zoom,.12));
    const hw=640/camera.zoom,hh=400/camera.zoom;
    const cx=Phaser.Math.Clamp((left+right)/2,hw,1280-hw);
    const cy=Phaser.Math.Clamp((top+bottom)/2,hh,800-hh);
    camera.centerOn(cx,cy);
  }
  private character(slot:number):Phaser.GameObjects.Container {
    const feet=[-6,6].map(x=>this.add.rectangle(x,2,6.5,8,0x102f3d));
    const face=this.add.image(0,-18,'runner-'+slot).setDisplaySize(45,49);
    const body=this.add.container(0,0,[...feet,face]).setDepth(10);
    body.setData('feet',feet);body.setData('face',face);return body;
  }
}
