# Map-driven route synchronization

## Product goal

The map is the main route-management surface. Pan or zoom to an area and `suunto-desktop` should show every matching route from:

- local GPX files
- the authenticated athlete's Strava routes
- the user's Suunto Cloud route library
- the subset of Suunto routes selected for the watch (`watchEnabled`)

The user then chooses the desired watch set and the application reconciles the supported source/cloud/watch states without silently deleting or overwriting routes.

## Important state distinction

`watchEnabled` is a Suunto Cloud route property. It means the route is selected for watch use in the Suunto ecosystem. It does **not** by itself prove that the physical watch has completed its latest Bluetooth synchronization.

Keep these states separate:

- `desiredOnWatch`: the user's intent in suunto-desktop
- `suuntoWatchEnabled`: the value currently reported by Suunto Cloud
- `deviceVerified`: whether direct device communication has positively verified that the route is physically present on the connected watch; `unknown` until that capability is implemented

## Area-based discovery

Represent the visible map as a geographic bounding box:

```ts
interface GeoBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}
```

### Local routes

Compute and cache a bounding box from GPX geometry at import time.

### Strava

1. List all routes for the authenticated athlete, following pagination.
2. Use the route summary polyline to calculate a route bounding box without downloading the full GPX.
3. Display routes whose bounding boxes intersect the current map bounds.
4. Export full GPX lazily when the route is opened in detail or needs to be copied into Suunto.
5. Private routes require the appropriate Strava `read_all` authorization.

### Suunto Cloud

1. List routes with `GET /v2/route`.
2. The listing provides start, center and end coordinates plus `watchEnabled`.
3. Use these points for a coarse area candidate filter.
4. Export candidate routes as GPX with `GET /v2/route/{id}/export`, compute an exact geometry bounding box, then cache it locally.
5. Subscribe to Suunto route notifications rather than polling for changes.

## Unified logical route

Copies of the same real-world route can exist in more than one system. The UI should show one logical route with per-source state instead of duplicate cards.

Suggested model:

```ts
type SourceKind = 'local' | 'strava' | 'suunto';

type VerificationState = true | false | 'unknown';

interface UnifiedRoute {
  id: string;
  name: string;
  bounds: GeoBounds;
  distanceM?: number;
  elevationGainM?: number;
  geometryFingerprint: string;

  localId?: string;
  stravaId?: string;
  suuntoId?: string;

  desiredOnWatch: boolean;
  suuntoWatchEnabled?: boolean;
  deviceVerified: VerificationState;

  conflict?: 'geometry' | 'name' | 'source-updated' | 'delete';
}
```

## Duplicate matching

Do not match by name alone. Use a geometry fingerprint built from a simplified/resampled route, plus safeguards such as distance and start/end proximity. Names can be edited independently in Strava or Suunto.

Possible matching inputs:

- simplified geometry hash
- total distance tolerance
- start/end point proximity
- route centroid/bounds overlap

If confidence is below the threshold, keep the routes separate and offer an explicit merge action.

## Reconciliation flow

When the user marks a route `On watch`:

### Route already exists in Suunto

- retain the existing Suunto route
- set/validate `watchEnabled` if an official writable API is available
- otherwise mark `Needs mobile confirmation` rather than pretending synchronization succeeded

### Strava-only route

- export GPX from Strava
- import the route into Suunto through the supported Route API
- store the resulting Suunto route ID
- then apply the watch-selection step above

### Local-only route

- upload GPX to Suunto
- store the resulting Suunto route ID
- then apply the watch-selection step above

When the user marks a route `Off watch`, only change watch selection. Do not delete the route from Strava, Suunto Cloud, or the local library unless the user explicitly requests deletion.

## Keeping everything synchronized

### Suunto

Suunto provides route change notifications/webhooks. Use them to update the local cache whenever a route is created or modified in the Suunto ecosystem. Do not poll the route-list endpoint for change monitoring.

### Strava

Strava's current webhook API covers athlete and activity objects, not route-change events. Therefore true push-based real-time route synchronization is not currently available for Strava routes.

Use this policy instead:

- full Strava route refresh on app launch
- refresh on explicit user action
- refresh when the app returns to foreground after a meaningful interval
- optional conservative periodic refresh while the application is open, subject to Strava API rate limits
- compare `updated_at` and geometry fingerprints to detect changes

The UI should show `Last checked` for Strava so the user knows when the route cache was last reconciled.

## Conflict policy

Never use silent last-write-wins across services.

Examples:

- Strava route geometry changed after a Suunto copy was created -> show `Source changed` and offer `Update Suunto copy`.
- Route deleted from Strava but still exists in Suunto -> keep the Suunto route and show `Strava source deleted`.
- Same-named routes with different geometry -> keep both.

## Map experience

The viewport should support:

- high-detail vector basemap
- optional outdoor/topographic map with contours and trails
- all routes intersecting the current area
- source filters: Local / Strava / Suunto / Race
- status filters: On watch / Not on watch / Out of sync / Conflict
- distinct route styling by source/state
- multi-select routes directly from map or side list
- bulk `Add selected to Race` / `Remove selected from Race`

## Basemap

Default keyless fallback: OpenFreeMap vector tiles.

Optional recommended outdoor provider: MapTiler Outdoor v4 via a local `VITE_MAPTILER_KEY`, providing terrain, contours, trails and outdoor POIs. Never commit the key to Git.
