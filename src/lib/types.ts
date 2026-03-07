export interface Vec2 {
  x: number;
  y: number;
}

export interface CameraState extends Vec2 {
  zoom: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface NoteRecord {
  id: string;
  title: string;
  body: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  createdAt: number;
  updatedAt: number;
}

export interface ConnectionRecord {
  id: string;
  from: string;
  to: string;
  createdAt: number;
}

export interface PersistedScene {
  version: 1;
  camera: CameraState;
  notes: Record<string, NoteRecord>;
  connections: Record<string, ConnectionRecord>;
}

export interface NoteMotion {
  vx: number;
  vy: number;
}
