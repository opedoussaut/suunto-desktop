# Architecture

## Goal

Build a Windows-first desktop application that remains useful even when Suunto-specific APIs are unavailable or limited.

## Logical architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                        suunto-desktop                       │
│                                                             │
│  React / TypeScript UI                                      │
│  ├─ Dashboard                                               │
│  ├─ Maps                                                    │
│  ├─ Routes                                                  │
│  ├─ Trips                                                   │
│  ├─ Activities                                              │
│  └─ Watch                                                   │
│                                                             │
│  Application services                                      │
│  ├─ RouteService                                            │
│  ├─ TripService                                             │
│  ├─ SyncService                                             │
│  ├─ ActivityService                                         │
│  └─ DeviceService                                           │
│                                                             │
│  Adapters                                                   │
│  ├─ GPX                                                     │
│  ├─ FIT                                                     │
│  ├─ Suunto Cloud                                            │
│  ├─ Watch transport                                         │
│  └─ Map providers                                           │
│                                                             │
│  Rust / Tauri                                               │
│  ├─ Filesystem                                              │
│  ├─ SQLite                                                  │
│  ├─ Native device access                                    │
│  └─ Secure credential storage                               │
└─────────────────────────────────────────────────────────────┘
```

## Core entities

### Route

- id
- name
- source file
- geometry
- distance
- ascent
- descent
- elevation profile
- sport type
- tags
- priority (`P0`, `P1`, `P2`)
- cloud sync state
- watch sync state

### Trip

- id
- name
- start/end dates
- geographic region
- ordered route collection
- route priorities

### Activity

- id
- start time
- sport
- duration
- distance
- ascent/descent
- track
- source

### Device

- id
- model
- connection type
- firmware
- battery
- supported capabilities

## Sync model

The local route library is authoritative.

```text
Local GPX / Route DB
        │
        ├── export GPX
        ├── Suunto Cloud adapter
        │        └── official Suunto mobile app
        │                  └── watch sync
        │
        └── direct device adapter (only where officially supported)
```

Each route keeps separate states:

- `local`
- `cloud_pending`
- `cloud_synced`
- `watch_pending`
- `watch_synced`
- `error`

This avoids pretending that cloud and watch synchronization are the same operation.

## Technology choices

### Tauri

Chosen over Electron for a small native footprint, Rust-native device integration, and good Windows packaging.

### React + TypeScript

Provides a productive UI layer and strong ecosystem for maps and data visualization.

### MapLibre GL JS

Open map rendering with the option to support multiple map styles and providers later.

### SQLite

Local, portable route/activity metadata store. GPX/FIT originals remain files and can be referenced from the database.

## Integration policy

1. Prefer official Suunto APIs and documented workflows.
2. Keep API-specific behavior behind adapters.
3. Feature-detect watch capabilities.
4. Do not make reverse-engineered protocols a hard dependency.
5. Preserve original GPX/FIT source files whenever possible.

## MVP vertical slice

The first end-to-end slice should be:

```text
Import GPX
   ↓
Parse route
   ↓
Display map + elevation profile
   ↓
Rename/tag/prioritize
   ↓
Save locally
   ↓
Synchronize through Suunto adapter when credentials/API are available
```

Once this works reliably, add trip collections, watch/device integration, then activity/statistics features.
