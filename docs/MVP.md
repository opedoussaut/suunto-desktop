# MVP — Route-first desktop companion

## Primary user outcome

From a Windows PC, a user can import a GPX route, inspect it on a proper map, organize it, and synchronize it into the Suunto ecosystem so it can be seen on the user's phone and selected for the watch where Suunto supports that workflow.

## MVP acceptance flow

1. Launch `suunto-desktop`.
2. Import one or more `.gpx` files.
3. See every imported route on a map.
4. Select a route and see:
   - name
   - distance
   - ascent/descent
   - elevation profile
   - source file
5. Rename the route and assign:
   - trip
   - sport
   - priority P0 / P1 / P2
   - tags
6. Save changes locally.
7. Authenticate the Suunto integration.
8. Push a selected supported route to the Suunto account.
9. Display a clear synchronization state.
10. Verify the route is available through the supported Suunto mobile workflow.

## MVP screens

### Routes

Default screen. Route list + filters + sync state.

### Map

Large map canvas with selected route, start/end markers, waypoints, route metadata and elevation profile.

### Trips

Collections such as `Lofoten 2026`, with P0/P1/P2 grouping and bulk sync actions.

### Watch

Initially capability/status focused. Direct actions are enabled only when the transport/protocol is supported and validated.

### Settings

Suunto integration, map provider configuration and local data paths.

## UX principles

- Route-first, not settings-first.
- Large map area and excellent information hierarchy.
- One-click visibility of route state: Local / Cloud / Watch.
- Bulk operations for trip preparation.
- Never hide synchronization failures.
- Avoid mobile-app-style cramped navigation on desktop.

## Phase 1

- Tauri + React + TypeScript scaffold
- GPX parser
- MapLibre map
- Route list
- Route detail panel
- Elevation profile
- Local persistence

## Phase 2

- Trip collections
- P0/P1/P2 priorities
- Multi-route map display
- GPX export
- Bulk actions

## Phase 3

- Suunto authentication adapter
- Route upload/sync adapter
- Synchronization state and errors
- End-to-end validation with official Suunto mobile app

## Phase 4

- Watch discovery/device status
- Officially supported direct watch operations
- Workout import/read support

## Not required for MVP

- Replacing every Suunto mobile setting
- Firmware updates
- Proprietary Suunto offline-map package installation
- Undocumented BLE reverse engineering
- Full training analytics
