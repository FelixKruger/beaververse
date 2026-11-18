import { Entity, Quat } from 'playcanvas';

const desired = new Quat(), interpolated = new Quat();

/** Preserve the complete orientation: decomposed Euler Y folds past 90 degrees. */
export function turnAvatar(entity: Entity, yaw: number, dt: number) {
  desired.setFromEulerAngles(0, yaw, 0);
  interpolated.slerp(entity.getRotation(), desired, 1 - Math.exp(-dt * 12));
  entity.setRotation(interpolated);
}
