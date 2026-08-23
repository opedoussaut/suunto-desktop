import type { Route, RoutePoint } from './types';

const EARTH_RADIUS_M = 6_371_000;

function radians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a: RoutePoint, b: RoutePoint) {
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function elementsByLocalName(doc: XMLDocument, name: string) {
  return Array.from(doc.getElementsByTagNameNS('*', name));
}

export function parseGpx(text: string, fileName: string): Route {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('This file is not valid GPX/XML.');
  }

  const trackPoints = elementsByLocalName(doc, 'trkpt');
  const routePoints = elementsByLocalName(doc, 'rtept');
  const sourcePoints = trackPoints.length ? trackPoints : routePoints;

  const points = sourcePoints
    .map((node): RoutePoint | null => {
      const lat = Number(node.getAttribute('lat'));
      const lon = Number(node.getAttribute('lon'));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const elevationNode = Array.from(node.children).find(
        (child) => child.localName === 'ele' || child.localName === 'elevation',
      );
      const elevation = elevationNode ? Number(elevationNode.textContent) : undefined;
      return {
        lat,
        lon,
        elevation: Number.isFinite(elevation) ? elevation : undefined,
      };
    })
    .filter((point): point is RoutePoint => point !== null);

  if (points.length < 2) {
    throw new Error('No usable GPX track or route points were found.');
  }

  let distance = 0;
  let ascent = 0;
  let descent = 0;

  for (let i = 1; i < points.length; i += 1) {
    distance += distanceMeters(points[i - 1], points[i]);
    const previous = points[i - 1].elevation;
    const current = points[i].elevation;
    if (previous !== undefined && current !== undefined) {
      const delta = current - previous;
      if (delta > 0) ascent += delta;
      if (delta < 0) descent += Math.abs(delta);
    }
  }

  const names = elementsByLocalName(doc, 'name');
  const gpxName = names.find((node) => node.textContent?.trim())?.textContent?.trim();
  const fallbackName = fileName.replace(/\.gpx$/i, '');

  return {
    id: crypto.randomUUID(),
    name: gpxName || fallbackName,
    fileName,
    points,
    distanceKm: distance / 1000,
    ascentM: ascent,
    descentM: descent,
    priority: 'P1',
    trip: 'Unassigned',
    sport: 'Hiking / Trail',
    cloudState: 'local',
    watchState: 'local',
    source: 'local',
  };
}
