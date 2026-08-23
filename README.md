# suunto-desktop

A modern desktop companion for Suunto users, focused first on route and map management from a PC.

## Product vision

`suunto-desktop` should make outdoor preparation easier on a large screen: import and organize GPX routes, inspect them on maps with elevation and metadata, synchronize them with the Suunto ecosystem so they are visible on mobile, and progressively add watch and training capabilities.

## MVP priorities

1. **Maps & routes**
   - Import GPX files
   - Display routes on an interactive map
   - Show distance, elevation gain/loss and elevation profile
   - Rename, tag and organize routes
   - Trip collections and priorities such as P0 / P1 / P2

2. **Suunto synchronization**
   - Authenticate with the Suunto ecosystem
   - Push supported routes to the user's Suunto account
   - Track synchronization state
   - Make the same route available in the official Suunto mobile app whenever supported by the Suunto API

3. **Watch**
   - Detect a compatible Suunto watch over supported desktop transports
   - Show basic device information
   - Explore supported direct route/app/workout interactions without relying on undocumented behavior for the core MVP

4. **Activities & statistics**
   - Import/read supported workout data
   - Activity history
   - Maps, charts and training statistics

5. **SuuntoPlus**
   - Explore supported SuuntoPlus development/deployment workflows

## Initial technical direction

- **Desktop shell:** Tauri
- **Frontend:** React + TypeScript
- **Build tooling:** Vite
- **Maps:** MapLibre GL JS
- **Local persistence:** SQLite
- **Native/device layer:** Rust
- **Route format:** GPX as the interchange baseline

## Architecture principles

- Official APIs and documented protocols first.
- Local-first route library: the user should retain their GPX data on the PC.
- Cloud synchronization is an adapter, not the source of truth.
- Separate `route`, `map`, `suunto-cloud`, and `device` domains so unsupported Suunto capabilities do not block the rest of the application.
- Never require reverse-engineered behavior for a critical MVP workflow.

## Repository status

Initial project definition. Application scaffold and first route/map vertical slice are next.

## Working name

**suunto-desktop**

This is an independent experimental project and is not affiliated with or endorsed by Suunto.
