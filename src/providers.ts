import { parseGpx } from './gpx';
import type { Route, RoutePoint } from './types';

interface StravaRoutePayload {
  sourceId: string;
  name: string;
  distanceM: number;
  elevationGainM: number;
  updatedAt?: string;
  summaryPolyline?: string | null;
}

interface SuuntoRoutePayload {
  sourceId: string;
  name: string;
  distanceM: number;
  updatedAt?: number;
  watchEnabled: boolean;
  gpx?: string | null;
  startPoint?: { latitude: number; longitude: number; altitude?: number };
  centerPoint?: { latitude: number; longitude: number; altitude?: number };
  endPoint?: { latitude: number; longitude: number; altitude?: number };
}

export function decodePolyline(encoded: string): RoutePoint[] {
  const points: RoutePoint[] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lon += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lon: lon / 1e5 });
  }

  return points;
}

export function stravaRouteToRoute(payload: StravaRoutePayload): Route {
  return {
    id: `strava:${payload.sourceId}`,
    source: 'strava',
    sourceId: payload.sourceId,
    name: payload.name,
    fileName: 'Strava',
    points: payload.summaryPolyline ? decodePolyline(payload.summaryPolyline) : [],
    distanceKm: payload.distanceM / 1000,
    ascentM: payload.elevationGainM || 0,
    descentM: 0,
    priority: 'P1',
    trip: 'Strava',
    sport: 'Route',
    cloudState: 'local',
    watchState: 'local',
    updatedAt: payload.updatedAt,
  };
}

export function suuntoRouteToRoute(payload: SuuntoRoutePayload): Route {
  if (payload.gpx) {
    try {
      const parsed = parseGpx(payload.gpx, `${payload.name}.gpx`);
      return {
        ...parsed,
        id: `suunto:${payload.sourceId}`,
        source: 'suunto',
        sourceId: payload.sourceId,
        name: payload.name || parsed.name,
        fileName: 'Suunto Cloud',
        distanceKm: payload.distanceM ? payload.distanceM / 1000 : parsed.distanceKm,
        cloudState: 'synced',
        watchState: payload.watchEnabled ? 'synced' : 'local',
        watchEnabled: payload.watchEnabled,
        updatedAt: payload.updatedAt,
        trip: 'Suunto',
      };
    } catch {
      // Fall through to metadata geometry.
    }
  }

  const points = [payload.startPoint, payload.centerPoint, payload.endPoint]
    .filter((point): point is NonNullable<typeof point> => Boolean(point))
    .map((point) => ({ lon: point.longitude, lat: point.latitude, elevation: point.altitude }));

  return {
    id: `suunto:${payload.sourceId}`,
    source: 'suunto',
    sourceId: payload.sourceId,
    name: payload.name,
    fileName: 'Suunto Cloud',
    points,
    distanceKm: payload.distanceM / 1000,
    ascentM: 0,
    descentM: 0,
    priority: 'P1',
    trip: 'Suunto',
    sport: 'Route',
    cloudState: 'synced',
    watchState: payload.watchEnabled ? 'synced' : 'local',
    watchEnabled: payload.watchEnabled,
    updatedAt: payload.updatedAt,
  };
}
