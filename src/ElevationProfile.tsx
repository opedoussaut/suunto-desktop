import type { Route } from './types';

export function ElevationProfile({ route }: { route: Route }) {
  const elevations = route.points
    .map((point) => point.elevation)
    .filter((value): value is number => value !== undefined);

  if (elevations.length < 2) {
    return <div className="profile-empty">No elevation data in this GPX.</div>;
  }

  const width = 800;
  const height = 160;
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const range = Math.max(1, max - min);
  const polyline = elevations
    .map((value, index) => {
      const x = (index / (elevations.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 18) - 9;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="elevation-card">
      <div className="elevation-labels">
        <span>Elevation</span>
        <span>{Math.round(min)}–{Math.round(max)} m</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Elevation profile">
        <defs>
          <linearGradient id="elevationFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff6547" stopOpacity="0.38" />
            <stop offset="1" stopColor="#ff6547" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={`0,${height} ${polyline} ${width},${height}`} fill="url(#elevationFill)" />
        <polyline points={polyline} fill="none" stroke="#ff6547" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
