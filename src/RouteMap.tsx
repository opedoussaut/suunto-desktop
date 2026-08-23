import { useEffect, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { Route } from './types';

interface Props {
  route?: Route;
}

function getMapStyle() {
  const mapTilerKey = import.meta.env.VITE_MAPTILER_KEY?.trim();

  if (mapTilerKey) {
    return `https://api.maptiler.com/maps/outdoor-v4/style.json?key=${encodeURIComponent(mapTilerKey)}`;
  }

  return 'https://tiles.openfreemap.org/styles/liberty';
}

function readableError(cause: unknown) {
  if (cause instanceof Error) return cause.message;
  return String(cause || 'Unknown map error');
}

export function RouteMap({ route }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapError, setMapError] = useState<string>();
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    let createdMap: MapLibreMap | null = null;

    async function startMap() {
      try {
        const [maplibre, workerModule] = await Promise.all([
          import('maplibre-gl'),
          import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
        ]);
        await import('maplibre-gl/dist/maplibre-gl.css');

        if (cancelled || !containerRef.current) return;

        maplibre.setWorkerUrl(workerModule.default);

        const map = new maplibre.Map({
          container: containerRef.current,
          style: getMapStyle(),
          center: [13.2, 68.2],
          zoom: 6.2,
          maxZoom: 20,
          attributionControl: false,
        });

        createdMap = map;
        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ showCompass: true }), 'top-right');
        map.addControl(new maplibre.AttributionControl({ compact: true }), 'bottom-right');

        map.once('load', () => {
          if (!cancelled) {
            setMapReady(true);
            setMapError(undefined);
          }
        });

        map.on('error', (event) => {
          const message = readableError(event.error);
          console.error('[suunto-desktop map]', event.error);
          if (!map.loaded() && !cancelled) setMapError(message);
        });
      } catch (cause) {
        console.error('[suunto-desktop map startup]', cause);
        if (!cancelled) setMapError(readableError(cause));
      }
    }

    void startMap();

    return () => {
      cancelled = true;
      createdMap?.remove();
      if (mapRef.current === createdMap) mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !route || !mapReady) return;

    const data: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: route.points.map((point) => [point.lon, point.lat]),
      },
    };

    try {
      const existing = map.getSource('selected-route') as GeoJSONSource | undefined;
      if (existing) {
        existing.setData(data);
      } else {
        map.addSource('selected-route', { type: 'geojson', data });
        map.addLayer({
          id: 'selected-route-line',
          type: 'line',
          source: 'selected-route',
          paint: {
            'line-color': '#ff4b2b',
            'line-width': 5,
            'line-opacity': 0.95,
          },
        });
      }

      const bounds = new map.constructor.prototype.constructor.LngLatBounds?.();
      // The constructor trick above is intentionally avoided below; MapLibre exposes
      // fitBounds with a plain LngLatBoundsLike tuple, so compute it directly.
      const lons = route.points.map((point) => point.lon);
      const lats = route.points.map((point) => point.lat);
      const west = Math.min(...lons);
      const east = Math.max(...lons);
      const south = Math.min(...lats);
      const north = Math.max(...lats);
      void bounds;
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: 70, maxZoom: 16, duration: 700 },
      );
    } catch (cause) {
      console.error('[suunto-desktop route rendering]', cause);
      setMapError(readableError(cause));
    }
  }, [route, mapReady]);

  return (
    <div className="route-map-shell">
      <div className="route-map" ref={containerRef} aria-label="Interactive route map" />
      {!mapReady && !mapError && (
        <div className="map-status-overlay">Loading detailed map…</div>
      )}
      {mapError && (
        <div className="map-error-overlay" role="alert">
          <strong>Map could not start</strong>
          <span>{mapError}</span>
          <small>The route library remains usable. Check F12 → Console for details.</small>
        </div>
      )}
    </div>
  );
}
