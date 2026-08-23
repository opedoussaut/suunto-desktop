# Architecture

## Goal

Build a Windows-first desktop application that remains useful even when Suunto-specific APIs are unavailable or limited.

## Logical architecture

```text
React / TypeScript UI
  ├─ Routes / Maps / Trips
  ├─ Activities
  └─ Watch
        │
Application services
  ├─ RouteService
  ├─ SyncService
  └─ DeviceService
        │
Adapters
  ├─ GPX / FIT
  ├─ Suunto Cloud
  ├─ Watch transport
  └─ Map providers
        │
Rust / Tauri
  ├─ Filesystem
  ├─ SQLite
  ├─ Native device access
  └─ Secure credentials
```

## Sync model

The local route library is authoritative.

```text
Local GPX / Route DB
        │
        ├── Suunto Cloud adapter
        │        └── official Suunto mobile app
        │                  └── watch sync
        └── direct device adapter (only where officially supported)
```

Keep cloud and watch synchronization as separate states. This prevents the UI from claiming a route is on the watch merely because it reached the cloud/mobile library.

## Technology choices

- **Tauri:** small native footprint and Rust-native device integration.
- **React + TypeScript:** productive UI layer.
- **MapLibre GL JS:** open interactive map rendering.
- **SQLite:** planned durable local metadata store; the first UI scaffold uses in-memory state until persistence is implemented.

## Integration policy

1. Prefer official Suunto APIs and documented workflows.
2. Keep API-specific behavior behind adapters.
3. Feature-detect watch capabilities.
4. Do not make reverse-engineered protocols a hard dependency.
5. Preserve original GPX/FIT source files whenever possible.
