import { FRAME_TIME, VELOCITY_CUTOFF } from './constants';
import type { NoteMotion, Vec2 } from './types';

const BASE_DAMPING = 0.86;

export function applyVelocityDamping(velocity: number, dt: number): number {
  return velocity * Math.pow(BASE_DAMPING, dt / FRAME_TIME);
}

export function stepInertia(
  position: Vec2,
  motion: NoteMotion,
  dt: number,
): { position: Vec2; motion: NoteMotion | null } {
  const nextPosition = {
    x: position.x + motion.vx * dt,
    y: position.y + motion.vy * dt,
  };
  const nextMotion = {
    vx: applyVelocityDamping(motion.vx, dt),
    vy: applyVelocityDamping(motion.vy, dt),
  };

  if (
    Math.abs(nextMotion.vx) < VELOCITY_CUTOFF &&
    Math.abs(nextMotion.vy) < VELOCITY_CUTOFF
  ) {
    return {
      position: nextPosition,
      motion: null,
    };
  }

  return {
    position: nextPosition,
    motion: nextMotion,
  };
}
