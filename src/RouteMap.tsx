import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { Route } from './types';

interface Props {
  routes: Route[];
  selectedId?: string;
  onSelect?: (id: string) => void;
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

export function RouteMap({ routes, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const fittedRef = useRef(false);
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
        if (cancelled || !containerRef.current) return;
        maplibre.setWorkerUrl(workerModule.default);

        const map = new maplibre.Map({
          container: containerRef.current,
          style: getMapStyle(),
          center: [13.25, 68.2],
          zoom: 7,
          maxZoom: 20,
          attributionControl: false,
        });

        createdMap = map;
        mapRef.current = map;
        map.addControl(new maplibre.NavigationControl({ showCompass: true }), 'top-right');
        map.addControl(new maplibre.AttributionControl({ compact: true }), 'bottom-right');

        map.once('load', () => {
          if (!cancelled) {
            map.resize();
            setMapReady(true);
            setMapError(undefined);
          }
        });

        map.on('error', (event) => {
          console.error('[suunto-desktop map]', event.error);
          if (!map.loaded() && !cancelled) setMapError(readableError(event.error));
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
    if (!map || !mapReady) return;

    const renderable = routes.filter((route) => route.points.length >= 2);
    const data: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
      type: 'FeatureCollection',
      features: renderable.map((route) => ({
        type: 'Feature',
        properties: {
          id: route.id,
          source: route.source,
          selected: route.id === selectedId,
          name: route.name,
        },
        geometry: {
          type: 'LineString',
          coordinates: route.points.map((point) => [point.lon, point.lat]),
        },
      })),
    };

    const existing = map.getSource('routes') as GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
    } else {
      map.addSource('routes', { type: 'geojson', data });
      map.addLayer({
        id: 'routes-line',
        type: 'line',
        source: 'routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['match', ['get', 'source'], 'strava', '#fc4c02', 'suunto', '#4ac7c7', '#ffffff'] as any,
          'line-width': ['case', ['get', 'selected'], 5, 3] as any,
          'line-opacity': ['case', ['get', 'selected'], 1, 0.72] as any,
        },
      });
      map.on('click', 'routes-line', (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (id && onSelect) onSelect(String(id));
      });
      map.on('mouseenter', 'routes-line', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'routes-line', () => { map.getCanvas().style.cursor = ''; });
    }

    if (!fittedRef.current && renderable.length) {
      const allPoints = renderable.flatMap((route) => route.points);
      const west = Math.min(...allPoints.map((point) => point.lon));
      const east = Math.max(...allPoints.map((point) => point.lon));
      const south = Math.min(...allPoints.map((point) => point.lat));
      const north = Math.max(...allPoints.map((point) => point.lat));
      map.fitBounds([[west, south], [east, north]], { padding: 70, maxZoom: 13, duration: 700 });
      fittedRef.current = true;
    }
  }, [routes, selectedId, mapReady, onSelect]);

  return (
    <div className="route-map-shell">
      <div className="route-map" ref={containerRef} aria-label="Interactive route map" />
      {!mapReady && !mapError && <div className="map-status-overlay">Loading detailed map…</div>}
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
