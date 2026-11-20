# Cameras Plan 6b — UniFi Protect Admin Settings (UP-12, part 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** an administrator connects a UniFi Protect console from the admin: discovered or typed host, write-only API
key, TLS trust (verify or pinned fingerprint with "Trust this certificate"), stream defaults, Test connection, and a
connection status panel that stays current; the onboarding integrations step lists the plugin (#1188, part 1).

**Scope split (maintainer decision, 2026-11-20).** #1188 is delivered in two parts. This plan is part 1: stores,
settings form, status panel and onboarding, built on today's components. Part 2 — the adoption wizard adapter with
per-camera stream enablement and quality — is built after AR-12 (#1669) moves the device wizards onto the new
`wizard-shell`, so the per-row option lands in that shell once. The PR of this plan references #1188 without closing
it; part 2 closes it.

**Architecture:** a new admin plugin `apps/admin/src/plugins/devices-unifi-protect` modelled on
`plugins/devices-homey`: two Pinia stores (status, discovery) over the existing backend API, a config form registered as
`pluginConfigEditForm`, and a connection status panel that polls `GET status`.

**Tech Stack:** Vue 3, Pinia, Element Plus, zod, openapi-fetch (typed client), Vitest with `@vue/test-utils`.

**Spec:** [`docs/admin-ui-design-spec.md`](../../admin-ui-design-spec.md) §7 and §8 ("Protect settings", "Test
connection", "Connection status"); [`2026-10-06-unifi-protect-integration-design.md`](../specs/2026-10-06-unifi-protect-integration-design.md)
§7.3, §8, §9.1; issue #1188; `tasks/epics/EPIC-ADMIN-UI-REDESIGN.md` (UP-12 row). Backend:
`apps/backend/src/plugins/devices-unifi-protect/` (`controllers/*`, `models/*`, `dto/update-config.dto.ts`,
`dto/test-connection.dto.ts`, `dto/protect-discovery-probe.dto.ts`, `validators/protect-config.validators.ts`,
`services/protect-connection-test.service.ts`, `devices-unifi-protect.constants.ts`, `devices-unifi-protect.plugin.ts`).

## Decisions taken in this plan

| # | Decision | Why |
|---|---|---|
| Q1 | **Connection status is polled**: `GET /plugins/devices-unifi-protect/status` every 5 s while the status panel is mounted and the page is visible (reference-counted, request deadline 8 s), plus once after a successful save and after each test. | The backend emits no Protect status socket event. Status, discovery, probe and test connection all work while the plugin is disabled (no enabled guard). |
| Q2 | **Certificate trust lives in the plugin** (certificate card and "Trust this certificate"). The button is offered only for the current test result of the current host and port, and only when the failure is `tls_untrusted` in verify mode or `tls_fingerprint_mismatch` in pinned mode (never for a pass). A mismatch shows "The console's certificate changed" and asks for confirmation before replacing the pin. Trusting switches `tls.mode` to `pinned`, fills `fingerprint_sha256`, clears the result and re-runs the test. | `trusted` is chain trust, not a pin match (`protect-connection-test.service.ts`), so gating on it would overwrite a pin silently or hide re-pinning. |
| Q3 | **Verify mode with an IP host requires a server name** in the form; the form offers the probe's `direct_connect_domain` and the test's `suggested_server_name` as one-click fills, or Pin mode. | `findProtectConfigError` and `judgeCertificate` refuse verify with an IP host and no `server_name`; saving such a config would leave the connector unable to start. |
| Q4 | **Onboarding lists the plugin automatically** (extensions filter `devices-*`); this plan adds its icon `mdi:cctv`, `pluginsRequiringConfig`, and a configured check (`host` non-empty and `apiKeyConfigured`). Pre-ticking when a console is discovered is a follow-up issue. | #1188 asks only that the step lists the plugin; pre-ticking is new onboarding behaviour. |
| Q5 | **Current components, spec content** (as Plan 6a P4): `el-form`, `el-collapse` for Advanced, `config-secret-input` for the key, Element Plus alerts; no own Save button, header or card. Restyling onto AR-4 `secret-input` and AR-6 `plugin-form-section` / `test-connection` happens in AR-26. | The redesign epic lists UP-12 after AR-4 and AR-6; the maintainer chose to build the settings now and the wizard after AR-12. |
| Q6 | **Space per device** (spec §8 wizard) needs a backend change (no space field on `ProtectAdoptDeviceDto`) and goes into a follow-up issue together with part 2. | Out of this part's scope. |

## Global Constraints

- PR title `feat(admin): add UniFi Protect plugin configuration`, body `Refs #1188` (part 2 closes it); commits `<type>(admin): <lowercase subject>` (docs-only `docs(docs): …`), trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never edit generated files (`src/openapi.ts`, `spec/api/v1/openapi.json`). `src/openapi.constants.ts` is hand-maintained: append a `// Devices UniFi Protect Plugin` alias block (config, status, test connection, certificate, discovery, probe schemas and operations) and the enum re-exports used.
- Names from the backend: plugin `devices-unifi-protect-plugin`, device type and URL prefix `devices-unifi-protect`; secret field `apiKey` (backend `secretFields`: `api_key`, `api_key_configured`).
- No new dependencies. Six locales (`cs-CZ`, `de-DE`, `en-US`, `es-ES`, `pl-PL`, `sk-SK`) with a parity spec copied from `plugins/devices-homey/locales/locales.spec.ts`.
- Secret: the API key is write-only through `config-secret-input` (`undefined` keep, string replace, `null` remove; blank replacement invalid as in Homey). The key never reaches a log, a store other than the edit model, a test result or the DOM after submit; the candidate test sends a typed key only in its request body.
- Backend validation is mirrored and cited in a comment: host (`IsProtectHost`), port 1–65535, server name (`IsProtectServerName`), fingerprint (`normalizeProtectFingerprint`), verify+IP needs a server name (`findProtectConfigError`), `default_stream_quality` ∈ high/medium/low, `snapshot_min_interval_ms` and `poll_interval_ms` within `PROTECT_MIN_*`/`PROTECT_MAX_*`.
- Never hard-code the Protect minimum version.
- Deadlines (constants in `devices-unifi-protect.constants.ts`): status 8 s, probe 15 s, test connection 20 s, discovery scan 60 s (the backend's worst case is about 53 s). A client-side timeout is not a failure of the backend operation: after a scan timeout re-`GET` the cached discovery; after a test timeout show "No answer in time" with a retry.
- No hex colours or `gray-*` utilities in `.vue` files.
- Checks before each commit: `pnpm --filter ./apps/admin exec vitest --run <specs>`, `pnpm --filter ./apps/admin run type-check`, `pnpm --filter ./apps/admin exec eslint <files>`, `pnpm --filter ./apps/admin exec prettier --check <files>`; `pnpm --filter ./apps/admin run lint:deps` stays at the main baseline.

## Review Focus

1. **A typed key that is never sent.** Candidate mode with the typed key for unsaved host, port, TLS or key changes; saved mode only when nothing relevant changed and a key is stored; disabled with a hint otherwise (including a key marked for removal). Test in Task 3.
2. **Trusting the wrong certificate.** Trust only for the current result of the current host and port and only for the two TLS failure categories; a mismatch needs confirmation. Test in Task 3.
3. **Polling that never stops or freezes.** Releasing on unmount (also inside the onboarding config dialog), pausing while hidden, and a stalled request not blocking later polls. Test in Task 2 and Task 4.
4. **Verify mode with an IP host.** Must not save without a server name. Test in Task 1.
5. **A slow scan.** A scan that outlives the client deadline must still show its result. Test in Task 2.

---

### Task 1: Plugin skeleton, schemas and registration

**Files:**
- Create under `apps/admin/src/plugins/devices-unifi-protect/`: `index.ts`, `devices-unifi-protect.plugin.ts`, `devices-unifi-protect.constants.ts`, `devices-unifi-protect.exceptions.ts`, `schemas/config.schemas.ts` (+ spec), `store/config.store.schemas.ts`, `locales/{index.ts, locales.spec.ts, <6>.json}`, `components/components.ts`.
- Modify: `apps/admin/src/app.main.ts` (import and `app.use(DevicesUnifiProtectPlugin, pluginOptions)` in the plugin block, alphabetical), `apps/admin/src/openapi.constants.ts`, `apps/admin/src/plugins/config-secrets.spec.ts` (row `{ plugin: 'devices-unifi-protect', field: 'apiKey', editForm: ProtectConfigEditFormSchema, store: ProtectConfigSchema }`).

**Interfaces:**
- Constants: `DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX = 'devices-unifi-protect'`, `DEVICES_UNIFI_PROTECT_PLUGIN_NAME = 'devices-unifi-protect-plugin'`, `DEVICES_UNIFI_PROTECT_TYPE = 'devices-unifi-protect'`, the deadlines, `STATUS_POLL_MS = 5_000`.
- Exceptions: `ProtectException`, `ProtectApiException(message, code)`, `ProtectValidationException`.
- `ProtectConfigSchema` (store, camelCase): `host: string | null`, `port: number`, `apiKey?: string | null`, `apiKeyConfigured: boolean`, `tls: { mode: 'verify' | 'pinned'; serverName: string | null; fingerprintSha256: string | null }`, `streamHostOverride: string | null`, `defaultStreamQuality`, `snapshotMinIntervalMs`, `pollIntervalMs`, plus the `ConfigPlugin` fields.
- `ProtectConfigEditFormSchema = ConfigPluginEditFormSchema.extend({...})` with the mirrored rules and `superRefine`: verify — `serverName` valid when set and required when `host` is an IP address; pinned — `fingerprintSha256` required and valid; the blank-key rule. `ProtectConfigUpdateReqSchema` (snake_case, `type: z.literal(DEVICES_UNIFI_PROTECT_PLUGIN_NAME)`), sending `api_key` only when it is a string or `null`, `fingerprint_sha256: null` in verify mode.
- Plugin entry registers locales under `devicesUnifiProtectPlugin` and a `CONFIG_MODULE_PLUGIN_TYPE` element with `pluginConfigEditForm` (a minimal placeholder until Task 3) and the three schemas. A devices element with the device/channel/property schemas (Homey's set, using the Protect create/update schemas) is registered now so adopted devices edit correctly; no `deviceWizard` yet.

- [ ] **Step 1: Write the failing tests** — `config.schemas.spec.ts`: `accepts a verify config with a domain host and no server name`, `requires a server name for an IP host in verify mode`, `requires a valid fingerprint in pinned mode`, `rejects a port outside 1–65535`, `rejects poll and snapshot intervals outside the backend limits`, `rejects a blank key replacement and accepts null removal`, `builds an update request in snake_case without an untouched key and with a null fingerprint in verify mode`; the `config-secrets.spec.ts` row; the locale parity spec.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run, type-check, lint** → PASS; `build:no-check` builds.
- [ ] **Step 5: Commit** — `feat(admin): add the unifi protect plugin skeleton and config schemas`

### Task 2: Status and discovery stores

**Files:** `store/{keys.ts, stores.ts, protect.schemas.ts, protect.types.ts, protect.transformers.ts (+ spec), protect-status.store.ts (+ spec), protect-discovery.store.ts (+ spec)}`; plugin entry registers the stores and a `dataRefreshRegistry` entry for status.

**Interfaces:**
- `useProtectStatus()` (`devices_unifi_protect_plugin-status`): `status: IProtectStatus | null`, `stale: boolean`, `lastTest: IProtectTestResult | null` where `IProtectTestResult = { result: IProtectTestConnection; target: { host: string; port: number; tlsMode } | null; at: number }`; `fetch()` (deadline, coalesced); `startPolling(): () => void` (reference-counted, first holder fetches immediately, idempotent release, pauses while `document.visibilityState !== 'visible'` and fetches on return, failures set `stale`); `testConnection(request, target)` (deadline; stores `lastTest` with the target it was run for; a timeout yields `{ timedOut: true }` instead of a failure result); `clearLastTest()`.
- `useProtectDiscovery()`: `discovery: IProtectDiscovery | null`, `probes: Record<string, IProtectProbe>` keyed `host:port`; `fetch()`, `scan()` (deadline 60 s; on client timeout re-`GET` the cached discovery), `probe({ host, port? })` (deadline 15 s).
- Types mirror the backend models in camelCase; hand-written zod schemas decide nullability.

- [ ] **Step 1: Write the failing tests**: status `polls every 5 s while held and stops after the last release`, `pauses while the page is hidden and fetches on return`, `marks the status stale after a failed or timed out poll and clears it on success`, `aborts a stalled read at the deadline so the next poll starts a new one`, `coalesces concurrent fetches`; test `sends the saved and the candidate request shapes`, `keeps the target a result was run for`, `reports a timeout without a failure category`, `never stores the candidate key`; discovery `re-reads the cached discovery after a scan timeout`, `keeps probe results per host and port`; transformers with nulls.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (templates: `devices-homey/store/*`, `modules/cameras/store/relay-status.store.ts`). **Step 4: Run, type-check, lint** → PASS.
- [ ] **Step 5: Commit** — `feat(admin): add unifi protect status and discovery stores`

### Task 3: Config form with discovery, API key and certificate trust

**Files:** `components/protect-config-form.vue` (+ spec, `.types.ts`), `components/protect-discovered-consoles.vue` (+ spec), `components/protect-test-connection.vue` (+ spec), `components/protect-certificate.vue` (+ spec), `components/protect-config-form.utils.ts` (+ spec); plugin entry uses the real form.

**Interfaces:**
- `protect-config-form.vue` follows `homey-config-form.vue` (`useConfigPluginEditForm`, `remoteForm*` props/emits, no Save). Sections in order:
  1. **Console** — `protect-discovered-consoles` (cached discovery on mount, Scan button with progress, consoles with name, model, host and firmware; "Check" runs `probe` and shows Protect presence and `direct_connect_domain` validity; "Use" fills `host`, preferring the probe's `preferred_host`; a manual "Check host" probes the typed host), then `host` (`inputmode="url"`, no autocorrect) and `port`.
  2. **API key** — `config-secret-input` plus one help line: "Create a key in UniFi Protect › Settings › Control Plane › Integrations › API Keys." (`apiKeyHelp`).
  3. **Certificate** — radio Verify / Pin. Verify shows `server_name` with one-click fills from the last test's `suggested_server_name` and the probe's `direct_connect_domain`; Pin shows `fingerprint_sha256`.
  4. **Advanced** (`el-collapse`, collapsed) — `stream_host_override`, `default_stream_quality`, `snapshot_min_interval_ms`, `poll_interval_ms`.
  5. **Test connection** — `protect-test-connection`, then the status panel from Task 4.
- `buildTestRequest(model, initial): { request; target } | { disabled: true; hint: 'needs_key' | 'needs_host' }` in the utils: candidate `{ mode: 'candidate', host, port, api_key, tls }` when host, port, TLS or the key differ from the saved config and the key is a typed string; saved `{ mode: 'saved' }` when nothing relevant changed and `apiKeyConfigured` (and the key is not marked for removal); otherwise disabled with the hint "Re-enter the API key to test a changed host" (`needs_key`).
- `protect-test-connection.vue`: success (console name and model, Protect version, minimum version and supported flag, NVR name) or failure (category sentence from `errorCategories.<category>`, backend message secondary), a timeout message, and `protect-certificate` when a certificate is returned. A result is current only while `lastTest.target` equals the form's host, port and TLS mode; otherwise it is hidden.
- `protect-certificate.vue` props `{ certificate; trustable: 'none' | 'untrusted' | 'changed' }`: subject, issuer, alternative names, validity, self-signed, trusted, SHA-256; `untrusted` shows "Trust this certificate"; `changed` shows "The console's certificate changed" and a confirm step before emitting `trust(fingerprint)`. The form sets `trustable` from the current result's `errorCategory` and TLS mode (Q2), handles `trust` by setting `tls.mode = 'pinned'` and the fingerprint, then re-runs the test as a candidate when a key is typed or as saved otherwise.

- [ ] **Step 1: Write the failing tests**: utils `tests the candidate with the typed key and the saved config otherwise`, `disables the test with a hint when a changed host has no typed key or the key is marked for removal`; form `uses a discovered console's preferred host`, `offers the suggested server name and the direct connect domain as fills in verify mode`, `trusting an untrusted certificate switches to pinned mode with its fingerprint and re-tests`, `asks for confirmation before replacing a pin whose certificate changed`, `offers no trust for a passing test or for a result of a previous host`, `keeps the advanced section collapsed by default`; test-connection `shows the minimum version from the API`, `shows a timeout without a failure category`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run, type-check, lint** → PASS.
- [ ] **Step 5: Commit** — `feat(admin): add the unifi protect config form with discovery and certificate trust`

### Task 4: Connection status panel

**Files:** `components/protect-connection-status.vue` (+ spec).

**Interfaces:** props `{ pollIntervalMs: number }`; holds `useProtectStatus().startPolling()` while mounted. Shows only the spec §8 fields: `connection_state`, `service_state`, enabled, configured, healthy, TLS mode, Protect and minimum version, NVR id and name, `last_connected_at`, last error (category sentence plus message), `reconnect_attempt`, `next_retry_at`, `realtime_state`, `ignored_event_count`. The real-time line reads "Streaming" or "Polling every N s" from `pollIntervalMs` (default 30 s). A stale status shows a warning line and keeps the last values; a first-read failure shows the warning alone. Times use the app locale. The form refreshes it once after a successful save and after each test.

- [ ] **Step 1: Write the failing tests** (standalone mount and inside the form): `shows only the allowed fields`, `reads polling every N s from the poll interval`, `shows a stale warning and keeps the last values`, `shows the warning when the first read failed`, `releases polling on unmount`, `refreshes after a successful save`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run, type-check, lint** → PASS.
- [ ] **Step 5: Commit** — `feat(admin): add the unifi protect connection status panel`

### Task 5: Onboarding entry, follow-ups and docs

**Files:** `apps/admin/src/modules/onboarding/components/step-integrations.vue` (+ spec): icon `mdi:cctv` in `pluginIcons`, the plugin in `pluginsRequiringConfig`, configured check branch (`host` non-empty and `apiKeyConfigured === true`). `tasks/epics/EPIC-UNIFI-PROTECT.md`: UP-12 row notes "part 1 done (settings); part 2 (wizard) after AR-12". GitHub: comment on #1188 describing the split; open follow-up issues "feat(admin): add the UniFi Protect adoption wizard" (part 2, depends on AR-12, carries per-camera stream options and the "stream off" semantics: `enabled: false` means "leave as is"), "Pre-tick UniFi Protect in onboarding when a console is discovered" and "Assign a space when adopting UniFi Protect devices" (backend DTO change), labelled like the other UP issues.

- [ ] **Step 1: Write the failing tests**: `lists the unifi protect plugin with its icon`, `asks to set up a protect plugin without a host or key`, `treats a protect plugin with host and stored key as configured`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; create the issues (`gh issue create`). **Step 4: Run the full admin suite (`test:unit`), type-check, lint, `lint:deps`** → PASS.
- [ ] **Step 5: Commit** — `feat(admin): list unifi protect in the onboarding integrations step`

---

## Self-review notes

- #1188 part-1 criteria: config form with discovery (scan/probe), manual host, write-only key with help, TLS verify or fingerprint confirmation, stream defaults, test connection, status panel that stays current (Tasks 1–4; Q1–Q3); onboarding lists the plugin (Task 5); six locales, `config-secrets.spec.ts` row, Vitest for the stores (Tasks 1–2). The wizard adapter criteria move to part 2 after AR-12.
- The plan review's findings are folded in: verify with an IP host (Q3), trust gating and pin replacement (Q2), realistic deadlines and timeout handling, test hints for an untouched or removed key, polling pause while hidden, and the wizard findings carried into the part-2 follow-up.
