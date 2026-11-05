import type { Vec2 } from '../types.js';

/** Contract only. Values must be measured/tuned in a later phase. */
export interface PhysicsConfig {
  fixedStepSeconds: number;
  gravity: number;
  runSpeed: number;
  jumpSpeed: number;
  maxFallSpeed: number;
}
export interface BodyState {
  position: Vec2;
  velocity: Vec2;
  size: Vec2;
  grounded: boolean;
}
