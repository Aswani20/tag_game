import { createSocket } from './socket';
import { movePlayer, STEP_SECONDS, type Session, type RoomView, type Snapshot, type InputCommand, type Input, type SimPlayer, type Reply } from '@tag/shared';

export class OnlineGame {
  readonly socket=createSocket();
  session:Session|null=null;
  room:RoomView|null=null;
  latest:Snapshot|null=null;
  predicted:SimPlayer|null=null;
  pending:InputCommand[]=[];
  private outbound: InputCommand[] = [];
  private previousInput: Input | null = null;
  sequence=0;
  accumulator=0;
  snapshots:{at:number;snapshot:Snapshot}[]=[];
  connected=false;
  notice='Connecting…';
  onUI=()=>{};
  constructor(){
    try {this.session=JSON.parse(sessionStorage.getItem('tag-session') ?? 'null');}catch {this.session=null;}
    this.socket.on('connect',()=>{
      this.connected=true;this.notice='';
      if(this.session)this.socket.emit('room:resume',this.session,r=>{
        if(!r.ok){this.forget();this.notice=r.error ?? 'Session expired';}
        else this.save(r);
        this.onUI();
      });
      this.onUI();
    });
    this.socket.on('disconnect',()=>{this.connected=false;this.notice='Connection lost. Reconnecting… (seat reserved for 30 seconds)';this.pending=[];this.outbound=[];this.previousInput=null;this.accumulator=0;this.onUI();});
    this.socket.on('connect_error',()=>{this.connected=false;this.notice='Cannot reach the game server. Retrying…';this.onUI();});
    this.socket.on('room:state',r=>{this.room=r;if(r.phase==='lobby'){this.latest=null;this.predicted=null;this.snapshots=[];this.pending=[];this.outbound=[];this.previousInput=null;}this.onUI();});
    this.socket.on('game:snapshot',s=>{
      const index=this.index;
      const fresh=this.latest?.round!==s.round;
      if(fresh){this.pending=[];this.outbound=[];this.previousInput=null;this.sequence=0;this.snapshots=[];this.accumulator=0;}
      this.latest=s;
      const ack=s.acknowledgements[index] ?? -1;
      this.sequence=Math.max(this.sequence,ack+1);
      this.pending=this.pending.filter(c=>c.sequence>ack && c.round===s.round);
      const authoritative=s.state.players[index];
      this.predicted=authoritative?{...authoritative}:null;
      if(this.predicted && s.state.phase==='playing')for(const c of this.pending)movePlayer(this.predicted,c,s.state.mapId,s.state.tick+c.sequence-ack);
      this.snapshots.push({at:performance.now(),snapshot:s});
      if(this.snapshots.length>20)this.snapshots.shift();
      if(fresh || s.state.phase==='over')this.onUI();
    });
  }
  get index(){return this.room?.roster.indexOf(this.session?.playerId ?? '') ?? -1;}
  save(r:Reply){if(r.session){this.session=r.session;sessionStorage.setItem('tag-session',JSON.stringify(r.session));}this.notice=r.error ?? '';}
  forget(){this.session=null;this.room=null;this.latest=null;this.predicted=null;this.pending=[];this.outbound=[];this.previousInput=null;this.snapshots=[];sessionStorage.removeItem('tag-session');}
  reply=(r:Reply)=>{this.notice=r.ok?'':r.error ?? 'Request failed';this.onUI();};
  enter(nickname:string,code?:string){
    if(!this.connected){this.notice='Wait for the server connection.';this.onUI();return;}
    const done=(r:Reply)=>{this.save(r);this.onUI();};
    if(code)this.socket.emit('room:join',{nickname,code},done);else this.socket.emit('room:create',{nickname},done);
  }
  neutral(){this.accumulator=0;this.pending=[];this.outbound=[];this.previousInput=null;if(this.connected)this.socket.emit('game:neutral');}
  tick(delta:number,input:Input){
    if(!this.connected || !this.predicted || this.latest?.state.phase!=='playing')return;
    this.accumulator+=Math.min(delta/1000,0.1);
    while(this.accumulator>=STEP_SECONDS){
      if(this.pending.length>=90){this.accumulator=0;break;}
      const command:InputCommand={...input,sequence:this.sequence++,round:this.latest.round};
      this.pending.push(command);
      this.outbound.push(command);
      const previous=this.previousInput;
      const changed=!previous || previous.left!==input.left || previous.right!==input.right || previous.jump!==input.jump;
      if(!this.room?.inputBatch){
        this.socket.emit('game:input',command);this.outbound=[];
      }else if(changed || this.outbound.length>=2){
        this.socket.emit('game:inputs',this.outbound);
        this.outbound=[];
      }
      this.previousInput=command;
      movePlayer(this.predicted,command,this.latest.state.mapId,this.latest.state.tick+this.pending.length);
      this.accumulator-=STEP_SECONDS;
    }
  }
  renderedPlayers():SimPlayer[]{
    if(!this.latest)return [];
    const target=performance.now()-100;
    let before=this.snapshots[0],after=this.snapshots[0];
    for(const sample of this.snapshots){if(sample.at<=target)before=sample;if(sample.at>=target){after=sample;break;}after=sample;}
    return this.latest.state.players.map((p,i)=>{
      if(i===this.index && this.predicted)return {...this.predicted};
      const a=before?.snapshot.state.players[i] ?? p,b=after?.snapshot.state.players[i] ?? p;
      const t=before && after && after.at>before.at? Math.max(0,Math.min(1,(target-before.at)/(after.at-before.at))):1;
      if(a.warp!==b.warp)return {...b};
      // Use the same delayed samples for the remote pose and its position.
      const grounded=a.grounded===b.grounded?a.grounded:(b.grounded?t>=1:t===0);
      return {...p,grounded,vy:a.vy+(b.vy-a.vy)*t,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
    });
  }
}
