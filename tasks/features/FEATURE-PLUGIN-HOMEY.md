# Task: Homey Device Provider Integration
ID: FEATURE-PLUGIN-HOMEY
Type: feature
Scope: backend, admin, panel
Size: large
Parent: (none)
Status: in-progress
Created: 2026-08-12

## 1. Business goal

In order to use Smart Panel as a unified display and control interface

As a user whose devices are managed by Homey

I want to connect Homey, adopt its devices, receive live state updates, and control supported capabilities from Smart Panel

## 2. Context

- Approved design: `docs/superpowers/specs/2026-08-12-homey-integration-design.md`
- Detailed execution plan: `docs/superpowers/plans/2026-08-12-homey-integration.md`
- The first release targets Homey Self-Hosted Server (SHS) and compatible Homey Pro local APIs.
- Homey Cloud is a subsequent connector behind the same plugin contract.
- The current one-month SHS subscription must be used first for compatibility validation and sanitized fixture capture.
- Home Assistant provides the closest backend reference for discovery, mapping preview, adoption, synchronization, and command routing:
  - `apps/backend/src/plugins/devices-home-assistant/`
  - `apps/admin/src/plugins/devices-home-assistant/`
- The shared admin adoption wizard is the required UI foundation:
  - `apps/admin/src/modules/devices/components/wizard/`
- The panel consumes normal Smart Panel device APIs and state updates. It must not connect directly to Homey.

## 3. Scope

### In scope — Phase 0 compatibility and fixtures

- Install/configure the subscribed SHS instance on a stable LAN address.
- Verify API-key authentication, required permissions, HTTP/HTTPS ports, inventory, zones, capability metadata, events, commands, reconnects, and upstream lifecycle changes.
- Determine whether SHS publishes a stable mDNS service suitable for discovery.
- Review the `homey-api` package license and runtime behavior before adding it.
- Capture sanitized, versioned fixtures and event sequences for offline automated tests.

### In scope — Phase 1 local MVP

- One backend `devices-homey` plugin with a transport-independent connector contract.
- Local SHS/Homey Pro connector using URL and API key.
- Generic write-only config-secret handling so credentials cannot be returned by config endpoints.
- Plugin lifecycle, health states, timeouts, reconnect backoff, event subscriptions, and reconciliation fallback.
- Normalized Homey device, zone, capability, and event models.
- Server discovery when verified, with manual URL configuration always available.
- Authenticated discovery of logical devices already managed by Homey.
- YAML-based category/channel/property mappings with upgrade-safe user overrides.
- Mapping preview and batch adoption using stable Homey identifiers.
- Initial state synchronization, real-time updates, missing-device handling, and periodic reconciliation.
- Commands for supported writable capabilities with event-based confirmation and targeted-read fallback.
- Admin configuration, connection testing, health display, and generic wizard adapter.
- Minimal panel registration/mapping plus regenerated clients/specs where required.
- Backend, admin, and representative panel tests.
- Operator/developer documentation.

### In scope — Phase 2 cloud connector

- Athom OAuth/Web API client registration and authorization flow.
- Homey selection for multi-Homey accounts.
- Secure access/refresh-token persistence and revocation behavior.
- Cloud connector implementing the same normalized connector contract.
- Cloud-specific deployment and approval/limit documentation.

### Out of scope

- Product support for pairing, commissioning, interviewing, renaming, or removing physical devices in Homey. Phase 0 may exercise lifecycle mutations only on a separately gated, explicitly allowlisted disposable virtual/test device.
- Homey apps, drivers, flows, alarms, insights, firmware, backups, or user administration.
- Automatic deletion of Smart Panel devices when upstream Homey devices disappear.
- Direct Homey credentials or transport in the Flutter panel.
- Exhaustive support for all vendor-specific capabilities in the first release.
- Matter Bridge as the primary implementation.

## 4. Acceptance criteria

### Phase 0 — compatibility gate

- [ ] SHS version, image digest, network topology, ports, and test date are recorded.
- [ ] A least-privilege API key can read devices, zones, system information, and current capability values.
- [ ] A designated harmless writable capability can be controlled and its resulting event observed.
- [ ] Socket.IO connection, subscription, disconnect, restart, and reconnect behavior are recorded.
- [ ] Device add, rename, zone move, unavailable, and removal behavior is captured only with a separately gated, explicitly allowlisted disposable virtual/test device; suffixed-capability behavior may use read-only fixtures/devices.
- [ ] mDNS behavior is verified; discovery is either specified from evidence or explicitly deferred.
- [ ] The SDK license/distribution decision and SDK-vs-direct-protocol choice are recorded.
- [ ] Sanitized fixtures contain no API keys, household identifiers, private IP addresses, or personal names.
- [ ] Fixture-backed tests can run without live SHS access.

### Security and configuration

- [ ] Homey API keys and OAuth tokens are write-only through every config endpoint.
- [ ] Config responses expose only a configured/not-configured indicator for secrets.
- [ ] Omitting a secret during update preserves it; explicit clear removes it.
- [ ] Connection testing reuses the stored key only for an explicit fully saved configuration request; every candidate/overridden URL requires a newly supplied key and can never fall back to the stored secret.
- [ ] Secrets are absent from logs, exceptions, telemetry, OpenAPI examples, tests, and fixtures.
- [ ] URLs, schemes, timeouts, intervals, and permission errors are validated and sanitized.
- [ ] Disabling the plugin closes subscriptions, stops timers, and disconnects the connector cleanly.

### Backend local provider

- [ ] `devices-homey` is registered as a managed backend plugin.
- [ ] A `HomeyConnector` abstraction prevents SDK/transport objects from leaking into domain services.
- [ ] The local connector supports connection testing, inventory, zones, device reads, events, and capability writes.
- [ ] Health exposes connected, degraded polling, reconnecting, authentication failed, and stopped states.
- [ ] Manual URL setup works without mDNS.
- [ ] Authenticated device discovery lists all logical Homey devices with adoption/support status.
- [ ] Normalization preserves full device and capability IDs, including capability suffixes.
- [ ] Mapping definitions cover the agreed MVP light, switch, sensor, climate, cover, lock, battery, and energy capabilities.
- [ ] Unknown capabilities create preview warnings without failing otherwise supported devices.
- [ ] Mapping preview returns category, channels, properties, identifiers, values, access, conversions, and warnings.
- [ ] Single and batch adoption are idempotent and return per-device outcomes.
- [ ] Adoption reuses generic device/channel/property identifiers without a migration, or an incremental migration is added if evidence shows one is required.
- [ ] Initial reconciliation populates current values and availability for adopted devices.
- [ ] Subscriptions are established before the authoritative initial reconciliation, and a tested startup barrier prevents snapshot/event races from losing the newest value.
- [ ] Real-time Homey events update only adopted, mapped properties.
- [ ] Reconnect performs a full reconciliation and bounded periodic reconciliation repairs missed events.
- [ ] A missing upstream device is marked unavailable/orphaned but never automatically deleted.
- [ ] Writable property commands validate and transform values, use the full capability ID, and await authoritative confirmation.
- [ ] A missing confirmation triggers at most one targeted read before returning a timeout/error.

### Backend API and OpenAPI

- [ ] Status, test-connection, discovery, device inventory, mapping-preview, and adoption endpoints follow repository controller conventions.
- [ ] Every controller action has the required Swagger tags, operation metadata, response envelope, validation, authorization, and error responses.
- [ ] `pnpm run generate:openapi` succeeds after backend Swagger changes.
- [ ] No generated OpenAPI, admin API type, panel API client, or generated spec file is edited manually.

### Admin

- [ ] The Homey plugin configuration form supports local URL, write-only API key, test connection, and health display.
- [ ] The form never repopulates or displays a stored API key.
- [ ] The form distinguishes testing the fully saved configuration from testing a complete candidate URL/new-key pair and never submits an endpoint override without a new key.
- [ ] A `deviceWizardAdapter` integrates Homey with the shared three-step adoption wizard.
- [ ] Discovery rows show name, identifier, class/model, zone, availability, capability count, and adoption/support status.
- [ ] Confirm rows provide sensible names/categories and a read-only mapping summary.
- [ ] Batch results show created, updated, skipped, and failed outcomes with sanitized errors.
- [ ] Stores/composables handle offline, empty, mixed-support, partial-success, and reconnect states.
- [ ] All required locale files and locale schema tests are updated.

### Panel

- [ ] Adopted Homey devices load through the normal Devices API without Homey credentials.
- [ ] Real-time property changes use the existing Smart Panel WebSocket/state path.
- [ ] Representative lighting, sensor, thermostat, cover, lock, and energy devices render in existing detail widgets.
- [ ] Supported commands follow existing panel optimistic/confirmation behavior.
- [ ] `melos rebuild-all` and `melos analyze` succeed after generated API/spec changes.

### Tests and quality

- [ ] Unit tests cover normalization, mappings, transformations, preview, adoption, event processing, reconnects, command confirmation, and secret handling.
- [ ] Fixture integration tests cover every MVP capability family and representative lifecycle failures.
- [x] Live SHS tests are environment-gated; write tests require an explicit device/capability allowlist.
- [ ] Backend unit tests, admin unit tests, JS lint/type checks, OpenAPI generation, and relevant panel tests pass.
- [ ] The plugin remains fully testable after the one-month SHS subscription expires.
- [ ] No new dependency is merged without its license, maintenance, runtime, and replacement implications being documented.

### Phase 2 cloud

- [ ] Cloud authorization uses Athom OAuth and never asks users to paste account credentials.
- [ ] Refresh, expiry, revocation, reauthorization, and multi-Homey selection are handled.
- [ ] The cloud connector passes the same connector contract suite as the local connector.
- [ ] Mapping, adoption, state sync, and control services contain no cloud-specific forks outside connector/authorization boundaries.
- [ ] User limits, approval requirements, redirect URIs, and deployment steps are documented.

## 5. Example scenarios

### Scenario: Adopt a Homey lighting device

Given the administrator has configured a reachable SHS instance with a valid scoped API key,
and Homey manages a dimmable color light, when the administrator opens the Homey device wizard,
then the light appears with its Homey name, zone, class, capabilities, and suggested lighting category.
When the administrator adopts it, Smart Panel creates the mapped lighting channels and properties,
the initial power, brightness, color, and temperature values are visible,
and physical or Homey-originated changes appear in Smart Panel in real time.

### Scenario: Control and confirm a cover

Given an adopted Homey cover exposes writable position and state capabilities,
when the user changes its position from Smart Panel, Smart Panel sends the transformed value to the full Homey capability identifier
and treats the resulting Homey event as confirmation.
It shows a timeout/error instead of a false final value if confirmation and the targeted read both fail.

### Scenario: SHS restarts

Given adopted devices are receiving capability events, when SHS restarts,
then Smart Panel enters reconnecting state with bounded backoff
and does not create duplicate connections or polling loops.
When SHS returns, Smart Panel reconnects, restores subscriptions, performs full reconciliation, and resumes live updates.

### Scenario: API key is revoked

Given the integration is connected, when its API key is revoked,
then the plugin reports authentication failure with a sanitized message,
avoids aggressive retries, and no key appears in logs or API responses.
When the administrator saves a new key, the plugin reconnects without requiring a Smart Panel restart.

### Scenario: Homey device is removed upstream

Given a Homey device has been adopted into Smart Panel, when it is removed from Homey,
then its Smart Panel device is marked unavailable/orphaned,
it is not automatically deleted, and no deletion or unpairing request is sent to Homey.

## 6. Technical constraints

- Follow the approved design and detailed implementation plan linked above.
- Use `apps/backend/src/plugins/devices-home-assistant/` as the main backend reference and the shared device wizard as the admin reference.
- Keep connector, mapping, adoption, synchronization, and platform/control responsibilities in separate services.
- Prefer existing managed plugin, devices, mapping storage, mDNS, config, WebSocket, and platform abstractions.
- Do not introduce a database migration unless the generic identifiers are proven insufficient; if needed, create an incremental migration.
- Do not edit generated code manually.
- The backend Swagger decorators are the OpenAPI source of truth.
- Add external-call timeouts, categorized errors, cleanup, and reconnect limits from the start.
- Never perform destructive upstream Homey actions.
- Never commit credentials or unsanitized live payloads.

## 7. Implementation hints

- Complete Phase 0 while SHS access is available; fixture capture is on the critical path.
- Make normalized models plain data and write contract tests that both local and cloud connectors must pass.
- Match descriptors using Homey class plus capability base IDs, but persist and command full capability IDs.
- Revalidate a device immediately before adoption.
- Treat Homey events as authoritative command confirmation; use targeted reads only as a fallback.
- Authentication failures should wait for configuration changes or a slow retry policy rather than use normal reconnect cadence.
- Keep manual URL configuration even if mDNS discovery proves reliable.

## 8. Delivery estimate and sequencing

- Local MVP: approximately 25–36 engineering days.
- A four-week calendar target is plausible if backend and admin work overlap after the connector and API contracts stabilize.
- A single implementation stream should budget approximately 5–7 weeks.
- Homey Cloud: approximately 7–12 additional engineering days, excluding Athom approval/client-registration lead time.

Implementation order:

1. SHS compatibility spike and sanitized fixtures.
2. Generic secret-safe configuration support.
3. Backend plugin foundation and connector contract.
4. Local connector and lifecycle/reconnect service.
5. Normalization and mapping catalog.
6. Discovery, preview, and adoption APIs.
7. Real-time synchronization and control platform.
8. Admin configuration and wizard adapter.
9. Panel/OpenAPI/spec integration.
10. Hardening, live verification, documentation, and release gate.
11. Cloud OAuth and cloud connector.

## 9. AI instructions

- Read this task, the approved design, and the detailed plan entirely before changing code.
- Inspect the current Home Assistant and generic wizard implementations before choosing exact files/types.
- Begin with Phase 0; do not infer SHS behavior that can be measured during the subscription.
- Keep work scoped to the current plan task and update its checkbox when verified.
- Preserve unrelated worktree changes.
- For every acceptance criterion, implement it, leave it unchecked, or record a concrete reason for deferral.
- Run the verification commands specified by the detailed plan after each milestone.
- Never include a real API key or unsanitized Homey fixture in a tool call, patch, test snapshot, commit, or response.
