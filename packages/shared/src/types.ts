/** Theme IDs are our labels, not verified original map names. */
export type MapId = 'grass' | 'snow' | 'desert';
export type PlayerColor = 'red' | 'blue' | 'yellow' | 'green';
export type PlayerId = string;
export interface MatchSettings {
  mapId: MapId;
  maxPlayers: 2 | 3 | 4;
  durationSeconds: 60 | 120 | 180;
  buffsEnabled: boolean;
}
export interface Vec2 { x: number; y: number }
/** Proposed wire/simulation input contract; no input processing yet. */
export interface PlayerInput {
  sequence: number;
  left: boolean;
  right: boolean;
  jump: boolean;
}
