# Silhouette from scratch

Capture and understand Bluetooth sessions between Silhouette Studio and a Silhouette Cameo 5 Alpha.

## Roadmap

1. **Capture sessions — active.** Preserve bidirectional traffic, timing, settings, and the actions associated with each test cut.
2. **Replay captured sessions — locked.** Work starts only when explicitly authorized by the user.
3. **Create new sessions from scratch — future.** Independently construct sessions after capture and replay are understood and authorized.

No replay or device-command generation is implemented.

## Phase 1

See [capture procedure](docs/capture.md). Store local session artifacts under `captures/` (ignored by git). Keep original packet files unchanged and record SHA-256 hashes before analysis.

A useful session includes a packet trace, timestamps, device and application versions, paper/blade/cut settings, a record of user actions, and the physical result. A diagnostic log alone is not a complete session capture.

## Initial environment

Observed 2026-11-11 (Australia/Melbourne):

- macOS 26.6.2 (25G83).
- Silhouette Studio 5.0.402.001 at `/Applications/Silhouette Studio.app`.
- Wireshark installed; `dumpcap -D` exposes no Bluetooth interface.
- PacketLogger was not found by Spotlight. This does not prove it is absent from unindexed locations.
- No Bluetooth packet recording has been started or verified.

## Repository

- `AGENTS.md`: scope and working rules.
- `docs/capture.md`: capture workflow and outstanding setup.
- `captures/`: private local recordings; excluded from version control.
