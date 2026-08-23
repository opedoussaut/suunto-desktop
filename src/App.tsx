import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { parseGpx } from './gpx';
import { RouteMap } from './RouteMap';
import { ElevationProfile } from './ElevationProfile';
import { ConnectionSettings } from './ConnectionSettings';
import { stravaRouteToRoute, suuntoRouteToRoute } from './providers';
import type { Connections, Priority, Route } from './types';

const navItems = ['Routes', 'Trips', 'Activities', 'Watch'];
const emptyConnections: Connections = {
  strava: { configured: false, connected: false },
  suunto: { configured: false, connected: false },
};

function SyncPill({ label, state }: { label: string; state: string }) {
  return <span className={`sync-pill sync-${state}`}>{label}</span>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div className="stat"><strong>{value}</strong><span>{label}</span></div>;
}

function SourceBadge({ route }: { route: Route }) {
  return <span className={`source-badge source-${route.source}`}>{route.source === 'strava' ? 'Strava' : route.source === 'suunto' ? 'Suunto' : 'GPX'}</span>;
}

export default function App() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [activeNav, setActiveNav] = useState('Routes');
  const [error, setError] = useState<string>();
  const [connections, setConnections] = useState<Connections>(emptyConnections);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string>();
  const [showConnectionSettings, setShowConnectionSettings] = useState(false);

  const selected = useMemo(
    () => routes.find((route) => route.id === selectedId) ?? routes[0],
    [routes, selectedId],
  );

  async function refreshConnections() {
    const response = await fetch('/api/connections');
    if (!response.ok) throw new Error('Could not read provider connection state.');
    const data = await response.json() as Connections;
    setConnections(data);
    return data;
  }

  async function syncAll() {
    setSyncing(true);
    setError(undefined);
    try {
      const response = await fetch('/api/sync-all');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Synchronization failed.');

      const stravaRoutes = (data.strava ?? []).map(stravaRouteToRoute);
      const suuntoRoutes = (data.suunto ?? []).map(suuntoRouteToRoute);
      setRoutes((current) => [
        ...current.filter((route) => route.source === 'local'),
        ...stravaRoutes,
        ...suuntoRoutes,
      ]);
      if (!selectedId && (stravaRoutes[0] || suuntoRoutes[0])) {
        setSelectedId((stravaRoutes[0] || suuntoRoutes[0]).id);
      }
      if (Array.isArray(data.errors) && data.errors.length) {
        setError(data.errors.join(' · '));
      }
      setConnections(data.status ?? connections);
      setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const state = await refreshConnections();
        if (state.strava.connected || state.suunto.connected) await syncAll();
      } catch (cause) {
        console.error(cause);
      }
    })();
    // Run only at startup; provider changes are refreshed explicitly after OAuth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function connectProvider(provider: 'strava' | 'suunto') {
    const popup = window.open(`/api/${provider}/login`, `${provider}-oauth`, 'width=760,height=820');
    let attempts = 0;
    const timer = window.setInterval(async () => {
      attempts += 1;
      try {
        const state = await refreshConnections();
        if (state[provider].connected) {
          window.clearInterval(timer);
          popup?.close();
          await syncAll();
        } else if (attempts > 180) {
          window.clearInterval(timer);
        }
      } catch {
        // Keep polling while OAuth is in progress.
      }
    }, 1000);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setError(undefined);
    try {
      const imported = await Promise.all(files.map(async (file) => parseGpx(await file.text(), file.name)));
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
    setRoutes((current) => current.map((route) => route.id === selected.id ? { ...route, ...patch } : route));
  }

  const watchCount = routes.filter((route) => route.source === 'suunto' && route.watchEnabled).length;
  const stravaCount = routes.filter((route) => route.source === 'strava').length;
  const suuntoCount = routes.filter((route) => route.source === 'suunto').length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">S</div><div><strong>suunto-desktop</strong><span>Outdoor control center</span></div></div>
        <nav>
          {navItems.map((item) => (
            <button key={item} className={activeNav === item ? 'nav-active' : ''} onClick={() => setActiveNav(item)} type="button">
              <span>{item === 'Routes' ? '⌁' : item === 'Trips' ? '◇' : item === 'Activities' ? '↗' : '◉'}</span>{item}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="device-mini"><span className={watchCount ? 'device-dot connected' : 'device-dot'} /><div><strong>Suunto Race</strong><span>{watchCount ? `${watchCount} routes selected` : 'Cloud state not loaded'}</span></div></div>
          <button className="settings-button" type="button" onClick={() => setShowConnectionSettings(true)}>Connections & credentials</button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div><p className="eyebrow">UNIFIED ROUTE LIBRARY</p><h1>{activeNav}</h1></div>
          <div className="top-actions">
            <button className="sync-all-button" type="button" onClick={() => void syncAll()} disabled={syncing || (!connections.strava.connected && !connections.suunto.connected)}>{syncing ? 'Syncing…' : '↻ Sync all'}</button>
            <label className="import-button"><input type="file" accept=".gpx,application/gpx+xml" multiple onChange={handleImport} /><span>＋</span> Import GPX</label>
          </div>
        </header>

        <section className="connection-bar">
          <div className="provider-card">
            <span className="provider-mark strava-mark">S</span>
            <div><strong>Strava</strong><span>{connections.strava.connected ? `${stravaCount} routes loaded` : connections.strava.configured ? 'Ready to log in' : 'API app credentials required'}</span></div>
            {!connections.strava.configured ? (
              <button type="button" onClick={() => setShowConnectionSettings(true)}>Configure</button>
            ) : !connections.strava.connected ? (
              <><button className="connection-edit-button" type="button" onClick={() => setShowConnectionSettings(true)}>Edit</button><button type="button" onClick={() => connectProvider('strava')}>Log in</button></>
            ) : (
              <><button className="connection-edit-button" type="button" onClick={() => setShowConnectionSettings(true)}>Edit</button><span className="connected-label">● Connected</span></>
            )}
          </div>
          <div className="provider-card">
            <span className="provider-mark suunto-mark">S</span>
            <div><strong>Suunto Cloud</strong><span>{connections.suunto.connected ? `${suuntoCount} routes · ${watchCount} selected for Race` : connections.suunto.configured ? 'Ready to log in' : 'Partner API credentials required'}</span></div>
            {!connections.suunto.configured ? (
              <button type="button" onClick={() => setShowConnectionSettings(true)}>Configure</button>
            ) : !connections.suunto.connected ? (
              <><button className="connection-edit-button" type="button" onClick={() => setShowConnectionSettings(true)}>Edit</button><button type="button" onClick={() => connectProvider('suunto')}>Log in</button></>
            ) : (
              <><button className="connection-edit-button" type="button" onClick={() => setShowConnectionSettings(true)}>Edit</button><span className="connected-label">● Connected</span></>
            )}
          </div>
          <div className="last-sync">{lastSync ? `Last sync ${lastSync}` : 'Not synchronized yet'}</div>
        </section>

        {error && <div className="error-banner">{error}</div>}

        {activeNav !== 'Routes' ? (
          <section className="future-screen"><span>NEXT</span><h2>{activeNav}</h2><p>Route synchronization is the current implementation focus.</p></section>
        ) : (
          <div className="workspace">
            <section className="route-list-panel">
              <div className="panel-heading"><div><strong>Routes in library</strong><span>{routes.length} routes</span></div><button type="button" aria-label="Filter routes">☷</button></div>
              {routes.length === 0 ? (
                <div className="route-empty"><div className="empty-icon">⌁</div><strong>Connect a source</strong><span>Log in to Strava and/or Suunto above, then use Sync all. Local GPX import also works.</span></div>
              ) : (
                <div className="route-list">
                  {routes.map((route) => (
                    <button className={selected?.id === route.id ? 'route-row selected' : 'route-row'} key={route.id} onClick={() => setSelectedId(route.id)} type="button">
                      <div className={`priority ${route.priority.toLowerCase()}`}>{route.priority}</div>
                      <div className="route-row-main"><strong>{route.name}</strong><span>{route.distanceKm.toFixed(1)} km · +{Math.round(route.ascentM)} m</span><SourceBadge route={route} /></div>
                      <div className={route.watchEnabled ? 'route-row-sync watch-on' : 'route-row-sync'} title={route.watchEnabled ? 'Selected for Suunto Race' : 'Not selected for watch'}>{route.watchEnabled ? '●' : '○'}</div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="map-panel">
              <RouteMap routes={routes} selectedId={selected?.id} onSelect={setSelectedId} />
              {routes.length === 0 && <div className="map-empty-overlay"><strong>Map is ready.</strong><span>Connect Strava or Suunto to populate routes, or import GPX files.</span></div>}
            </section>

            <section className="detail-panel">
              {!selected ? <div className="detail-empty"><strong>Connect your accounts</strong><p>Once connected, Sync all loads Strava routes and Suunto Cloud routes together. Suunto routes selected for the Race are marked separately.</p></div> : (
                <>
                  <div className="detail-title-row"><div><SourceBadge route={selected} /><input className="route-name-input" value={selected.name} onChange={(event) => patchSelected({ name: event.target.value })} aria-label="Route name" /></div><select value={selected.priority} onChange={(event) => patchSelected({ priority: event.target.value as Priority })} aria-label="Route priority"><option>P0</option><option>P1</option><option>P2</option></select></div>
                  <div className="stats-grid"><Stat value={selected.distanceKm.toFixed(1)} label="km" /><Stat value={`+${Math.round(selected.ascentM)}`} label="ascent m" /><Stat value={selected.watchEnabled ? 'YES' : 'NO'} label="selected for Race" /></div>
                  {selected.points.some((point) => point.elevation !== undefined) && <ElevationProfile route={selected} />}
                  <div className="metadata-grid"><label>Trip<input value={selected.trip} onChange={(e) => patchSelected({ trip: e.target.value })} /></label><label>Sport<input value={selected.sport} onChange={(e) => patchSelected({ sport: e.target.value })} /></label></div>
                  <div className="sync-section">
                    <div className="sync-heading"><strong>Synchronization</strong><span>{selected.source === 'suunto' ? 'Suunto Cloud is authoritative for watch selection' : 'Source route'}</span></div>
                    <div className="sync-flow"><SyncPill label={selected.source === 'strava' ? 'Strava ✓' : selected.source === 'suunto' ? 'Suunto ✓' : 'Local ✓'} state="synced" /><span className="flow-arrow">→</span><SyncPill label="Suunto Cloud" state={selected.cloudState} /><span className="flow-arrow">→</span><SyncPill label={selected.watchEnabled ? 'Race selected ✓' : 'Race'} state={selected.watchState} /></div>
                    <button className="sync-button" type="button" disabled title="Changing watchEnabled is only enabled after the official writable Suunto operation is validated">{selected.watchEnabled ? 'Selected for Suunto Race' : 'Watch selection write pending Suunto API validation'}</button>
                  </div>
                  <div className="source-file">Source · {selected.source}{selected.sourceId ? ` · ${selected.sourceId}` : ''}</div>
                </>
              )}
            </section>
          </div>
        )}
      </main>

      <ConnectionSettings
        open={showConnectionSettings}
        connections={connections}
        onClose={() => setShowConnectionSettings(false)}
        onSaved={async () => {
          await refreshConnections();
          setShowConnectionSettings(false);
        }}
      />
    </div>
  );
}
