# Homey Device Integration — Implementation Plan

**Goal:** Deliver a secure local Homey SHS/Homey Pro provider with discovery, mapping preview, adoption, real-time synchronization, and control, then add Homey Cloud as a second connector.

**Architecture:** One `devices-homey` plugin owns provider-domain behavior. A transport-independent `HomeyConnector` produces normalized devices/capabilities/events. Mapping, preview, adoption, synchronization, and control depend only on that contract. Admin uses the shared device wizard; Flutter uses the normal Devices API and state stream.

**Spec:** `docs/superpowers/specs/2026-08-12-homey-integration-design.md`

**Task:** `tasks/features/FEATURE-PLUGIN-HOMEY.md`

## Global constraints

- Complete the live compatibility spike and fixture capture while the one-month SHS subscription is active.
- Never commit or print a real API key, OAuth token, household device name, private address, or unsanitized payload.
- Do not edit generated files manually. Generate OpenAPI/admin/panel clients from backend Swagger sources and device specs from their generators.
- Follow existing TypeScript tab indentation, naming, imports, Swagger response envelopes, tests, and plugin registration conventions.
- Keep external calls bounded by timeouts and classify authentication, authorization, timeout, unavailable, protocol, validation, and unsupported failures.
- Never mutate ordinary upstream Homey devices. Capability writes require an explicit device/capability allowlist; add/rename/zone-move/unavailable/remove lifecycle tests require a separate environment gate and an operation allowlist restricted to a designated disposable virtual/test device.
- No database schema change is expected. If implementation evidence requires one, add an incremental migration and update this plan before proceeding.
- Do not push to `main`. Use a feature branch and PR when implementation begins.

## Delivery map

| Milestone | Outcome                                                |             Estimate |
| --------- | ------------------------------------------------------ | -------------------: |
| 0         | Verified SHS contract and sanitized fixture corpus     |             2–3 days |
| 1         | Secret-safe config foundation and backend plugin shell |             3–4 days |
| 2         | Local connector, lifecycle, normalization, and health  |             4–6 days |
| 3         | Mapping, preview, discovery, and adoption              |             6–8 days |
| 4         | Real-time sync, reconciliation, and control            |             4–6 days |
| 5         | Admin wizard/config and panel integration              |             4–6 days |
| 6         | Hardening, live matrix, docs, and release gate         |             2–3 days |
| 7         | Homey Cloud connector                                  | 7–12 additional days |

Local MVP total: approximately 25–36 engineering days. Backend and admin tasks can overlap after Milestone 3 stabilizes the API contract.

---

## Milestone 0: SHS compatibility spike and fixtures

### Task 0.1: Establish a safe live test environment

**Deliverables:**

- Create: `docs/homey-shs-compatibility.md`
- Create: `apps/backend/src/plugins/devices-homey/__fixtures__/README.md` when the plugin directory is introduced

- [ ] Record SHS version, container image digest, installation topology, exposed ports, capture date, and Smart Panel runtime network path.
- [ ] Give SHS a stable LAN address; prefer host networking or a dedicated address consistent with Homey guidance.
- [ ] Create a least-privilege API key with only device read/control, zone read, and system read permissions required by the design.
- [ ] Designate one harmless writable test capability; record only a synthetic alias in repository documents.
- [ ] Designate one disposable virtual/test device for lifecycle mutations. It must not represent household equipment, and repository documents record only its synthetic alias.
- [x] Define environment variables for live tests. Do not store secret values in shell history, fixtures, `.env` files, or repository config.
- [x] Add an explicit live-write allowlist contract requiring both device ID and capability ID.
- [x] Add a separately enabled lifecycle-mutation allowlist with an immutable synthetic marker, exact test
      driver/owner/names/zones, and the canonical operations: add, rename, zone move, availability change, and remove.
      Bind the runtime device ID only after a matching create event and fresh ownership read-back because Homey assigns
      the top-level ID during creation.

**Verification:** Review the compatibility document for secret/private data before committing it.

### Task 0.2: Probe the local API contract

**Reference:** Official local API factory, ManagerDevices, Device capability/event documentation, and SHS port documentation linked by the design.

- [ ] Verify connection with the documented SDK against HTTP `4859` and HTTPS `4860` where the installation supports them.
- [x] Capture sanitized system information and manager state.
- [x] Capture zones and zone hierarchy.
- [x] Capture the complete device inventory and individual device objects.
- [x] Capture capabilities with values, types, units, ranges, enums, readable/writable flags, and repeated/suffixed IDs.
- [ ] Verify Socket.IO connection and record subscription/event ordering for capability changes and availability changes.
- [ ] Write the allowlisted test capability and confirm the resulting event plus subsequent read.
- [ ] Test invalid key, missing scopes, bad URL, unavailable host, and request timeout behavior.
- [ ] Test SHS restart, network interruption/restoration, and API-key revocation.
- [ ] On the separately gated disposable device only, test add, rename, zone move, unavailable, and removal events or inventory deltas; clean up the disposable device after capture.
- [x] Inspect mDNS advertisements before and after restart. Record exact service type/TXT fields only if stable.
- [ ] If Homey Pro hardware is available, repeat the minimum inventory/event/write suite against its local API.

### Task 0.3: Decide SDK vs. direct protocol

- [x] Review the exact `homey-api` package version, license text, transitive dependencies, Node 24 support, release activity, and bundle/runtime implications.
- [x] Exercise connect/disconnect, timeouts, subscription cleanup, and reconnect behavior in a disposable spike.
- [x] Record one decision: `use SDK behind connector` or `use documented HTTP/Socket.IO directly`.
- [x] Record replacement considerations so the rest of the plugin does not depend on SDK-specific objects.
- [x] Do not add the dependency to production packages until this decision is reviewed.

The local MVP uses exact-pinned `homey-api` `3.19.2` behind `HomeySdkClient` and `HomeyLocalTransport`; no SDK object
crosses into normalized device services. The package license permits use with Homey products and remains packaged with
the dependency. Its Node 24 engine is now reflected in root, backend, and packaged-server manifests. The legacy Socket.IO
chain's unpatched moderate `parseuri` advisory is accepted only with the documented HTTP(S), credential, 2,048-character,
administrator-only endpoint boundary and bounded operations. A direct documented HTTP/Socket.IO adapter is the recorded
replacement and must pass the existing connector contract. Live restart and network-interruption session recovery
passed on SHS `13.4.1`; capability and availability event-flow continuity remains open above and in Task 6.2.

### Task 0.4: Build the sanitized fixture corpus

**Proposed files:**

```text
apps/backend/src/plugins/devices-homey/__fixtures__/
  README.md
  system-info.json
  zones.json
  devices/
    light.json
    switch.json
    climate.json
    cover.json
    sensor-air-quality.json
    sensor-safety.json
    energy-meter.json
    repeated-capabilities.json
    unavailable.json
  events/
    capability-updates.json
    availability.json
    reconnect.json
    lifecycle.json
```

- [x] Add a capture sanitizer that replaces IDs, names, zones, addresses, and sensitive driver metadata with deterministic synthetic values.
- [x] Preserve field shape, ordering where relevant, types, units, ranges, enum values, and capability suffix behavior.
- [x] Add expected normalized output fixtures for representative devices.
- [x] Add forbidden-token assertions or a fixture-safety test covering key prefixes, original host/address, and known private names.
- [x] Confirm the corpus can drive connector/domain tests after live SHS access ends.

**Gate:** Milestone 1 may scaffold interfaces in parallel, but no production connector or mDNS implementation is finalized until Tasks 0.2–0.4 are complete.

---

## Milestone 1: Secret-safe config and plugin foundation

### Task 1.1: Add generic write-only secret semantics to config

**Inspect first:**

- `apps/backend/src/modules/config/services/config.service.ts`
- `apps/backend/src/modules/config/controllers/config.controller.ts`
- Config type mapper/registry services and plugin config DTO/model conventions
- Existing token/password configuration implementations, if any

**Outcome:** Plugin config owners can mark fields as secret without Homey-specific controller hacks.

- [x] Define a registry/metadata contract for secret fields owned by module/plugin config DTOs.
- [x] Redact secret values from complete-config, plugin-config, validation-error, and serialization paths.
- [x] Expose a non-secret configured indicator suitable for admin forms.
- [x] Implement merge semantics: omitted secret preserves stored value; explicit clear removes it; provided value replaces it.
- [x] Ensure mutation events and plugin reload receive the resolved secret without exposing it to responses.
- [x] Ensure debug/error logs serialize redacted DTOs.
- [x] Add unit tests for get-all, get-one, update-preserve, update-replace, explicit-clear, validation failure, and logging helpers.
- [x] Document the registration convention for future secret-bearing plugins.

**Verification:**

```bash
pnpm run test:unit -- config
pnpm run lint:js
```

### Task 1.2: Scaffold the backend plugin

**Create under:** `apps/backend/src/plugins/devices-homey/`

Proposed initial structure:

```text
connectors/
controllers/
dto/
entities/
errors/
mappings/
models/
platforms/
services/
__fixtures__/
devices-homey.constants.ts
devices-homey.openapi.ts
devices-homey.plugin.ts
index.ts
```

- [x] Define plugin name/type, API tag, config keys, injection tokens, default timeouts/intervals, and health states.
- [x] Add Homey device entity discriminator by following the closest provider entity pattern.
- [x] Register the plugin through the repository's backend plugin mechanism.
- [x] Extend the managed plugin lifecycle base used by current providers.
- [x] Add local config DTO/model with URL, write-only API key mutation fields, timeout, reconciliation interval, and disabled/enabled state.
- [x] Register config validation/mutation and secret metadata.
- [x] Add a placeholder status response and controller using standard response envelopes.
- [x] Add plugin bootstrap/config tests, including disabled and incomplete configuration states.

**Verification:** Targeted Jest tests and `pnpm run lint:js`.

### Task 1.3: Define connector and normalized model contracts

**Proposed files:**

- `connectors/homey-connector.interface.ts`
- `connectors/homey-connector.types.ts`
- `models/homey-system-info.model.ts`
- `models/homey-zone.model.ts`
- `models/homey-device.model.ts`
- `models/homey-capability.model.ts`
- `models/homey-event.model.ts`
- `errors/homey-connector.error.ts`

- [x] Define connect/disconnect, inventory, device read, write, and subscribe semantics.
- [x] Define idempotent cleanup/unsubscribe semantics.
- [x] Define system, zone, device, capability, and event plain-data models.
- [x] Preserve full capability IDs; expose separately derived base IDs for matching.
- [x] Define normalized error categories and retryability.
- [x] Define connector contract tests reusable by local and cloud implementations.
- [x] Add model/ID derivation unit tests, especially repeated capabilities such as `measure_temperature.inside`.

---

## Milestone 2: Local connector, lifecycle, normalization, and health

### Task 2.1: Implement the local connector

**Proposed files:**

- `connectors/homey-local.connector.ts`
- `connectors/homey-local.transport.ts`
- `connectors/homey-local.error-mapper.ts`
- `connectors/homey-local.transformer.ts`
- Corresponding specs using captured fixtures/fakes

- [x] Add the reviewed dependency only if Milestone 0 selected the SDK.
- [x] Construct a local API client from validated address/token without logging either.
- [x] Apply explicit connect/read/write/subscription timeouts.
- [x] Transform SDK/protocol objects into normalized models.
- [x] Convert raw errors into normalized categories.
- [x] Implement transport-neutral connector orchestration and cleanup behind an injectable local transport.
- [x] Ensure one connector core owns one transport and passes the reusable fake-transport contract suite.
- [x] Implement the production adapter for inventory, zones, system info, device lookup, capability writes, and subscriptions.
- [x] Add adapter-specific fixture-backed tests for every operation and error category.
- [ ] Add environment-gated contract tests against live SHS.

### Task 2.2: Implement plugin lifecycle and connection state machine

**Proposed service:** `services/homey.service.ts`

- [x] Start only when enabled and minimally configured.
- [x] Connect, load system/zone metadata, establish event subscriptions, perform the authoritative inventory reconciliation behind a startup event barrier, merge buffered events, then publish healthy state.
- [x] Use Homey ordering metadata verified in Phase 0 to merge snapshot/events. If none is reliable, perform a final targeted reconciliation for capabilities touched while the startup snapshot was in flight before releasing the barrier.
- [x] Stop subscriptions/timers/connector on disable, config change, module shutdown, or failed startup cleanup.
- [x] Reconfigure safely when URL/key/timeouts change; never overlap old/new connectors.
- [x] Use exponential reconnect backoff with jitter and a maximum delay.
- [x] Treat authentication/authorization failures differently from transient network failures.
- [x] Prevent concurrent reconnect and reconciliation loops.
- [x] Track last successful connection, inventory sync, event, error category, reconnect count, and degraded state.
- [x] Unit-test all state transitions with fake timers.

### Task 2.3: Implement status and connection test APIs

- [x] Expand the status model with state, Homey identity/version, last sync/event timestamps, reconnect count, and sanitized error.
- [x] Add `POST test-connection` with a discriminated request: `saved` accepts no endpoint/mode override and may resolve the persisted key; `candidate` requires a complete unsaved URL plus a newly entered key and must never resolve the persisted key.
- [x] Reject mixed requests, including an overridden URL with an omitted key, even when the candidate URL canonicalizes to the saved URL. Stored-secret reuse is authorized only by explicit `saved` mode.
- [x] Use a temporary connector for connection tests and always disconnect it.
- [x] Return categorized validation/auth/timeout/unavailable errors without raw response bodies.
- [x] Add controller/service tests for fully saved reuse, complete candidate URL/key, URL override without key, key-only candidate, mixed saved/override fields, canonical-equivalent candidate URL, and proof that candidate mode never reads or sends the stored secret.

### Task 2.4: Implement server discovery only from evidence

**Decision (2026-08-15):** The live probe found only an unattributable generic `_http._tcp` record on port `80` with
no TXT keys. Automatic server discovery is deferred for the local MVP; manual URL configuration and connection testing
remain supported. Revisit only after a Homey-specific identity and restart-stable advertisement are verified.

- [x] Evaluate the Milestone 0 evidence and do not register a discoverer without a stable Homey-specific service.
- [x] Defer stable-identity deduplication and retain manual URL configuration as the supported setup path.
- [x] Do not expose start/restart/results endpoints while automatic server discovery is deferred.
- [x] Defer expiry, duplicate-record, restart, and malformed-TXT tests until an evidence-backed service contract exists.
- [x] Document manual-only setup and the evidence required to reconsider automatic discovery; do not ship guessed records.

---

## Milestone 3: Mapping, preview, discovery, and adoption

### Task 3.1: Implement mapping loader and override storage

**Inspect first:** Home Assistant mapping/adoption services and Shelly mapping loader/storage patterns.

**Proposed files:**

- `mappings/definitions/devices.yaml`
- `mappings/definitions/channels.yaml`
- `mappings/definitions/properties.yaml`
- `mappings/mapping-loader.service.ts`
- `mappings/property-mapping-storage.service.ts`
- Mapping schemas/types/specs

- [x] Define strict schemas for device, channel, and property descriptors.
- [x] Match on Homey class plus capability base ID; permit driver/vendor restrictions only where necessary.
- [x] Define priority, exclusivity/conflict, read/write direction, unit/range, and transformations.
- [x] Load built-ins and deterministic user overrides from `var/data/plugin.devices-homey.*.yaml` or the closest established naming scheme.
- [x] Validate mappings at startup and fail the plugin clearly on invalid built-ins while isolating invalid user overrides with actionable errors.
- [x] Add tests for precedence, duplicates, invalid schemas, ambiguous matches, and suffix/base-ID handling.

### Task 3.2: Add MVP mapping definitions

- [x] Power: `onoff`.
- [x] Lighting: `dim`, hue, saturation, and temperature.
- [x] Climate: measured temperature and complete thermostat identity.
- [ ] Climate control: project target temperature and mode only with a verified actual-activity signal; Homey's standard
      `thermostat_mode` is configuration, not heater/cooler activity.
- [x] Environment: humidity, pressure, luminance, and CO2.
- [x] Safety/contact: motion, contact, smoke, carbon monoxide.
- [x] Energy: instantaneous power and accumulated energy.
- [x] Battery: level and low-battery alarm.
- [x] Lock: state/control when writable.
- [x] Covers: state, position, tilt, open/close/stop behavior after fixture validation.
- [x] Add representative fixture tests for each mapping family and inverse transformation.

Live SHS 13.4.0 fixtures cover the capability families present in the captured inventory. Known inventory gaps use
explicitly named published-contract test devices derived from Athom's public capability definitions; they do not claim
live provenance. Relative light-temperature and cover-tilt projections are reversible defaults whose conversion
metadata remains visible to mapping preview and user overrides.

### Task 3.3: Implement device inventory/discovery service and API

**Proposed files:**

- `services/homey-device-inventory.service.ts`
- `controllers/homey-devices.controller.ts`
- Inventory models/response models/specs

- [x] Return normalized devices with resolved zone path, capabilities summary, availability, support state, and adoption state.
- [x] Determine adoption by plugin discriminator plus Homey device identifier.
- [x] Keep unsupported devices visible with reasons.
- [x] Support stable sorting/filtering without exposing raw SDK data.
- [x] Add list and single-device endpoints with authorization, standard response envelopes, and tests.

The API reads an immutable snapshot only while the managed connector has completed an authoritative inventory sync in
connected or degraded-polling state. Capability summaries deliberately exclude current values, SDK payloads, energy
objects, availability messages, and update timestamps. Focused tests cover lifecycle gating, stable ordering and
filtering, type-scoped adoption lookup, unsupported/conflicted reason codes, response serialization, authorization, and
fixed 404/422 errors; the complete Homey backend suite and OpenAPI generation pass.

### Task 3.4: Implement mapping preview

**Proposed service:** `services/mapping-preview.service.ts`

- [x] Fetch a fresh normalized device snapshot.
- [x] Infer suggested category and valid alternatives.
- [x] Produce proposed channels/properties with identifiers, transformed values, access, and conversion metadata.
- [x] Warn for unsupported capabilities, unavailable values, conflicting descriptors, and lossy/ambiguous conversions.
- [x] Keep output deterministic for identical snapshot/mapping versions.
- [x] Add request/response models and `POST mapping-preview` endpoint.
- [x] Add comprehensive fixture-backed tests.

The preview endpoint performs one fresh connector read, retains authoritative full capability identifiers, evaluates
valid Smart Panel categories against the proposed structure, and returns transformed current values, effective access,
conversion metadata, unsupported capability IDs, and stable sanitized warnings without mutating either system. Captured
fixtures cover every normalized MVP device family plus unavailable and repeated-capability cases; focused tests also
exercise conflicts, orphaned mappings, access mismatches, failed conversions, lossy and ambiguous conversions, fixed
404/422 behavior, authorization, and deterministic output. The generated OpenAPI contract exposes
`POST /plugins/devices-homey/mapping-preview` with the standard response envelope.

### Task 3.5: Implement idempotent adoption

**Proposed service:** `services/device-adoption.service.ts`

- [x] Re-fetch the device and recompute/validate mapping immediately before mutation.
- [x] Create/update the plugin-specific device by full Homey device ID.
- [x] Create/reconcile channels by stable mapping key.
- [x] Create/reconcile properties by full Homey capability ID.
- [x] Apply current transformed values through normal Devices service paths.
- [x] Isolate each batch selection in its own transaction where repository transaction patterns permit.
- [x] Return created/updated/skipped/failed per device with sanitized errors.
- [x] Make retry idempotent and prevent duplicates under concurrent requests.
- [x] Never mutate or delete anything in Homey.
- [x] Add single and batch adoption endpoints and tests for partial success, stale preview, duplicate request, unknown device, unsupported mapping, and rollback.

Adoption serializes each Homey ID with a renewable database-backed claim before local persistence work, then reconciles
local state under the repository's re-entrant structure lock. The claim covers the snapshot, reversible reconciliation,
and terminal value writes across backend processes. Long SQLite transactions are not used because the shared connection
can capture unrelated writes; instead the service snapshots the existing hierarchy and values and compensates completed
operations in reverse order. Single and ordered batch endpoints return only fixed per-device outcomes, and focused tests
cover partial success, stale/unknown/unsupported selections, concurrent retries, authoritative identifiers, value
application, rollback, and rollback failure without exposing caught error details.

### Task 3.6: Verify persistence assumptions

- [x] Prove device uniqueness is scoped by provider/entity type plus identifier.
- [x] Prove channel and property lookup/reconciliation use the appropriate parent/type scope.
- [x] Document the migration decision (the no-migration assumption failed for intentional capability fan-out).
- [x] If proof fails, design the minimum new entity metadata and add an incremental TypeORM migration with upgrade/rollback tests.

The property proof found intentional capability fan-out: one full Homey capability may create multiple mapped
properties in one channel. `homeyCapabilityId` plus `homeyMappingName` now preserve and disambiguate that identity;
the deterministic base identifier remains parent-scoped. The incremental migration and its upgrade/rollback evidence
are documented in `docs/homey-adoption-persistence.md`.

---

## Milestone 4: Real-time synchronization, reconciliation, and control

### Task 4.1: Implement event synchronization

**Proposed service:** `services/homey-synchronizer.service.ts`

- [x] Maintain an index from adopted Homey device/full capability IDs to Smart Panel properties.
- [x] Subscribe through the active connector before the authoritative initial inventory reconciliation; buffer/serialize events through the startup barrier so a snapshot cannot overwrite a newer event.
- [x] Validate/filter events and ignore unadopted or unmapped capabilities.
- [x] Transform values and update properties through the standard Devices service path.
- [x] Update whole-device/capability availability when corresponding events arrive.
- [x] Coalesce bursts per property while preserving the final order/value.
- [x] Avoid feedback loops when a command confirmation event returns.
- [x] Add tests for unknown devices, unknown capabilities, duplicate/out-of-order events, bursts, invalid values, unsubscribe, and a capability change during the startup snapshot/subscription boundary.

`HomeySynchronizerService` rebuilds its mapping index from provider-scoped adopted entities and invalidates it on generic
device/channel/property structure events. Startup subscribes first, applies the inventory snapshot, and then performs
fresh targeted reads for every upstream device touched while the barrier was active. Live capability batches retain the
newest timestamped value per full capability ID, apply every intentional mapping fan-out through the normal property
service, and never call the connector, so confirmation events cannot feed back into command transport. Device
availability maps to generic connection state; unavailable capabilities remain in the normalized inventory but do not
publish stale values. Removed or missing upstream devices become `lost` and no upstream or local deletion path is used.

### Task 4.2: Implement reconciliation fallback

- [x] Reconcile all adopted devices immediately after every successful reconnect.
- [x] Reconcile inventory periodically at a conservative bounded interval.
- [x] Update current values, availability, renamed metadata where policy permits, and missing-upstream status.
- [x] Never delete orphaned Smart Panel devices automatically.
- [x] Prevent overlapping reconciliation runs and cap per-device errors.
- [x] Transition to `degraded_polling` when events are unavailable but reads succeed.
- [x] Expose reconciliation duration/count/failure metrics in status/logging.
- [x] Add fake-timer tests for scheduling, overlap prevention, reconnect, and shutdown.

Startup and every successful reconnect run a serialized authoritative snapshot before healthy state is published. A
bounded configurable timer repeats that snapshot without overlap, and degraded event subscriptions retain the same
read path in `degraded_polling`. Snapshot synchronization refreshes values and availability, marks missing upstream
devices `lost`, isolates property failures into aggregate results, and has no local or upstream deletion path. Smart
Panel names remain operator-owned, so upstream renames refresh inventory and discovery metadata without overwriting an
adopted name. Status and sanitized structured logs expose attempt count, failed-attempt count, and latest duration;
fake-timer coverage proves periodic scheduling, overlap prevention, reconnect reconciliation, and shutdown cleanup.

### Task 4.3: Implement Homey device control platform

**Proposed files:**

- `platforms/homey-device.platform.ts`
- Command transformation/confirmation helpers and specs

- [x] Register a device platform for Homey-backed devices.
- [x] Resolve the property mapping and full capability ID.
- [x] Validate writable access, value type, enum/range, and device availability.
- [x] Apply the inverse transformation.
- [x] Serialize writes per device/capability.
- [x] Send the command through the connector with a bounded timeout.
- [x] Await a matching event as authoritative confirmation.
- [x] Perform at most one targeted read when confirmation times out.
- [x] Return a rejected/timeout result without treating an unconfirmed optimistic value as final.
- [x] Test on/off, dim normalization, temperature/range conversion, enums, covers, lock, concurrent commands, disconnect mid-command, rejection, event confirmation, and read fallback.

`HomeyDevicePlatform` defensively revalidates the adopted entity hierarchy, current upstream device/capability
availability, writable mapping direction, panel constraints, and transformed Homey type/range/step/enum constraints
before any batch write is sent. It preserves full suffixed capability IDs and applies the persisted mapping's inverse
transform. `HomeyService` serializes each device/capability stream, bounds connector writes, and only returns success
after the matching event has passed through synchronization or one bounded authoritative device read confirms and
synchronizes the value. Stop/reconnect cancels pending writes and confirmation timers; rejection, timeout, and
mismatching readback return failure without writing an optimistic value into local state. Focused tests cover boolean,
scaled dim and color-temperature values, enums, cover and lock transforms, concurrent ordering, event confirmation,
single-read fallback, transport rejection, write timeout, and disconnect cancellation.

### Task 4.4: Add observability and operational diagnostics

- [x] Add structured sanitized logs for state transitions, inventory/reconciliation summaries, and command failures.
- [x] Keep routine value payloads at trace/debug and rate-limit repetitive failures.
- [x] Expose adopted, missing, unsupported, and unavailable counts.
- [x] Add last-event age so a silent broken subscription is visible.
- [x] Stop aggressive retries on authentication failure until configuration changes or slow retry policy permits.

`HomeyService` now emits structured, secret-free connection transitions and reconciliation summaries without Homey
device/capability identities or routine values. Repetitive synchronization, reconciliation, reconnect, and command
failures share a one-minute suppression window and report how many equivalent failures were suppressed when logging
resumes. The status response exposes counts from the latest authoritative inventory reconciliation: enabled adopted
devices, adopted devices missing upstream, unsupported upstream devices, and unavailable upstream devices. It also
computes `last_event_age_ms` at read time so a stalled subscription is visible without waiting for another event.
Authentication and authorization failures remain in `authentication_failed` with no reconnect or reconciliation timer;
a saved configuration change follows the managed-plugin restart path and resets the retry suppression state.

---

## Milestone 5: Admin and panel integration

### Task 5.1: Scaffold the admin plugin

**Create under:** `apps/admin/src/plugins/devices-homey/`

Proposed structure:

```text
components/
composables/
locales/
schemas/
store/
devices-homey.constants.ts
devices-homey.plugin.ts
index.ts
```

- [x] Register the plugin, config component, add/edit components only where needed, and wizard adapter.
- [x] Add stores/schemas/transformers for config, status, inventory, preview, and adoption results.
- [x] Follow generated OpenAPI types after backend generation; do not create shadow API types without need.
- [x] Add all required locale files and update locale consistency tests.

The admin app now installs Homey as a core devices/config plugin. Its initial local configuration form participates in
the shared secret-preservation contract, while dedicated Pinia stores own operational status/connection testing and
inventory/preview/adoption workflows. Runtime Zod validation transforms the generated snake-case API models into the
admin's camel-case state without defining parallel wire types. The generic devices wizard is registered with stable
Homey device IDs and an initial inventory/adoption adapter; the richer preview, lifecycle, and partial-result behavior
remains scoped to Task 5.3. All six supported admin locales carry the same non-empty key set.

### Task 5.2: Implement secret-safe configuration UI

- [x] Add mode selection with local mode active and cloud mode marked unavailable until Phase 7.
- [x] Add URL, API-key replacement input, explicit clear action, bounded timeout/interval inputs, and enabled state.
- [x] Show only whether an API key is configured; never populate the key field from GET data.
- [x] Preserve the stored key when the field is untouched.
- [x] Add separate test actions/payloads for the fully saved configuration and a complete candidate URL/newly entered key pair; disable candidate testing until both fields are present.
- [x] Display connector state, Homey identity/version, last sync/event, and sanitized error guidance.
- [x] Unit-test initial state, preserve/replace/clear payloads, saved-vs-candidate test payloads, candidate URL without a new key, validation, working state, successful test, and categorized failures.

The Homey configuration form presents local mode as active and cloud mode as unavailable until Phase 7. Its saved test
sends no connector overrides, while candidate testing remains disabled until a safe URL and newly entered nonblank key
are both present; the candidate payload never falls back to the stored secret. The operational panel shows connector
state, Homey name/ID/version, latest inventory sync and event timestamps, adopted-device count, and sanitized
category-specific recovery guidance. Focused component/store/schema tests cover idle and working states, secret
preservation/replacement/removal, exact test payloads, validation, successful identity, categorized failures, and fixed
request errors. Results are invalidated when candidate inputs change, including while a request is in flight, and when
the form is reopened; the complete 2,252-test admin suite and production build pass.

### Task 5.3: Implement the generic wizard adapter

**Reference:** `apps/admin/src/modules/devices/components/wizard/device-wizard.types.ts` and current Shelly/Z2M factories.

- [x] Start/load Homey inventory and expose normalized wizard rows.
- [x] Map name, model/class, zone, capability count, availability, and support/adoption status into built-in/extra cells.
- [x] Provide stable device ID keys, suggested name/category, and category options.
- [x] Expose fetched read-only mapping summaries on confirmation rows.
- [x] Submit batch adoption and translate per-device results.
- [x] Clean up polling/subscriptions on wizard disposal.
- [x] Handle offline, empty, loading, reconnect, unsupported, already adopted, and partial-success states.
- [x] Add adapter/store/component tests using generated API mocks.

The shared wizard adapter loads inventory before rendering selection rows, preserves full Homey identifiers, derives
category choices, and submits bounded batch adoption with per-device outcomes. Its confirmation rows expose the fetched
preview as a read-only channel/property count, using warning styling and a warning-count tooltip when mapping review is
needed. Inventory, preview, refresh, and adoption requests remain isolated from stale or disposed sessions; partial
transport and provider results remain visible instead of discarding successful work. The complete 2,253-test admin
suite, type-check, lint, and production build pass.

### Task 5.4: Generate OpenAPI clients and verify the admin app

- [x] Run `pnpm run generate:openapi` after Swagger models/controllers stabilize.
- [x] Update manually maintained `apps/admin/src/openapi.constants.ts` exports only if needed.
- [x] Fix admin compile/test issues against generated types without editing `apps/admin/src/openapi.ts`.
- [x] Run admin unit tests, build, and JS lint/type checks.

The backend-generated OpenAPI contract includes Homey config, status, inventory, preview, adoption, and provider entity
models. The admin constants expose only the required generated types and enums. The complete 2,224-test admin suite,
type-check, lint, and CI web build pass without manual edits to generated sources.

**Verification:**

```bash
pnpm run generate:openapi
pnpm --filter ./apps/admin run test:unit
pnpm run admin:build
pnpm run lint:js
```

### Task 5.5: Integrate and verify the panel

- [x] Determine whether the new backend entity discriminator needs plugin-specific Dart model mappers.
- [x] If required, add minimal mappers/registration under `apps/panel/lib/plugins/devices-homey/` following current provider patterns.
- [x] Do not add a Homey HTTP/Socket.IO client or credentials to Flutter.
- [x] Regenerate API/spec clients with `melos rebuild-all` after backend generation.
- [x] Add/extend tests for representative Homey-backed lighting, sensor, thermostat, cover, lock, and energy device rendering/control.
- [x] Run `melos analyze` and relevant Flutter tests.

No Homey-specific Dart model mapper is required. The panel's generic provider models preserve the `devices-homey`
discriminator and unconsumed provider metadata while the existing category mappers construct the standard lighting,
sensor, thermostat, window-covering, lock, and energy views. A focused pipeline suite proves normal API model loading,
detail-widget selection, authoritative property replacement, and credential-free WebSocket command dispatch. Flutter
contains no Homey endpoint, API key, or transport client. Regenerated clients/specs and analysis pass; the full panel
suite completes with 1,032 passing tests and five existing locator-dependent skips.

---

## Milestone 6: Hardening and local release gate

### Task 6.1: Complete automated verification

- [x] Backend normalization, connector, mapping, preview, adoption, sync, reconciliation, control, config-secret, controller, and lifecycle suites pass.
- [x] Admin config, status, inventory, wizard adapter, results, and locale suites pass.
- [x] Panel representative widget/control tests pass.
- [x] OpenAPI/spec generation is clean and generated diffs are intentional.
- [x] Default CI requires no live Homey/SHS access.

The 2026-08-25 automated local gate passed 37 Homey/security backend suites with 469 tests, ten credential-free
compatibility, performance, and security suites with 129 tests, the complete 300-file/2,253-test admin suite, and all 23 representative Homey panel
pipeline tests. OpenAPI plus device/channel spec regeneration produced no diff. PR #828 also passed the default backend
unit/E2E, admin, panel, testing-app, web-build, schema, and analysis jobs; its Homey spike job received no live SHS
credentials, while every live or mutating probe remains protected by its explicit environment gate and allowlist.

The fixture matrix now covers the lock family through a manifest-declared synthetic published-protocol fixture. The raw
fixture carries an explicit synthetic provenance marker, passes the repository privacy checks, is normalized by the same
transformer as captured devices, and feeds the same MVP mapping assertions. The live corpus continues to record `lock`
as a capture gap, so synthetic contract coverage cannot be mistaken for evidence from a physical device. Captured
unavailable inventory plus fixture-backed preview, synchronization, connector, and reconciliation suites cover the
representative lifecycle failure paths.

### Task 6.2: Run the live lifecycle matrix

- [ ] Fresh startup with SHS online.
- [ ] Startup with SHS offline, then recovery.
- [ ] SHS restart during event flow.
- [x] Network interruption/restoration.
- [ ] API key revoked, replaced, and insufficiently scoped.
- [ ] Separately gated add/rename/zone-move/unavailable/removal lifecycle tests on the allowlisted disposable device only, followed by cleanup.
- [ ] Physical/Homey/flow-originated state changes.
- [ ] Allowlisted Smart Panel control for every writable MVP mapping family available.
- [ ] Burst updates and concurrent commands.
- [ ] Plugin disable/enable and backend shutdown with no leaked connections/timers.

The 2026-08-26 SHS `13.4.1` restart probe closed the transport/session recovery slice: it observed disconnect,
reconnect, manager resubscription, a fresh inventory read, and complete cleanup. This does not close the event-flow
criterion above because no capability or availability event was observed before and after that restart.

The 2026-08-26 SHS `13.4.1` network probe closed the network interruption/restoration session-recovery slice. A precise
firewall rule blocked only the test host's path to SHS ports `4859` and `4860` for 60 seconds; the sanitized 36-event
report proved disconnect, bounded reconnect attempts, reconnect, manager resubscription, a fresh inventory read, and
complete cleanup. It does not close the event-flow criterion because no capability or availability event was observed
across the interruption.

### Task 6.3: Validate performance and security

- [x] Measure inventory/normalization with up to 250 fixture-generated devices and on supported panel/backend hardware where available.
- [x] Measure capability event handoff and command-start latency against design targets.
- [x] Confirm no full inventory call occurs per event.
- [x] Scan config responses, logs, fixtures, snapshots, build artifacts, and generated OpenAPI examples for secrets/private data.
- [x] Verify all external calls have timeouts and reconnect loops have upper bounds.
- [x] Verify no route or service can delete/pair/rename an upstream Homey device.

The 2026-08-25 credential-free inventory gate generated 250 unique devices by cycling the nine immutable live raw
fixtures, then ran the production local transformer plus all built-in device/channel/property mapping resolution. After
three warm-up passes, 30 measured Node 24 runs on the available development backend host completed at p50 `14.35 ms`,
p95 `19.13 ms`, and maximum `23.01 ms`, with all 250 devices normalized and no mapping conflicts. The repeatable gate is
`pnpm --filter ./apps/backend run homey:performance-gate`; its deliberately generous `1,000 ms` p95 CI budget detects
major regressions and is not a Homey network-latency guarantee. No supported panel/backend appliance was available in
this workspace, so the same command should be rerun there when hardware is available without reopening the
credential-free corpus requirement.

The 2026-08-25 credential-free latency gate ran the production `HomeyService` event queue and serialized command path
against instrumented connector and Devices synchronizer boundaries. After three warm-up passes, 30 measured samples
completed at p95 `29.66 ms` from connector event receipt to the Devices synchronization handoff while each preceding
synchronization remained busy for `25 ms`, and p95 `28.55 ms` from validated command invocation to connector transport
start while queued behind an in-flight command on the same capability. Both remain below the `250 ms` design targets.
The gate also asserts that capability updates leave the startup inventory call count unchanged and issue no targeted
device reads. Run it from the repository root with
`pnpm --filter ./apps/backend run homey:latency-gate`; the measurements cover backend scheduling and synchronization-queue
overhead and deliberately exclude Homey network response time and subsequent command confirmation.

The 2026-08-25 credential-free security gate regenerated OpenAPI without a diff, compiled the backend, structurally
verified that every Homey secret property remains write-only and publishes no example/default value, and scanned the
Homey routes, fixture/evidence corpus, snapshots, and compiled artifacts for private addresses, email addresses, token
shapes, serialized secrets, and any configured live-test private values. It then passed all ten compatibility,
performance, and security suites (129 tests) plus 37 Homey/config security suites (469 tests), including the response,
logging, redaction, and error-sanitization coverage. Run the complete gate from `apps/backend` with
`pnpm run homey:security-gate`; the scan reports only the artifact and violation category, never the matched value.

The 2026-08-26 production-boundary audit confirmed that the exact-pinned SDK is imported only by the reviewed client
adapter and that every promise-returning SDK operation is invoked through the adapter's outer connection-timeout
watchdog. SDK reads and the sole allowed upstream mutation, a capability-value write, also receive the SDK-native
`$timeout`. Configuration bounds the connection timeout to 1–60 seconds; reconnect calculation and scheduling cap every
attempt at 30 seconds, including non-finite and very large attempt counters. `homey-production-boundary.spec.ts` locks
the production connector, local transport, client, device, and manager type surfaces so adding a pairing, device
creation/update/rename, or deletion operation requires an explicit security-gate change. It also enforces that no other
production plugin file imports `homey-api`. Controllers and services depend only on the locked `HomeyConnector` surface,
whose only upstream state mutation is `setCapabilityValue`; upstream lifecycle operations remain confined to separately
gated compatibility probes under `test/`.

### Task 6.4: Documentation and release checklist

**Proposed documentation updates:**

- `apps/website/` integration guide in the website's current content structure
- Root/project feature listing where providers are enumerated
- `docs/homey-shs-compatibility.md`
- Plugin README or module documentation if current plugins use one

- [x] Document SHS installation/network/port assumptions and least-privilege API-key creation.
- [x] Document local configuration, discovery/manual URL, adoption, supported capability families, limitations, and troubleshooting.
- [x] Document backups/secret behavior without revealing storage internals unnecessarily.
- [x] Document fixture refresh procedure for future SHS/Homey versions.
- [ ] Update `FEATURE-PLUGIN-HOMEY` acceptance checkboxes and status to `review` only when evidence is recorded.

The operator guide is published at `apps/website/app/docs/extensions/homey/page.mdx`; the fixture refresh runbook is
maintained beside the reviewed fixture corpus. The feature remains `in-progress`: Task 6.2 live-matrix observations and
the unchecked acceptance evidence above are still required before the final checklist/status update.

**Local MVP gate:** All Phase 0 and Phase 1 acceptance criteria in `tasks/features/FEATURE-PLUGIN-HOMEY.md` are checked or carry an approved, explicit deferral. Cloud criteria remain unchecked.

---

## Milestone 7: Homey Cloud connector

This milestone starts only after the local MVP is stable. It should be a separate PR series because OAuth/client registration and external approval can move independently.

### Task 7.1: Register and document the Athom API client

- [ ] Register the OAuth client and production/development redirect URIs.
- [ ] Confirm current user limits, approval requirements, scopes, and branding/legal requirements with Athom.
- [ ] Record client configuration as deployment secrets, not repository values.

### Task 7.2: Implement cloud authorization

- [ ] Add authorization start/callback/disconnect/reconnect endpoints using repository OAuth/state/PKCE patterns where applicable.
- [ ] Store access/refresh tokens through the generic secret mechanism or established encrypted credential store.
- [ ] Handle expiry, refresh rotation, revocation, invalid state, callback errors, and account reauthorization.
- [ ] List/select a Homey when an account has more than one.
- [ ] Add security-focused controller/service tests.

### Task 7.3: Implement `HomeyCloudConnector`

- [ ] Implement the same connector contract and normalized error categories.
- [ ] Run the shared connector contract suite.
- [ ] Verify inventory, subscriptions, writes, reconnect, rate limits, and cloud-specific latency behavior.
- [ ] Keep mapping, preview, adoption, synchronizer, and control code unchanged.

### Task 7.4: Extend admin configuration and release docs

- [ ] Enable cloud mode and OAuth connect/disconnect/status UI.
- [ ] Add Homey selection when required.
- [ ] Explain local vs. cloud latency, reachability, and credential tradeoffs.
- [ ] Run the full common acceptance suite against cloud mode.

---

## Final verification commands

Use targeted suites during development, then run the repository-appropriate full checks before review:

```bash
pnpm run test:unit
pnpm --filter ./apps/admin run test:unit
pnpm run lint:js
pnpm run generate:openapi
pnpm run admin:build
melos rebuild-all
melos analyze
```

Run backend E2E and relevant Flutter widget tests if the implementation adds or changes their covered paths. Record any skipped command with the concrete environment reason in the feature task/PR.

## Definition of done

The local integration is done when a new administrator can configure a scoped SHS key without secret exposure, discover and batch-adopt supported logical Homey devices, see initial and live state, issue confirmed controls, survive network/SHS restarts, understand unsupported and degraded states, disable the plugin cleanly, and run the automated suite after the SHS subscription has expired.
