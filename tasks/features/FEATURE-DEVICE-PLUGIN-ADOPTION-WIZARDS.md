# Task: Device plugin adoption wizards
ID: FEATURE-DEVICE-PLUGIN-ADOPTION-WIZARDS
Type: feature
Scope: backend, admin, spec
Size: large
Parent: (none)
Status: in-progress
Created: 2026-08-12

## 1. Business goal

In order to bring existing devices into Smart Panel without manually reproducing their configuration,
as a Smart Panel administrator,
I want each discoverable/importable device integration to offer a guided adoption wizard that discovers candidates,
lets me select many devices at once, applies safe automatic defaults, and reports a result for every selected device.

## 2. Current-state audit

The devices module already owns a shared three-step adoption shell (`discover -> confirm -> results`) through
`IDeviceWizardAdapter`. Shelly v1, Shelly NG, and Zigbee2MQTT register adapters. The shell owns selection, names,
categories, actions, and result rendering; plugins own discovery, mapping, transport, and adoption.

The remaining device-capable plugins do not all represent the same workflow. Only integrations with an external
inventory should be added to the shared adoption wizard.

| Plugin | Current setup path | Decision |
|---|---|---|
| Shelly v1 | Shared discovery wizard, mDNS/manual host | Already covered |
| Shelly NG | Shared discovery wizard, mDNS/manual host | Already covered |
| Zigbee2MQTT | Shared pairing/adoption wizard | Already covered |
| Home Assistant | Five-step, one-device-at-a-time controlled adoption form backed by discovery, mapping-preview, customization, and adoption APIs | **P0: add a question-free bulk-import wizard while retaining the current controlled adoption form unchanged** |
| WLED | mDNS discovery API plus a manual device form; auto-add is the only path that invokes the full mapper | **P1: add a shared discovery/adoption wizard and a backend adoption API** |
| reTerminal | The connector detects local hardware and provisions the single host device automatically | No adoption wizard; expose automatic-detection status instead of pretending there is a device inventory |
| Third Party | Manually configured outbound service address; no discovery provider or import inventory | Keep the focused manual form; no wizard until the plugin gains a real discovery contract |
| Virtual Devices | Bespoke construction wizard that composes existing properties | Already covered by the correct non-discovery wizard |
| Simulator | Generates synthetic devices from specifications; it does not adopt external devices | Separate generation wizard candidate; do not force it into `IDeviceWizardAdapter` |

### Important findings

1. The shared shell preselects every first-seen `ready` row. That is suitable for a small Shelly/Zigbee session but
   unsafe for a Home Assistant instance containing hundreds of devices and helpers.
2. The shared tables have sorting but no search/filter support. A large Home Assistant inventory would be difficult to
   review.
3. Home Assistant already has mature mapping preview and adoption services, but its add-form composable constructs the
   final channel request client-side and handles one item at a time.
4. Calling the existing Home Assistant preview endpoint once per inventory row would repeatedly fetch HA registries and
   states. A bulk wizard needs one upstream snapshot, not an N+1 request loop.
5. WLED's discovery endpoint returns only unadded mDNS records. The backend has no explicit adopt/probe endpoint, and a
   raw device created by the current manual form does not run `WledDeviceMapperService.mapDevice()`, so it can remain
   without its generated channels and properties.

## 3. Product rules

- The shared wizard is for **discover/import/adopt** flows only.
- Home Assistant intentionally has two complementary adoption paths:
  - **Bulk wizard:** select many automatically mapped items and adopt them without per-device questions.
  - **Controlled adoption:** keep the existing one-device-at-a-time form for category selection, mapping preview,
    mapping customization, naming, description, and final review.
- The Home Assistant bulk wizard must never replace, hide, or reduce the capabilities of the controlled adoption form.
- The Home Assistant bulk wizard derives name, category, channels, and properties automatically. It does not ask the
  administrator to edit them during the bulk flow.
- An already-adopted Home Assistant item is informational and non-selectable. Updating/remapping it is not silently
  folded into bulk adoption.
- One failed device must not roll back successful siblings; results are reported per item.
- Device identity is derived and validated by the backend integration (HA ID, WLED MAC), never trusted from an editable
  browser field.
- Discovery/probing must not create persistent devices or leak connections. Persistence begins only on adoption.

## 4. Scope

### In scope

- Shared-wizard hardening for large inventories.
- Home Assistant bulk inventory, mapping summary, and adoption wizard.
- WLED discovery, manual probe, and adoption wizard.
- Reuse of existing mapping/adoption services and plugin registration through `deviceWizardAdapter`.
- OpenAPI regeneration after backend endpoint/model changes.
- Admin translations in all supported locales.
- Unit/component tests and focused backend E2E coverage.
- A small setup-capability cleanup so only real adoption wizards appear in the device wizard chooser.

### Out of scope

- Replacing, simplifying, or removing the existing Home Assistant controlled adoption form.
- Adding per-device name, category, description, or mapping questions to the Home Assistant bulk wizard.
- Bulk remapping or deletion of already-adopted Home Assistant devices.
- A discovery wizard for Third Party without a provider-side inventory API.
- A reTerminal adoption wizard (the plugin is a singleton local-hardware detector).
- Reworking the existing Virtual Devices wizard.
- A Simulator generation wizard; track that separately if desired.
- Unifying every plugin's backend endpoints into a common REST contract.
- Panel/Flutter changes.

## 5. Proposed architecture

### 5.1 Shared wizard hardening

Extend the shell without moving plugin transport logic into the devices module:

- Add an optional adapter-owned default-selection hint to `IWizardRow` (for example `selectedByDefault?: boolean`).
  Existing adapters retain current behavior when it is omitted; Home Assistant sets it to `false`.
- Add an adapter confirmation mode (for example `confirmationMode: 'editable' | 'selection-only'`). Existing adapters
  default to `editable`. Home Assistant uses `selection-only`, which shows the automatically resolved name/category as
  read-only context and asks only which rows to adopt.
- Add search to discover and confirm tables. Match label, sub-label, identifier, status label, and textual extra-cell
  values. Keep selection/name/category state for rows hidden by the current query.
- Define select-all semantics over the currently filtered adoptable rows and cover the indeterminate state.
- Show compact totals (found, adoptable, already added, unsupported) so a filtered large inventory remains legible.
- Keep the adapter contract declarative. If a new presentation primitive is required, add a typed cell/control variant;
  do not add a plugin-rendered slot.

Primary files:

- `apps/admin/src/modules/devices/components/wizard/device-wizard.types.ts`
- `apps/admin/src/modules/devices/composables/useDeviceWizardState.ts`
- `apps/admin/src/modules/devices/components/wizard/device-wizard-discover-step.vue`
- `apps/admin/src/modules/devices/components/wizard/device-wizard-confirm-step.vue`
- related specs under the same module

### 5.2 Home Assistant wizard backend

Add a plugin-owned wizard service/controller that builds a bulk inventory snapshot and performs server-side default
adoption. Use a bounded, expiring wizard session, matching the existing plugin wizard lifecycle:

- `POST /plugins/devices-home-assistant/wizard` creates a session and returns its inventory snapshot.
- `GET /plugins/devices-home-assistant/wizard/{id}` returns the current session snapshot.
- `POST /plugins/devices-home-assistant/wizard/{id}/adopt` adopts a batch and returns per-item outcomes.
- `DELETE /plugins/devices-home-assistant/wizard/{id}` disposes the snapshot; expired sessions are cleaned up
  automatically.

The implementation must meet these behavioral requirements:

- Fetch HA device registry, entity registry, device/helper lists, and states once per inventory refresh.
- Refactor mapping-preview logic so the existing single-item endpoints and the bulk inventory can use the same pure
  mapping functions with a supplied snapshot/context.
- Return one normalized summary for each physical device and helper:
  - namespaced stable key (`device:<ha-id>` / `helper:<entity-id>`), item kind, label, identifier;
  - adopted Smart Panel device ID when present;
  - entity/channel counts, warning count, suggested name/category, and `readyToAdopt`;
  - a reason when automatic adoption is unsupported or requires the controlled adoption path.
- Accept a batch containing only selected item keys. Revalidate each selected item against current HA data, resolve the
  name/category automatically, build channels/properties from the shared preview-to-adoption builder, and delegate
  persistence to the existing `DeviceAdoptionService` / `HelperAdoptionService`.
- Return `created` or `failed` per item; do not fail the whole response because one item became stale or unsupported.
- Bound inventory/session lifetime and cleanup. Never retain HA access tokens or raw secret config in session models.
- Preserve the existing single-device discovery, preview, customization, and adoption endpoints and their UI behavior.

Likely files:

- new `controllers/home-assistant-wizard.controller.ts`
- new `services/home-assistant-wizard.service.ts`
- new wizard DTOs/models and Swagger registration
- refactors in `mapping-preview.service.ts`, `helper-mapping-preview.service.ts`, and adoption request construction
- backend unit tests plus controller/E2E coverage

### 5.3 Home Assistant admin adapter

Create `apps/admin/src/plugins/devices-home-assistant/composables/useDevicesWizard.ts` and register it as
`deviceWizardAdapter`.

Behavior:

- Start/refresh the HA inventory and map summaries to shared rows.
- Do not preselect rows by default; the administrator explicitly chooses devices, with search and filtered select-all
  making large batches practical.
- Use the shell's selection-only confirmation mode. Display automatic name/category/mapping summaries as read-only;
  do not render editable name or category controls and do not introduce additional per-device steps.
- Render devices and helpers together with a type column; show entity/channel counts and mapping readiness/warnings.
- Map inferred, valid previews to `ready`; adopted items to `already_registered`; automatic-mapping failures to
  `unsupported`; transport/config failures to `failed` plus a banner.
- When HA is unconfigured or offline, show a clear banner linking to the plugin configuration page.
- Provide a refresh action. If sessions are used, dispose them on unmount and restart them for “Add more”.
- Batch-adopt the shell selection and refresh the local devices/discovery stores from the returned results.
- Show a link and explanatory copy to the controlled adoption path when an item needs category or entity-level mapping
  decisions. Keep `HomeAssistantDeviceAddForm` unchanged as that path.

### 5.4 WLED backend adoption path

Build explicit discovery/probe/adoption operations around existing WLED services:

- Return discovered candidates with a stable MAC identity where available, host, port, advertised name, and adoption
  state. Do not hide already-adopted records from the wizard response.
- Add a manual-host probe operation that retrieves WLED info with the configured timeout but does not persist the
  device or leave a registered WebSocket/client connection behind.
- Add a refresh operation for the mDNS browser or otherwise expose a deterministic rescan trigger.
- Add batch adoption accepting host plus confirmed name/category. The backend probes again, derives identity from the
  actual WLED response, rejects duplicates, then calls `WledDeviceMapperService.mapDevice()` so device, channels, and
  properties are provisioned together.
- Restrict the category to the categories genuinely supported by the mapper (currently `lighting`).
- Return per-device outcomes and tolerate partial failure.
- Route the existing manual WLED add form through the same probe/adoption service (or remove it from the selectable
  manual path) so it cannot create an incomplete raw device.

Primary files:

- `apps/backend/src/plugins/devices-wled/controllers/wled-discovery.controller.ts`
- new WLED discovery/adoption DTOs and response models
- `apps/backend/src/plugins/devices-wled/services/wled.service.ts`
- `apps/backend/src/plugins/devices-wled/services/device-mapper.service.ts`
- focused service/controller tests

### 5.5 WLED admin adapter

Create and register `apps/admin/src/plugins/devices-wled/composables/useDevicesWizard.ts`.

Behavior:

- Poll the discovery inventory while the wizard is open and stop polling on dispose.
- Show mDNS candidates with name, host, MAC, and registered status.
- Provide a rescan action and a manual host/IP form; manual probe failures retain the entered value for correction.
- Suggest `lighting` and preselect newly discovered ready devices (WLED inventories are normally small).
- Adopt selected candidates through the new backend batch endpoint and present partial results.
- Support “Add more” by clearing UI state and starting a fresh discovery pass.
- Work when mDNS is disabled by leaving the manual-host probe available and explaining why automatic discovery is off.

## 6. Delivery sequence

Each phase should be independently reviewable and keep the branch green.

1. **Shared shell hardening (admin)**
   - adapter-controlled default selection;
   - selection-only confirmation mode;
   - search/filter and filtered select-all;
   - inventory totals and regression tests for Shelly/Zigbee behavior.
2. **Home Assistant bulk backend (backend + spec source)**
   - snapshot/context refactor;
   - summary/session endpoint;
   - batch default-adoption endpoint and tests.
3. **Regenerate OpenAPI after the HA endpoints (spec/admin/panel generated outputs)**
   - run `pnpm run generate:openapi`; do not hand-edit generated files.
4. **Home Assistant adapter (admin)**
   - rows, controls, config/offline handling, results, registration, locales, tests.
5. **WLED backend adoption path (backend + spec source)**
   - enriched discovery, manual probe, rescan, mapper-backed batch adoption, tests.
6. **Regenerate OpenAPI after the WLED endpoints (spec/admin/panel generated outputs)**
   - run `pnpm run generate:openapi`; do not hand-edit generated files.
7. **WLED adapter and manual-form correction (admin)**
   - wizard registration, polling/manual controls, locales, tests;
   - ensure the old manual path uses the same mapper-backed adoption operation.
8. **Integration QA and documentation**
   - permission/config/offline/large-inventory/partial-failure passes;
   - verify chooser only lists enabled plugins with registered adapters;
   - verify current Shelly and Zigbee wizards are unchanged.

Recommended implementation order is Home Assistant before WLED despite WLED being smaller: the shared-shell changes
should be driven by the largest real inventory, and Home Assistant delivers the highest administrator value.

## 7. Acceptance criteria

### Shared shell

- [x] Existing Shelly v1, Shelly NG, and Zigbee2MQTT wizard behavior and tests remain green.
- [x] An adapter can opt out of default row selection without abusing row status.
- [x] An adapter can use selection-only confirmation while existing adapters retain editable name/category confirmation.
- [x] Discover and confirm inventories can be searched without losing edits or selection state.
- [x] Select-all acts on the documented filtered set and has correct checked/indeterminate states.
- [ ] Large inventories remain usable on desktop and mobile layouts.

### Home Assistant

- [x] Home Assistant appears in the device wizard chooser only when its plugin is enabled.
- [x] A configured instance lists physical devices and helpers with adoption and automatic-mapping status.
- [x] Inventory loading avoids one HA registry/state round trip per item.
- [x] No HA item is selected automatically on first load.
- [x] The administrator can select multiple ready items and adopt them in one operation without answering name,
  category, description, or mapping questions.
- [x] Bulk adoption derives names, categories, channels, and properties from the automatic mapping preview and
  revalidates those decisions on the backend before persistence.
- [x] Successful items create spec-valid devices/channels/properties through existing adoption services.
- [x] Already-adopted items are visible but not selectable for bulk adoption.
- [x] Items requiring category or mapping decisions are not bulk-adoptable and clearly direct the administrator to the
  existing controlled adoption form.
- [x] The existing controlled adoption form remains available and behaviorally unchanged for one-device-at-a-time
  category selection, mapping preview/customization, naming, description, and final review.
- [x] Unconfigured/offline HA produces an actionable configuration banner, not an empty table or raw API error.
- [x] Partial batch failure leaves successful devices adopted and reports a reason for each failed item.

### WLED

- [x] WLED appears in the device wizard chooser only when its plugin is enabled.
- [x] mDNS devices appear without being auto-created.
- [x] An administrator can probe a manual hostname/IP when mDNS is disabled or unavailable.
- [x] Probe-only operations do not persist devices or leak client connections.
- [x] Adoption derives identity from WLED data and provisions the full mapped device structure.
- [x] Duplicate/already-adopted devices are not created twice.
- [x] The existing manual WLED path cannot create an incomplete device.
- [x] Rescan, add-more, offline, timeout, and partial-failure flows are covered.

### Quality

- [x] Backend unit tests cover snapshot reuse, identity/deduplication, mapping delegation, and partial outcomes.
- [x] Admin unit/component tests cover adapter row mapping, controls, lifecycle cleanup, and adoption payloads.
- [x] Relevant authenticated E2E endpoints are covered.
- [x] OpenAPI is regenerated from backend Swagger decorators.
- [x] `pnpm --filter ./apps/admin run test:unit`, relevant backend Jest suites, and `pnpm run lint:js` pass.
- [x] All six admin locales have parity for new user-visible keys.

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| HA inventories are large and expensive to preview | Build one upstream snapshot, separate summary from full detail, and bound any CPU concurrency/session lifetime |
| HA data changes between preview and adoption | Revalidate selected items server-side immediately before persistence and report stale items individually |
| Bulk adoption overwhelms HA/backend | Use bounded concurrency or sequential persistence; expose progress through busy state and per-item results |
| Automatic HA mapping would require an administrator decision | Mark the row non-bulk-adoptable and direct it to the unchanged controlled adoption form |
| WLED host/IP changes cause duplicates | Derive canonical identity from probed MAC/device info, treating host as a mutable address |
| Probes leave temporary sockets/connections | Use a stateless probe client or explicit `finally` cleanup; cover it in tests |
| Shared-shell changes regress current adapters | Preserve fallback behavior and land shell tests before registering new adapters |
| A non-discoverable plugin is forced into the shared shell | Keep explicit eligibility rules from the audit; construction/generation/manual plugins use their own UX |

## 9. Follow-ups (separate tasks)

- A Simulator generation wizard using `GET /plugins/simulator/categories` and `POST /plugins/simulator/generate`.
- A reTerminal integration-status card showing detected variant and automatic provisioning state.
- A formal provider-discovery contract for Third Party integrations, if that plugin becomes more than the current demo/
  manually-addressed proxy.
- Bulk remap/update for already-adopted Home Assistant devices.
