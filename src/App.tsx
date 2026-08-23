import { ChangeEvent, useMemo, useState } from 'react';
import { parseGpx } from './gpx';
import { RouteMap } from './RouteMap';
import { ElevationProfile } from './ElevationProfile';
import type { Priority, Route } from './types';

const navItems = ['Routes', 'Trips', 'Activities', 'Watch'];

function SyncPill({ label, state }: { label: string; state: string }) {
  return <span className={`sync-pill sync-${state}`}>{label}</span>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export default function App() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [activeNav, setActiveNav] = useState('Routes');
  const [error, setError] = useState<string>();

  const selected = useMemo(
    () => routes.find((route) => route.id === selectedId) ?? routes[0],
    [routes, selectedId],
  );

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setError(undefined);

    try {
      const imported = await Promise.all(
        files.map(async (file) => parseGpx(await file.text(), file.name)),
      );
      setRoutes((current) => [...current, ...imported]);
      setSelectedId(imported[0].id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not import this GPX.');
    } finally {
      event.target.value = '';
    }
  }

  function patchSelected(patch: Partial<Route>) {
    if (!selected) return;
    setRoutes((current) =>
      current.map((route) => (route.id === selected.id ? { ...route, ...patch } : route)),
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <strong>suunto-desktop</strong>
            <span>Outdoor control center</span>
          </div>
        </div>

        <nav>
          {navItems.map((item) => (
            <button
              key={item}
              className={activeNav === item ? 'nav-active' : ''}
              onClick={() => setActiveNav(item)}
              type="button"
            >
              <span>{item === 'Routes' ? '⌁' : item === 'Trips' ? '◇' : item === 'Activities' ? '↗' : '◉'}</span>
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="device-mini">
            <span className="device-dot" />
            <div><strong>Watch</strong><span>Not connected</span></div>
          </div>
          <button className="settings-button" type="button">Settings</button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">ROUTE LIBRARY</p>
            <h1>{activeNav}</h1>
          </div>
          <label className="import-button">
            <input type="file" accept=".gpx,application/gpx+xml" multiple onChange={handleImport} />
            <span>＋</span> Import GPX
          </label>
        </header>

        {error && <div className="error-banner">{error}</div>}

        {activeNav !== 'Routes' ? (
          <section className="future-screen">
            <span>Phase 2+</span>
            <h2>{activeNav} is intentionally next.</h2>
            <p>The first vertical slice is route-first: GPX import, maps, elevation, organization and Suunto synchronization.</p>
          </section>
        ) : (
          <div className="workspace">
            <section className="route-list-panel">
              <div className="panel-heading">
                <div><strong>My routes</strong><span>{routes.length} routes</span></div>
                <button type="button" aria-label="Filter routes">☷</button>
              </div>

              {routes.length === 0 ? (
                <div className="route-empty">
                  <div className="empty-icon">⌁</div>
                  <strong>No routes yet</strong>
                  <span>Import GPX files to start building your desktop route library.</span>
                </div>
              ) : (
                <div className="route-list">
                  {routes.map((route) => (
                    <button
                      className={selected?.id === route.id ? 'route-row selected' : 'route-row'}
                      key={route.id}
                      onClick={() => setSelectedId(route.id)}
                      type="button"
                    >
                      <div className={`priority ${route.priority.toLowerCase()}`}>{route.priority}</div>
                      <div className="route-row-main">
                        <strong>{route.name}</strong>
                        <span>{route.distanceKm.toFixed(1)} km · +{Math.round(route.ascentM)} m</span>
                      </div>
                      <div className="route-row-sync">{route.cloudState === 'synced' ? '●' : '○'}</div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="map-panel">
              <RouteMap route={selected} />
              {!selected && (
                <div className="map-empty-overlay">
                  <strong>Your routes, on a proper screen.</strong>
                  <span>Drop in a GPX and suunto-desktop will fit the map automatically.</span>
                </div>
              )}
            </section>

            <section className="detail-panel">
              {!selected ? (
                <div className="detail-empty">Select or import a route to inspect it.</div>
              ) : (
                <>
                  <div className="detail-title-row">
                    <div>
                      <span className="trip-label">{selected.trip}</span>
                      <input
                        className="route-name-input"
                        value={selected.name}
                        onChange={(event) => patchSelected({ name: event.target.value })}
                        aria-label="Route name"
                      />
                    </div>
                    <select
                      value={selected.priority}
                      onChange={(event) => patchSelected({ priority: event.target.value as Priority })}
                      aria-label="Route priority"
                    >
                      <option>P0</option><option>P1</option><option>P2</option>
                    </select>
                  </div>

                  <div className="stats-grid">
                    <Stat value={selected.distanceKm.toFixed(1)} label="km" />
                    <Stat value={`+${Math.round(selected.ascentM)}`} label="ascent m" />
                    <Stat value={`−${Math.round(selected.descentM)}`} label="descent m" />
                  </div>

                  <ElevationProfile route={selected} />

                  <div className="metadata-grid">
                    <label>Trip<input value={selected.trip} onChange={(e) => patchSelected({ trip: e.target.value })} /></label>
                    <label>Sport<input value={selected.sport} onChange={(e) => patchSelected({ sport: e.target.value })} /></label>
                  </div>

                  <div className="sync-section">
                    <div className="sync-heading"><strong>Synchronization</strong><span>Cloud adapter not connected yet</span></div>
                    <div className="sync-flow">
                      <SyncPill label="Local ✓" state="synced" />
                      <span className="flow-arrow">→</span>
                      <SyncPill label="Mobile" state={selected.cloudState} />
                      <span className="flow-arrow">→</span>
                      <SyncPill label="Watch" state={selected.watchState} />
                    </div>
                    <button className="sync-button" type="button" disabled title="Suunto API integration is the next milestone">Sync to Suunto</button>
                  </div>

                  <div className="source-file">Source · {selected.fileName}</div>
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
