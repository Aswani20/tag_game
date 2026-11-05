import type { MapId } from './types.js';
import type { Input, MatchState } from './physics/simulation.js';
export const PROTOCOL_VERSION = 4 as const;
export type Duration = 60 | 120 | 180;
export interface Member { id: string; nickname: string; color: number; ready: boolean; connected: boolean }
export interface ArenaSettings { mapId: MapId; buffsEnabled: boolean; duration: Duration }
export interface RoomView extends ArenaSettings {
  inputBatch?: boolean;
  code: string; hostId: string; members: Member[]; duration: Duration;
  phase: 'lobby' | 'playing' | 'over'; round: number; roster: string[]; notice: string;
}
export interface Session { code: string; playerId: string; token: string }
export interface Reply { ok: boolean; error?: string; session?: Session }
export interface InputCommand extends Input { sequence: number; round: number }
export interface Snapshot { round: number; state: Omit<MatchState,'seed'|'unusedSites'|'contacts'>; acknowledgements: number[] }
export interface ClientToServerEvents {
  'room:create': (data: { nickname: string }, reply: (r: Reply) => void) => void;
  'room:join': (data: { nickname: string; code: string }, reply: (r: Reply) => void) => void;
  'room:resume': (data: Session, reply: (r: Reply) => void) => void;
  'room:leave': (reply: (r: Reply) => void) => void;
  'room:ready': (ready: boolean, reply: (r: Reply) => void) => void;
  'room:settings': (settings: Duration | ArenaSettings, reply: (r: Reply) => void) => void;
  'room:start': (reply: (r: Reply) => void) => void;
  'room:lobby': (reply: (r: Reply) => void) => void;
  'game:input': (command: InputCommand) => void;
  'game:inputs': (commands: InputCommand[]) => void;
  'game:neutral': () => void;
}
export interface ServerToClientEvents {
  'room:state': (room: RoomView) => void;
  'game:snapshot': (snapshot: Snapshot) => void;
}
