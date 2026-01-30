# Task: Panel App – Media Domain MVP (Portrait UI)
ID: FEATURE-MEDIA-DOMAIN-PANEL-MVP
Type: feature
Scope: panel
Size: large
Parent: FEATURE-SPACE-MEDIA-DOMAIN-V2
Status: in-progress

## Purpose

Implement the end-user Media experience in the Panel (Display App) for portrait layout,
using the new backend activity-first model (endpoints + bindings + activation).

This PR delivers activity selector, active card with capability-driven controls,
device list, and device detail pages.

---

## Architecture

### Data Flow

```
Backend REST API                    Panel App
─────────────────                   ─────────
GET /spaces/:id/media/endpoints  →  MediaActivityRepository.fetchEndpoints()
GET /spaces/:id/media/bindings   →  MediaActivityRepository.fetchBindings()
GET /spaces/:id/media/activities/active → MediaActivityRepository.fetchActiveState()
POST .../activate                →  MediaActivityRepository.activateActivity()
POST .../deactivate              →  MediaActivityRepository.deactivateActivity()

WebSocket events                    Panel App
────────────────                    ─────────
media.activity.activating        →  MediaActivityRepository.updateActiveState()
media.activity.activated         →  MediaActivityRepository.updateActiveState()
media.activity.failed            →  MediaActivityRepository.updateActiveState()
media.activity.deactivated       →  MediaActivityRepository.updateActiveState()
```

### State Management

- `MediaActivityRepository` (ChangeNotifier) stores endpoints, bindings, active state
- `MediaActivityService` provides derived helpers:
  - Group endpoints by device
  - Resolve control targets (volume, input, playback, remote)
  - Map activity key to binding to resolved endpoints
- Registered in GetIt locator, exposed via Provider

### UI Components (Portrait)

1. **Activity Selector** - Chips for Watch/Listen/Gaming/Background/Off
2. **Active Activity Card** - Shows state + composition + capability controls
3. **Devices List** - Media devices from endpoints grouped by deviceId
4. **Device Detail Page** - Capability-driven controls per device

### Offline Policy

WebSocket required for media controls. When disconnected, a blocking overlay
prevents interaction while showing last known state read-only.
