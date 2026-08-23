export type Priority = 'P0' | 'P1' | 'P2';
export type SyncState = 'local' | 'pending' | 'synced';
export type RouteSource = 'local' | 'strava' | 'suunto';

export interface RoutePoint {
  lon: number;
  lat: number;
  elevation?: number;
}

export interface Route {
  id: string;
  name: string;
  fileName: string;
  points: RoutePoint[];
  distanceKm: number;
  ascentM: number;
  descentM: number;
  priority: Priority;
  trip: string;
  sport: string;
  cloudState: SyncState;
  watchState: SyncState;
  source: RouteSource;
  sourceId?: string;
  watchEnabled?: boolean;
  updatedAt?: string | number;
}

export interface ConnectionState {
  configured: boolean;
  connected: boolean;
}

export interface Connections {
  strava: ConnectionState;
  suunto: ConnectionState;
}
