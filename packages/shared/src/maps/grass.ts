import { ARENAS } from './arenas.js';
export interface Platform {
  /** An optional internal corner joins a flat approach and ramp into one continuous solid. */
  rampStart?: number; endThickness?: number; kind?: 'crate';
  x: number; y: number; width: number; endY?: number; thickness?: number; oneWay?: boolean;
}
export const GRASS_MAP = { ...ARENAS.grass, width:1280, height:800, floorY:754 };
