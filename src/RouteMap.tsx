import { useEffect, useRef } from 'react';
import {
  AttributionControl,
  LngLatBounds,
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Route } from './types';

setWorkerUrl(workerUrl);

interface Props {
  route?: Route;
}

export function RouteMap({ route }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [13.2, 68.2],
      zoom: 6.2,
      attributionControl: false,
    });
    map.addControl(new NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !route) return;

    const update = () => {
      const data: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: route.points.map((point) => [point.lon, point.lat]),
        },
      };

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

      const bounds = new LngLatBounds();
      route.points.forEach((point) => bounds.extend([point.lon, point.lat]));
      map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 700 });
    };

    if (map.loaded()) update();
    else map.once('load', update);
  }, [route]);

  return <div className="route-map" ref={containerRef} aria-label="Interactive route map" />;
}
