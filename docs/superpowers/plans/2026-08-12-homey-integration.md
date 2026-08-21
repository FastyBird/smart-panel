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
- [ ] Inspect mDNS advertisements before and after restart. Record exact service type/TXT fields only if stable.
- [ ] If Homey Pro hardware is available, repeat the minimum inventory/event/write suite against its local API.

### Task 0.3: Decide SDK vs. direct protocol

- [x] Review the exact `homey-api` package version, license text, transitive dependencies, Node 24 support, release activity, and bundle/runtime implications.
- [ ] Exercise connect/disconnect, timeouts, subscription cleanup, and reconnect behavior in a disposable spike.
- [ ] Record one decision: `use SDK behind connector` or `use documented HTTP/Socket.IO directly`.
- [ ] Record replacement considerations so the rest of the plugin does not depend on SDK-specific objects.
- [ ] Do not add the dependency to production packages until this decision is reviewed.

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

- [ ] Maintain an index from adopted Homey device/full capability IDs to Smart Panel properties.
- [ ] Subscribe through the active connector before the authoritative initial inventory reconciliation; buffer/serialize events through the startup barrier so a snapshot cannot overwrite a newer event.
- [ ] Validate/filter events and ignore unadopted or unmapped capabilities.
- [ ] Transform values and update properties through the standard Devices service path.
- [ ] Update whole-device/capability availability when corresponding events arrive.
- [ ] Coalesce bursts per property while preserving the final order/value.
- [ ] Avoid feedback loops when a command confirmation event returns.
- [ ] Add tests for unknown devices, unknown capabilities, duplicate/out-of-order events, bursts, invalid values, unsubscribe, and a capability change during the startup snapshot/subscription boundary.

### Task 4.2: Implement reconciliation fallback

- [ ] Reconcile all adopted devices immediately after every successful reconnect.
- [ ] Reconcile inventory periodically at a conservative bounded interval.
- [ ] Update current values, availability, renamed metadata where policy permits, and missing-upstream status.
- [ ] Never delete orphaned Smart Panel devices automatically.
- [ ] Prevent overlapping reconciliation runs and cap per-device errors.
- [ ] Transition to `degraded_polling` when events are unavailable but reads succeed.
- [ ] Expose reconciliation duration/count/failure metrics in status/logging.
- [ ] Add fake-timer tests for scheduling, overlap prevention, reconnect, and shutdown.

### Task 4.3: Implement Homey device control platform

**Proposed files:**

- `platforms/homey-device.platform.ts`
- Command transformation/confirmation helpers and specs

- [ ] Register a device platform for Homey-backed devices.
- [ ] Resolve the property mapping and full capability ID.
- [ ] Validate writable access, value type, enum/range, and device availability.
- [ ] Apply the inverse transformation.
- [ ] Serialize writes per device/capability.
- [ ] Send the command through the connector with a bounded timeout.
- [ ] Await a matching event as authoritative confirmation.
- [ ] Perform at most one targeted read when confirmation times out.
- [ ] Return a rejected/timeout result without treating an unconfirmed optimistic value as final.
- [ ] Test on/off, dim normalization, temperature/range conversion, enums, covers, lock, concurrent commands, disconnect mid-command, rejection, event confirmation, and read fallback.

### Task 4.4: Add observability and operational diagnostics

- [ ] Add structured sanitized logs for state transitions, inventory/reconciliation summaries, and command failures.
- [ ] Keep routine value payloads at trace/debug and rate-limit repetitive failures.
- [ ] Expose adopted, missing, unsupported, and unavailable counts.
- [ ] Add last-event age so a silent broken subscription is visible.
- [ ] Stop aggressive retries on authentication failure until configuration changes or slow retry policy permits.

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

- [ ] Register the plugin, config component, add/edit components only where needed, and wizard adapter.
- [ ] Add stores/schemas/transformers for config, status, inventory, preview, and adoption results.
- [ ] Follow generated OpenAPI types after backend generation; do not create shadow API types without need.
- [ ] Add all required locale files and update locale consistency tests.

### Task 5.2: Implement secret-safe configuration UI

- [ ] Add mode selection with local mode active and cloud mode marked unavailable until Phase 7.
- [ ] Add URL, API-key replacement input, explicit clear action, bounded timeout/interval inputs, and enabled state.
- [ ] Show only whether an API key is configured; never populate the key field from GET data.
- [ ] Preserve the stored key when the field is untouched.
- [ ] Add separate test actions/payloads for the fully saved configuration and a complete candidate URL/newly entered key pair; disable candidate testing until both fields are present.
- [ ] Display connector state, Homey identity/version, last sync/event, and sanitized error guidance.
- [ ] Unit-test initial state, preserve/replace/clear payloads, saved-vs-candidate test payloads, candidate URL without a new key, validation, working state, successful test, and categorized failures.

### Task 5.3: Implement the generic wizard adapter

**Reference:** `apps/admin/src/modules/devices/components/wizard/device-wizard.types.ts` and current Shelly/Z2M factories.

- [ ] Start/load Homey inventory and expose normalized wizard rows.
- [ ] Map name, model/class, zone, capability count, availability, and support/adoption status into built-in/extra cells.
- [ ] Provide stable device ID keys, suggested name/category, and category options.
- [ ] Fetch or derive read-only mapping summaries for confirmation.
- [ ] Submit batch adoption and translate per-device results.
- [ ] Clean up polling/subscriptions on wizard disposal.
- [ ] Handle offline, empty, loading, reconnect, unsupported, already adopted, and partial-success states.
- [ ] Add adapter/store/component tests using generated API mocks.

### Task 5.4: Generate OpenAPI clients and verify the admin app

- [ ] Run `pnpm run generate:openapi` after Swagger models/controllers stabilize.
- [ ] Update manually maintained `apps/admin/src/openapi.constants.ts` exports only if needed.
- [ ] Fix admin compile/test issues against generated types without editing `apps/admin/src/openapi.ts`.
- [ ] Run admin unit tests, build, and JS lint/type checks.

**Verification:**

```bash
pnpm run generate:openapi
pnpm --filter ./apps/admin run test:unit
pnpm run admin:build
pnpm run lint:js
```

### Task 5.5: Integrate and verify the panel

- [ ] Determine whether the new backend entity discriminator needs plugin-specific Dart model mappers.
- [ ] If required, add minimal mappers/registration under `apps/panel/lib/plugins/devices-homey/` following current provider patterns.
- [ ] Do not add a Homey HTTP/Socket.IO client or credentials to Flutter.
- [ ] Regenerate API/spec clients with `melos rebuild-all` after backend generation.
- [ ] Add/extend tests for representative Homey-backed lighting, sensor, thermostat, cover, lock, and energy device rendering/control.
- [ ] Run `melos analyze` and relevant Flutter tests.

---

## Milestone 6: Hardening and local release gate

### Task 6.1: Complete automated verification

- [ ] Backend normalization, connector, mapping, preview, adoption, sync, reconciliation, control, config-secret, controller, and lifecycle suites pass.
- [ ] Admin config, status, inventory, wizard adapter, results, and locale suites pass.
- [ ] Panel representative widget/control tests pass.
- [ ] OpenAPI/spec generation is clean and generated diffs are intentional.
- [ ] Default CI requires no live Homey/SHS access.

### Task 6.2: Run the live lifecycle matrix

- [ ] Fresh startup with SHS online.
- [ ] Startup with SHS offline, then recovery.
- [ ] SHS restart during event flow.
- [ ] Network interruption/restoration.
- [ ] API key revoked, replaced, and insufficiently scoped.
- [ ] Separately gated add/rename/zone-move/unavailable/removal lifecycle tests on the allowlisted disposable device only, followed by cleanup.
- [ ] Physical/Homey/flow-originated state changes.
- [ ] Allowlisted Smart Panel control for every writable MVP mapping family available.
- [ ] Burst updates and concurrent commands.
- [ ] Plugin disable/enable and backend shutdown with no leaked connections/timers.

### Task 6.3: Validate performance and security

- [ ] Measure inventory/normalization with up to 250 fixture-generated devices and on supported panel/backend hardware where available.
- [ ] Measure capability event handoff and command-start latency against design targets.
- [ ] Confirm no full inventory call occurs per event.
- [ ] Scan config responses, logs, fixtures, snapshots, build artifacts, and generated OpenAPI examples for secrets/private data.
- [ ] Verify all external calls have timeouts and reconnect loops have upper bounds.
- [ ] Verify no route or service can delete/pair/rename an upstream Homey device.

### Task 6.4: Documentation and release checklist

**Proposed documentation updates:**

- `apps/website/` integration guide in the website's current content structure
- Root/project feature listing where providers are enumerated
- `docs/homey-shs-compatibility.md`
- Plugin README or module documentation if current plugins use one

- [ ] Document SHS installation/network/port assumptions and least-privilege API-key creation.
- [ ] Document local configuration, discovery/manual URL, adoption, supported capability families, limitations, and troubleshooting.
- [ ] Document backups/secret behavior without revealing storage internals unnecessarily.
- [ ] Document fixture refresh procedure for future SHS/Homey versions.
- [ ] Update `FEATURE-PLUGIN-HOMEY` acceptance checkboxes and status to `review` only when evidence is recorded.

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
