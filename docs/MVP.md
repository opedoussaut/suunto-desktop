# MVP — Route-first desktop companion

## Primary outcome

From a Windows PC, import a GPX route, inspect it on a proper map, organize it, and synchronize it into the Suunto ecosystem so it can be seen on the user's phone and selected for the watch wherever Suunto supports that flow.

## Acceptance flow

1. Launch `suunto-desktop`.
2. Import one or more `.gpx` files.
3. See imported routes on a map.
4. Inspect name, distance, ascent/descent and elevation profile.
5. Rename and assign trip, sport and P0/P1/P2 priority.
6. Persist route data locally.
7. Authenticate the Suunto integration.
8. Push a supported route to the Suunto account.
9. Display explicit Local / Mobile / Watch synchronization state.
10. Verify route availability in the supported Suunto mobile workflow.

## Phase 1

- Tauri + React + TypeScript scaffold
- GPX parser
- MapLibre map
- Route list/detail
- Elevation profile
- Local persistence

## Phase 2

- Trip collections
- P0/P1/P2 bulk workflows
- Multi-route maps
- GPX export

## Phase 3

- Suunto authentication adapter
- Route upload/sync adapter
- Mobile visibility validation

## Phase 4

- Watch discovery/status
- Officially supported direct watch operations
- Workout import/read support

## Not required for MVP

- Full replacement of every Suunto mobile setting
- Firmware updates
- Proprietary Suunto offline-map package installation
- Undocumented BLE reverse engineering
- Full training analytics
