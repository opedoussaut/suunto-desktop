# suunto-desktop

A modern desktop companion for Suunto users, focused first on route and map management from a PC.

## Product vision

`suunto-desktop` should make outdoor preparation easier on a large screen: import and organize GPX routes, inspect them on maps with elevation and metadata, synchronize them with the Suunto ecosystem so they are visible on mobile, and progressively add watch and training capabilities.

## MVP priorities

1. **Maps & routes** — import GPX, interactive map, distance/elevation, priorities and trips.
2. **Suunto synchronization** — push supported routes to the user's Suunto account and track sync state.
3. **Watch** — detect supported devices and progressively add documented direct capabilities.
4. **Activities & statistics** — workout history, maps, charts and training statistics.
5. **SuuntoPlus** — explore supported development/deployment workflows.

## Stack

- Tauri 2
- React + TypeScript
- Vite
- MapLibre GL JS
- Rust native layer
- SQLite planned for durable local persistence

## Run the current scaffold

Prerequisites: Node.js/npm, Rust and the Tauri platform prerequisites for Windows.

```bash
npm install
npm run dev
```

Run as a native Tauri window:

```bash
npm run tauri dev
```

The first scaffold already supports GPX import, route metrics, interactive map display, route priority/trip metadata and an elevation profile. Suunto cloud/mobile synchronization is intentionally shown but disabled until the official API flow is validated.

## Architecture principles

- Official APIs and documented protocols first.
- Local-first route library.
- Cloud synchronization is an adapter, not the source of truth.
- Keep route, map, Suunto cloud and device domains separated.
- Never require reverse-engineered behavior for a critical MVP workflow.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/MVP.md`](docs/MVP.md).

## Working name

**suunto-desktop**

This is an independent experimental project and is not affiliated with or endorsed by Suunto.
