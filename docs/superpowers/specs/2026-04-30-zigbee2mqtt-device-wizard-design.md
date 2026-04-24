# Zigbee2MQTT Device Adoption Wizard — Design

**Status:** Approved
**Date:** 2026-04-30
**Author:** Adam Kadlec
**Related:** shelly-ng wizard implementation (reference), `tasks/`

## Goal

Add a multi-device adoption wizard to the `devices-zigbee2mqtt` plugin, modeled on the existing shelly-ng wizard. The wizard makes it easy to adopt many Zigbee devices at once with minimal user input. Auto-mapping, auto-suggested categories, and humanized device names produce sensible defaults; the user only confirms category and (optionally) renames.

## Non-Goals

- The existing single-device add form (`zigbee2mqtt-device-add-form-multi-step.vue`) is **kept unchanged** and remains the path for fine-grained per-device control (mapping preview / mapping customization).
- No Panel (Flutter) wizard UI — adopted devices appear in the panel through normal sync.
- No bulk re-mapping after adoption.
- No removal/repairing of devices in z2m from inside the wizard.
- No new device descriptors / spec generators — the wizard reuses existing mapping infrastructure.

## User Story

> As a user with N Zigbee devices already paired in zigbee2mqtt but not yet adopted in Smart Panel, I open the wizard, see all unadopted devices listed, optionally enable pairing mode for fresh hardware, adjust categories that were auto-detected wrongly, and click "Adopt" to bring them all into Smart Panel in one action.

## High-Level Flow

Three steps, mirroring shelly-ng's UX:

```
Step 1: Discovery        Step 2: Categorize       Step 3: Results
─────────────────       ─────────────────       ─────────────────
Bridge online status    Sortable table:           Sortable table:
                        - Name (editable, pre-    - Status tag
List unadopted devices    filled humanized)         (created/updated/
- realtime via WS       - Friendly name             failed)
- sortable                (read-only)             - Name
- multi-select          - Manufacturer/model      - Friendly name
                          (read-only)             - Manufacturer/model
[Pair new device]       - Status (will create/    - Error message
button:                   will update)
  → permit_join 254s    - Category (dropdown,
  → live countdown        editable)
  → cancel button       - "N channels" badge
                          (tooltip lists ids)
```

### Step 1 — Discovery

- **Bridge offline:** banner with link to Zigbee2MQTT plugin config; table disabled.
- **Bridge online:** table lists devices that are paired in zigbee2mqtt but not yet adopted in Smart Panel.
- Real-time updates via existing `Z2mWsClientAdapterService` events (no client polling needed beyond reading session state).
- "Pair new device" button toggles `permit_join: 254s` on the bridge; live countdown bar; "Cancel pairing" stops it early. Auto-disables on wizard close, step exit, or session expiry.
- Newly-pairing devices appear with a brief highlight animation.
- Auto-selects all devices with `status=ready`.
- Devices with no matching descriptor → status `unsupported`, not selectable.

### Step 2 — Categorize

- Editable name, pre-filled with **humanized** friendly_name (`living_room_lamp` → `Living Room Lamp`). Original z2m identifier kept internally.
- Pre-filled category from descriptor's suggested category (or first matching one if multiple categories apply).
- "N channels" badge with tooltip listing channel identifiers.
- Sortable columns (natural-orderby + reactive maps, same as shelly).
- Validation: cannot proceed if any selected row has empty name or no category.

### Step 3 — Results

- Sortable read-only table.
- Per-device outcome: `created` / `updated` / `failed` + error message.
- "Done" closes the wizard. "Add more" creates a **new** session (`POST /wizard`), discarding the current one's state and returning the user to Step 1.

## Backend Design

**Location:** `apps/backend/src/plugins/devices-zigbee2mqtt/`

### New files

```
controllers/
  zigbee2mqtt-wizard.controller.ts       # REST endpoints
services/
  z2m-wizard.service.ts                  # Session lifecycle, permit_join, batch adoption
models/
  z2m-wizard-session.model.ts            # Response model
  z2m-wizard-device-snapshot.model.ts    # Device row in session
  z2m-wizard-adoption-result.model.ts    # Per-device adoption outcome
dto/
  z2m-wizard-adopt.dto.ts                # POST body: array of {ieeeAddress, name, category}
```

### REST endpoints

Mounted under the plugin's existing route prefix (`/plugins/devices-zigbee2mqtt`).

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/wizard` | Start session; returns initial device list + bridge status |
| `GET` | `/wizard/:id` | Poll session state (devices, permit_join remaining, bridge status) |
| `POST` | `/wizard/:id/permit-join` | Enable `permit_join` for 254s, return updated session |
| `DELETE` | `/wizard/:id/permit-join` | Disable `permit_join` early |
| `POST` | `/wizard/:id/adopt` | Batch adopt selected devices with name+category overrides |
| `DELETE` | `/wizard/:id` | End session, cleanup permit_join if active |

### `Z2mWizardService`

Responsibilities:

- In-memory session map (10-min idle TTL).
- Subscribe to existing z2m events (`device-joined`, `device-announced`, `bridge-state-changed`) and update session snapshots.
- Compute device snapshot per device:
  - `friendlyName`, `manufacturer`, `model`, `ieeeAddress`
  - `status`: `ready` | `unsupported` | `already_registered` | `failed`
  - `suggestedCategory`, `availableCategories`
  - `previewChannelCount`, `previewChannelIdentifiers[]`
  - `registeredDeviceId`, `registeredDeviceName`, `registeredDeviceCategory` (when already adopted)
- `permitJoin: { active, expiresAt, remainingSeconds }` block in session.
- `adopt(sessionId, devices[])`:
  - Refresh-before-adopt (re-check current status to avoid stale reads).
  - Per device: call existing `Z2mDeviceAdoptionService.adoptDevice()` with name + category overrides.
  - Race fallback: if the device is now `already_registered`, route to update path.
  - Returns `Z2mWizardAdoptionResult[]`.
- Session cleanup: on session expire/delete, disable `permit_join` if still active.
- `onModuleDestroy()`: disable any active permit_join sessions before app shutdown.

### Reused infrastructure (no duplication)

- `Z2mDeviceAdoptionService` — adoption call.
- `Z2mMappingPreviewService` — channel preview / count.
- `Z2mExposesMapperService` — mapping resolution.
- `Z2mWsClientAdapterService` / `Z2mMqttClientAdapterService` — events + permit_join command.
- `Zigbee2mqttService.isBridgeOnline()` — bridge status.

### Key delta from shelly-ng

- **No 30s scan timer** — z2m maintains the device list. Sessions are long-lived.
- Only `permit_join` is timed (managed inside the session).

## Admin (Vue) Design

**Location:** `apps/admin/src/plugins/devices-zigbee2mqtt/`

### New files

```
components/
  zigbee2mqtt-devices-wizard.vue           # Top-level wizard
  zigbee2mqtt-wizard-discovery-step.vue    # Step 1
  zigbee2mqtt-wizard-categorize-step.vue   # Step 2
  zigbee2mqtt-wizard-results-step.vue      # Step 3
composables/
  useDevicesWizard.ts                      # Wizard state mgmt (mirrors shelly's composable)
  useFriendlyNameHumanizer.ts              # snake/kebab/camel → Title Case
types/
  wizard.ts                                # IZ2mWizardSession, IZ2mWizardDevice,
                                           # IZ2mWizardAdoptionResult
```

### Plugin registration

In `devices-zigbee2mqtt.plugin.ts`:

```typescript
registerComponents({
  deviceWizard: Zigbee2mqttDevicesWizard,
  // existing: deviceAddForm, deviceEditForm, configForm
})
```

This integrates with the Devices module's plugin component registry exactly like shelly-ng (`DEVICES_SHELLY_NG_TYPE` → `DEVICES_ZIGBEE2MQTT_TYPE`), so the wizard appears in the same place.

### `useDevicesWizard` composable state

- `session`, `devices[]`, `selected: Set<ieeeAddress>`
- `nameByIeee: Record<string, string>` (user overrides)
- `categoryByIeee: Record<string, DeviceCategory>` (user overrides)
- `permitJoin: { active, remainingSeconds, expiresAt }`
- `bridgeOnline: boolean`
- 1s polling of `GET /wizard/:id` to refresh `permitJoin.remainingSeconds` and pick up devices that the backend pushed into the session via z2m events. (No client-side WebSocket subscription; the backend service is the single subscriber to z2m events and materializes them into the session snapshot.)

### Auto-population

- On session start: every device with `status=ready` is auto-selected; name pre-filled (humanized from friendly_name); category pre-filled from `suggestedCategory`.
- On `ready → already_registered` transition (e.g., backend auto-adopt happens mid-wizard): deselect; row switches to "will update".

### Step 1 UX

- Bridge offline: banner with config link, table disabled.
- Bridge online: sortable table with status tags (`ready` / `unsupported` / `already_registered`).
- "Pair new device" button (disabled when bridge offline) starts permit_join with countdown bar; "Cancel pairing" stops early.
- Newly-paired devices get a brief highlight animation.

### Step 2 UX (Categorize)

- Sortable table — same comparator pattern as shelly (natural-orderby + reactive maps).
- Columns: checkbox, Name (editable), Friendly name (read-only, monospace), Manufacturer/Model (read-only, secondary), Status, Category (select), Channels (badge with tooltip).
- Header actions: "Auto-pick all" / "Clear selection".
- Cannot proceed if any selected row has empty name or unset category.

### Step 3 UX (Results)

- Sortable read-only table.
- Columns: Status, Name, Friendly name, Manufacturer/Model, Error.
- "Done" / "Add more" actions.

### Error handling

- Bridge offline mid-wizard → toast + table greys out; wizard remains open for retry.
- Per-device adoption failure → row marked `failed` in step 3; other devices still adopted (partial success, not all-or-nothing).
- Session expires (10min idle) → banner "Wizard session expired, please reopen".

### i18n

New keys under `plugins.devices-zigbee2mqtt.wizard.*` in admin locales (en, cs, etc., matching the keys shelly added).

## Types & Spec Generation

- Backend response models annotated with `@ApiProperty` Swagger decorators → flow into OpenAPI spec via `pnpm run generate:openapi`.
- Admin types regenerated automatically into `apps/admin/src/openapi.ts`.
- Schema names follow project convention:
  - `Zigbee2mqttPluginResWizard*`
  - `Zigbee2mqttPluginReqWizard*`
  - `Zigbee2mqttPluginDataWizard*`
- No new spec generators (`apps/backend/src/spec/` unchanged — wizard isn't a device descriptor).
- No DB migrations — sessions are in-memory.

## Testing

### Backend (Jest)

- `z2m-wizard.service.spec.ts` — session lifecycle, permit_join enable/disable, adoption with overrides, race fallback (`already_registered`), session expiry cleanup, `onModuleDestroy` cleanup.
- `zigbee2mqtt-wizard.controller.spec.ts` — endpoint contracts, DTO validation, response envelope shape.
- E2E `test/zigbee2mqtt-wizard.e2e-spec.ts` — full flow against in-memory sqlite + mocked z2m adapter.

### Admin (Vitest)

- `useDevicesWizard.spec.ts` — auto-select logic, ready→already_registered transition, name/category override map, permit_join countdown.
- `useFriendlyNameHumanizer.spec.ts` — snake/kebab/camel → Title Case (edge cases: numbers, abbreviations, single words).

## Lifecycle / Cleanup Edge Cases

- **App shutdown with active permit_join** → `Z2mWizardService.onModuleDestroy()` disables permit_join on every active session.
- **Wizard closed mid-pairing** → frontend calls `DELETE /wizard/:id`, which disables permit_join.
- **Session idle 10min** → expiry sweep (60s interval) closes session and disables permit_join.
- **Bridge disconnect mid-pairing** → adapter raises event; service marks session `permitJoin.active=false`; user sees banner.
- **Concurrent auto-adoption** by background sync → wizard refresh-before-adopt detects updated status; adopts via update path; row reflects "updated" outcome.

## Open Questions

None — all design points resolved during brainstorming.

## Out of Scope

- Panel (Flutter) wizard UI.
- Mapping preview / customization in the wizard (existing single-device form covers this).
- Bulk re-mapping after adoption.
- Removing/unpairing devices from z2m through the wizard.
- New device descriptors or spec changes.
