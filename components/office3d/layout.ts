// Floor plan in world units. x runs along the back wall, z toward the viewer.
// Desk spacing and zone positions follow the agreed isometric mockup.
export const FLOOR = { w: 17.6, d: 13.6 };
export const CENTER: [number, number, number] = [FLOOR.w / 2 - 0.4, 0, FLOOR.d / 2 + 0.3];
export const AISLE_Z = 11.25;
export const DOOR: [number, number] = [0.7, 13.0];

export const deskPos = (local: number): [number, number] => [5.6 + (local % 4) * 1.8, 4.4 + Math.floor(local / 4) * 1.8];
export const chairPos = (local: number): [number, number] => {
  const [x, z] = deskPos(local);
  return [x, z + 0.46];
};

// Break area spots, front right. More than the mockup's six so a busy office
// still has somewhere to stand.
export const BREAK_SPOTS: [number, number][] = [
  [13.3, 9.2], [14.3, 9.5], [15.1, 10.1], [13.5, 10.4], [14.5, 10.8], [12.9, 9.9],
  [15.6, 9.1], [13.9, 11.9], [14.9, 11.8], [12.7, 11.6], [15.8, 11.3], [13.2, 12.4],
];

// Queue in front of reception for people hired but not launched yet.
export const RECEPTION_SPOTS: [number, number][] = [
  [2.6, 11.4], [3.4, 11.7], [1.9, 11.9], [2.8, 12.3], [3.7, 12.5], [1.6, 12.7], [4.3, 11.9], [2.2, 13.0],
];

const inDeskGrid = (x: number, z: number) => x > 4.6 && x < 12.0 && z > 3.5 && z < 10.8;

/** Walks via the front aisle and the gaps between desk columns, never through furniture. */
export function route(from: [number, number], to: [number, number]): [number, number][] {
  const pts: [number, number][] = [];
  if (inDeskGrid(from[0], from[1])) pts.push([from[0] + 0.9, from[1]], [from[0] + 0.9, AISLE_Z]);
  else pts.push([from[0], AISLE_Z]);
  if (inDeskGrid(to[0], to[1])) pts.push([to[0] + 0.9, AISLE_Z], [to[0] + 0.9, to[1]], [to[0], to[1]]);
  else pts.push([to[0], AISLE_Z], [to[0], to[1]]);
  return pts;
}

export const ZONES = {
  meeting: { x0: 4.4, z0: 0.25, x1: 9.6, z1: 2.9 },
  manager: { x0: 13.4, z0: 3.6, x1: 17.35, z1: 8.2 },
  reception: { x0: 1.0, z0: 9.2, x1: 3.9, z1: 10.1 },
};

export const PAYROLL_BOARD = { x: 0.1, z: 5.0, y: 1.85, w: 3.6, h: 1.85 };
export const STATUS_WALL = { x: 13.2, z: 0.1, y: 1.9, w: 5.0, h: 2.0 };
