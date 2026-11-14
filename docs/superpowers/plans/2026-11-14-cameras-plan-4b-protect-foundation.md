# Cameras — Plan 4b: UniFi Protect Plugin Foundation and API Client (UP-5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A disabled-by-default `devices-unifi-protect` plugin with secret-safe configuration, Protect identity
columns, a rate-paced, TLS-aware, read-only client for the Protect Integration API, a version gate, a managed
connector service, and `GET status` / `POST test-connection` routes, proven against a fake console built from the UP-0
fixtures.

**Architecture:** Pure units (`protect-version`, `protect-rate-pacer`, `protect-redaction`, `protect-tls-policy`) sit
under `client/` and are composed by `ProtectApiClient`, which talks to the console over Node `https` through a
per-instance `ProtectHttpsAgent` that enforces the TLS mode before the first request byte. `ProtectConnectorService` (a
`BaseManagedExtensionService`) owns one client per generation, gates the Protect version, keeps the status model, and
never throws for console outcomes. `ProtectConnectionTestService` inspects the presented certificate without sending
the key, then runs the version gate with saved or candidate credentials. Plan 5 (UP-7 … UP-10) builds the inventory,
realtime, platform and stream provider on `ProtectConnectorService.getClient()`.

**Tech Stack:** NestJS 11 on Fastify, TypeORM (SQLite), Node 24 `https`/`tls`/`crypto` (`X509Certificate`,
`timingSafeEqual`), class-validator / class-transformer, Jest, supertest. No new dependency (design D4; `undici` is not
a backend dependency, design §7.1).

**Spec:** `docs/superpowers/specs/2026-10-06-unifi-protect-integration-design.md` §4, §6 (D2, D3, D4, D10), §7.1, §9.4,
§11 (status model), §16, §17. Issue #1181 (epic #1175). Roadmap `docs/superpowers/plans/2026-11-12-cameras-roadmap.md`
§1 A9, §2, §4 (secret rule), §5 Plan 4 UP-5 steps 1–7, §6. Live spike findings (UP-0, 2026-11-14) are authoritative
where they differ; they are restated in Global Constraints and in "Decisions made in this plan". Reference plugin:
`apps/backend/src/plugins/devices-homey`.

## Global Constraints

- Branch `feat/unifi-protect-foundation` from `main`. One PR titled
  `feat(backend): add UniFi Protect plugin foundation and API client`, body ends with `Closes #1181`.
- Commits `<type>(backend): <lowercase imperative subject>` (`test(backend)` for test-only commits), each ending with
  `Co-Authored-By: <model that wrote it> <noreply@anthropic.com>`.
- TypeScript: tabs, single quotes, semicolons, trailing commas, print width 120; imports external, then `../`, then
  `./`, blank line between groups. Wire names snake_case via `@Expose({ name })`, properties camelCase.
- Identity: `DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX = 'devices-unifi-protect'`,
  `DEVICES_UNIFI_PROTECT_PLUGIN_NAME = 'devices-unifi-protect-plugin'`, `DEVICES_UNIFI_PROTECT_TYPE =
  'devices-unifi-protect'` (also the `@ChildEntity` discriminator value), `DEVICES_UNIFI_PROTECT_CONNECTOR_SERVICE_ID =
  'connector'`, managed owner `{ kind: 'plugin', type: 'devices-unifi-protect-plugin' }`,
  `registerPluginMetadata({ defaultEnabled: false })`. Routes under `/api/v1/plugins/devices-unifi-protect/`.
- Minimum Protect version `PROTECT_MIN_VERSION = '7.2.105'` (D3; 7.3.74 observed). Not user-configurable.
- Integration API base `/proxy/protect/integration` + `/v1/…`, header `X-API-KEY`. Console info `GET /api/system`
  (no key). Default port `443`.
- Config defaults: `port 443`, `tls.mode 'verify'`, `tls.server_name null`, `tls.fingerprint_sha256 null`,
  `stream_host_override null`, `default_stream_quality 'medium'` (`'high' | 'medium' | 'low'`),
  `snapshot_min_interval_ms 2000` (500–60000), `poll_interval_ms 30000` (5000–600000).
- TLS modes (spike): `verify` — chain and name checked, SNI/`servername` = `tls.server_name` (the console's
  `directConnectDomain`, which serves a valid public certificate) or the host when it is a DNS name; `pinned` — chain
  not checked, SHA-256 of the presented leaf must equal `tls.fingerprint_sha256`. There is no `insecure` mode: the API
  key is never sent over a connection that is neither name-verified nor pinned. Fingerprints are
  stored and returned as 64 lowercase hex characters without colons; input accepts either case, with or without colons.
- Client limits: per-attempt timeout `10_000` ms covering connect, headers and body; overall deadline `30_000` ms; at
  most `3` attempts; retry delay without `Retry-After` `500 * 2^(attempt-1)` ms ±20 %; `Retry-After` clamped to
  `60_000` ms; JSON body cap `2 * 1024 * 1024` bytes, image body cap `8 * 1024 * 1024`; certificate inspection timeout
  `5_000` ms; agent `keepAlive: true`, `maxSockets: 4`.
- Rate pacing (spike): default policy `10-in-1sec` (`q=10; w=1`) until a header says otherwise; spacing
  `ceil(w * 1000 / max(1, floor(q * 0.8)))` ms (125 ms for 10/1 s); `RateLimit: …; r=0; t=<s>` pauses until reset;
  `429` with `Retry-After` pauses every waiter of that client.
- Connector: reconnect backoff `min(1000 * 2^attempt, 60_000)` × `(0.8 + random * 0.4)`, capped at `60_000`; health
  check `GET /v1/meta/info` every `60_000` ms while connected. Status values exactly `disconnected | connecting |
  connected | degraded | auth_failed | version_unsupported | error` (design §11; `degraded` is produced from Plan 5 on).
- The client is read-only in UP-5: every request is `GET`. It never builds `disable-mic-permanently` and never calls
  `POST`/`DELETE …/rtsps-stream` (POST changes console configuration; spike). HQ snapshots are requested only by
  callers that checked `featureFlags.supportFullHdSnapshot`; the client maps the console's 400 for HQ to
  `unsupported`.
- Secret rule (roadmap §4): the API key and every RTSPS alias never reach a log line, an error message, a response
  body, a status field, a config-change event, the managed-service `lastError`, the database or a file other than the
  config file `ConfigService` writes (`<FB_CONFIG_PATH>/config.yaml`). Log lines carry endpoint templates, statuses,
  durations, error categories and fixed texts only. Readiness-validator messages are fixed texts (the manager logs them
  and stores them as `lastError`, `modules/extensions/services/managed-service-manager.service.ts:740-756`). Sentinels:
  key `PROTECT_SENTINEL_KEY_7f3a9c0d1e2b4a6f`, alias `SENTINELALIASprotect0123456789`.
- Fixtures under `apps/backend/src/plugins/devices-unifi-protect/__fixtures__/` belong to UP-0 (#1176) and are read
  only here. Names used by this plan (as in the UP-0 working tree on 2026-11-14): `meta-info.json`, `nvrs.json`
  (one object), `cameras.json` (2 × UVC G5 Dome, `supportFullHdSnapshot: false`), `sensors.json`, `lights.json`,
  `chimes.json` (synthetic, `"_synthetic": true`), `rtsps-stream.json` (`high` set, `medium`/`low`/`package` null,
  alias redacted), `snapshot-hq-unsupported.json` (`{ error, name }`), `snapshot.jpg`, `rate-limit-headers.json`
  (`ok` and `rate_limited` header maps), `system.json` (`directConnectDomain` `*.id.ui.direct`).
- Migration `1000000000060-AddUnifiProtectIdentity.ts` (main is at 059 on 2026-11-14). Re-check
  `ls apps/backend/src/migrations` when the branch is cut and rebase/renumber if another 060 lands first.
- Never edit generated code. Run `pnpm run generate:openapi` to check the spec builds; commit nothing generated
  (roadmap A11). `apps/admin/src/openapi.constants.ts` is untouched (admin aliases come with UP-12).
- `app.module.ts` is edited by appending only.

## Review Focus

1. **An admin enters the console IP and keeps the default `verify` mode** (the most likely first attempt; by IP the
   console presents a self-signed `CN=unifi.local`): the API key never leaves the process; test-connection answers
   `tls_untrusted` with the presented fingerprint and the console's `direct_connect_domain` as a suggestion; a saved
   config in that state shows `error` / `tls_untrusted` without a reconnect loop. → Tasks 5, 8, 9.
2. **The pinned self-signed certificate is replaced** (the spike's cert expires 2027-01-31; consoles regenerate it):
   the agent refuses the new certificate before sending a byte, the connector reports `tls_fingerprint_mismatch` once
   and does not retry, and re-pinning through test-connection recovers. → Tasks 5, 8.
3. **Bursts from several consumers** (Plan 5: three panels polling snapshots plus inventory reads): 15 parallel reads
   against a console enforcing `10-in-1sec` produce no 429; a 429 that still arrives pauses every waiter for
   `Retry-After`. → Tasks 4, 7.
4. **A console that hangs mid-response or returns an endless body** (nginx stall, wrong host serving a large file):
   every call ends within its timeout including the body, oversize bodies are cut off as `protocol`, and the connector
   schedules a reconnect instead of hanging its generation. → Tasks 6, 7, 8.
5. **Settings change while a connection attempt is in flight** (key rotated, host corrected): the superseded attempt's
   result is discarded, its client is closed, exactly one client is alive afterwards, and it uses the new settings. →
   Task 8.

## Decisions made in this plan (deviations from the issue, design and roadmap)

- **TLS config is `tls { mode, server_name, fingerprint_sha256 }`**, not `tls { verify, fingerprint_sha256 }` (issue
  #1181 acceptance criteria; design §7.1 line 242; roadmap line 232). The spike showed a valid public certificate
  behind SNI = `directConnectDomain`, so `verify` becomes the default and needs a server name; a boolean cannot express
  three modes.
- **The domain is never learned silently.** `GET /api/system` is read only by test-connection (without the key and
  without verification, because it is informational) and returned as a suggestion; the admin saves `server_name`.
  Learning it at runtime would let anyone answering on the IP choose the name the certificate is checked against.
- **No insecure TLS mode** (CodeRabbit on #1623): only `verify` and `pinned` exist; the key is never sent over an unverified connection. Pinning is always available because test-connection returns the presented fingerprint. A submitted `tls.mode: 'insecure'` is rejected with 400.
- **Candidate test-connection needs a new key**, as in Homey (`services/homey-connection-test.service.ts:100-118`):
  the stored key is never paired with a submitted host.
- **The connector never throws from `start()` for console outcomes.** Homey throws for non-retryable failures
  (`services/homey.service.ts:170-189`); here the reason lives in the status model, so the manager's `lastError` never
  carries an upstream message and the service stays `started` while it waits for a config change.
- **Identity columns go on two tables:** `protectNvrId`, `protectDeviceId`, `protectModelKey` on
  `devices_module_devices`, `protectMappingName` on `devices_module_channels_properties`. Columns on the devices table
  require rebuilding the thermostat deletion-capture trigger, exactly as migration 054 does
  (`migrations/1000000000054-AddModbusDevices.ts:18-31, 53-61, 104-118`); the roadmap's "one `ADD COLUMN` migration"
  understates this. A partial unique index on `(protectNvrId, protectDeviceId)` for Protect devices makes adoption
  idempotent at the database level; the property index is left to Plan 5, which fixes the mapping fan-out.
- **`GET /v1/nvrs` returns one object** (spike, `nvrs.json`; the design lists it among collections, §4.1 line 111).
  The client exposes `getNvr()` and accepts an array by taking its first entry (tolerant parsing, design §17).
- **Read-only, GET-only client.** The transport's method type is `'GET'`; Plan 5 widens it for `POST rtsps-stream`
  and `PATCH`. Retries follow design §4.3 for GET (408/429/500/502/503/504); a snapshot retries only 408/429 because
  503 means "camera offline" (design §4.1 line 114).
- **Health check every 60 s** re-reads `meta/info` while connected, so a dead console or a Protect downgrade shows in
  `status` before Plan 5's WebSockets exist.
- **Test-only trust anchor.** DI token `PROTECT_TRUSTED_CA` (default `undefined` = Node's system store) lets the e2e
  test exercise `verify` against a committed test CA. It is never derived from config or environment.
- **Committed test TLS material** under `apps/backend/test/fixtures/unifi-protect-tls/` with its generator script:
  the backend has no HTTPS test infrastructure (roadmap A9) and no cert-generation dependency.
- **Config model validates types and ranges only; DTO and readiness validator hold the host, server-name and
  fingerprint rules** (Plan 3a lesson: a model rule failing on a hand-edited file makes `getPluginConfig` throw).
- `stream_host_override`, `default_stream_quality`, `snapshot_min_interval_ms` and `poll_interval_ms` are stored and
  validated here and consumed by Plan 5. The spike console exposes only the `high` stream, so Plan 5 must fall back
  from the `medium` default.

---

## File map

All paths under `apps/backend/src/plugins/devices-unifi-protect/` unless they start with `apps/`, `src/` (=
`apps/backend/src/`) or `test/` (= `apps/backend/test/`).

| File | Responsibility | Task |
|---|---|---|
| `devices-unifi-protect.constants.ts` | identifiers, defaults, limits, enums, `ProtectTlsMode`, `ProtectStreamQuality` | 1 |
| `validators/protect-config.validators.ts` | pure host / server-name / fingerprint checks | 1 |
| `models/config.model.ts`, `dto/update-config.dto.ts`, `services/protect-config-validator.service.ts` | config, DTO, readiness | 1 |
| `src/plugins/plugin-secret-removal.spec.ts` (modify) | secret row | 1 |
| `entities/devices-unifi-protect.entity.ts`, `dto/{create,update}-*.dto.ts` (8 files) | child entities, DTO subclasses | 2 |
| `src/migrations/1000000000060-AddUnifiProtectIdentity.ts` (+ `__tests__/…spec.ts`) | identity columns, index, trigger | 2 |
| `devices-unifi-protect.plugin.ts`, `devices-unifi-protect.openapi.ts`, `index.ts`, `src/app.module.ts` (append) | registration | 3 |
| `client/protect-version.ts`, `client/protect-rate-pacer.ts`, `client/protect-redaction.ts` | pure units | 4 |
| `errors/protect-api.error.ts`, `client/protect-tls-policy.ts`, `client/protect-https-agent.ts` | errors, TLS | 5 |
| `test/fixtures/unifi-protect-tls/*`, `test/support/protect-tls.ts` | test CA, certs, TLS server helper | 5 |
| `client/protect-api.types.ts`, `client/protect-endpoints.ts`, `client/protect-http.transport.ts`, `client/protect-api.client.ts`, `client/protect-console-system.ts`, `client/protect-api-client.factory.ts` | client | 6 |
| `test/support/fake-protect-server.ts`, `client/protect-api.client.integration.spec.ts` | fake console, integration | 7 |
| `services/protect-reconnect-backoff.ts`, `services/protect-connector.service.ts`, `models/status.model.ts`, `controllers/protect-status.controller.ts`, `src/modules/extensions/services/managed-service-registration.inventory.spec.ts` (modify) | connector, status | 8 |
| `dto/test-connection.dto.ts`, `models/test-connection.model.ts`, `services/protect-connection-test.service.ts`, `controllers/protect-test-connection.controller.ts`, `test/devices-unifi-protect.e2e-spec.ts`, `tasks/epics/EPIC-UNIFI-PROTECT.md` | test-connection, e2e, PR | 9 |

---

### Task 1: Configuration, DTO and readiness validator

**Files:**
- Create: `devices-unifi-protect.constants.ts`, `validators/protect-config.validators.ts`, `models/config.model.ts`,
  `dto/update-config.dto.ts`, `services/protect-config-validator.service.ts`
- Modify: `src/plugins/plugin-secret-removal.spec.ts:4-24` (import), `:52` (row after Homey)
- Test: `validators/protect-config.validators.spec.ts`, `models/config.model.spec.ts`, `dto/update-config.dto.spec.ts`,
  `services/protect-config-validator.service.spec.ts`

Patterns: config model and secret projection `plugins/devices-homey/models/config.model.ts:18-87`; update DTO with
`[{"field":…,"reason":…}]` messages and `@Transform(null → undefined)` for non-secret scalars
`plugins/devices-homey/dto/update-config.dto.ts:18-92`; nested model/DTO `plugins/devices-wled/models/config.model.ts:119-164`,
`plugins/devices-wled/dto/update-config.dto.ts:16-47, 140-165`, and the nested `tls` model of
`plugins/devices-zigbee2mqtt/models/config.model.ts:140-141, 332-338`; readiness validator
`plugins/devices-homey/services/homey-config-validator.service.ts:19-92` (reads camelCase then snake_case keys).

**Interfaces:**
- Produces:

```ts
// devices-unifi-protect.constants.ts (exact values in Global Constraints)
export const DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX, DEVICES_UNIFI_PROTECT_PLUGIN_NAME, DEVICES_UNIFI_PROTECT_TYPE,
	DEVICES_UNIFI_PROTECT_CONNECTOR_SERVICE_ID;
export const DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME = 'Devices UniFi Protect plugin';
export const DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_DESCRIPTION =
	'Endpoints for configuring and monitoring the UniFi Protect device provider integration.';
export const PROTECT_MIN_VERSION = '7.2.105';
export const PROTECT_INTEGRATION_BASE_PATH = '/proxy/protect/integration';
export const PROTECT_DEFAULT_PORT = 443;
export const PROTECT_DEFAULT_SNAPSHOT_MIN_INTERVAL_MS = 2000, PROTECT_MIN_SNAPSHOT_MIN_INTERVAL_MS = 500,
	PROTECT_MAX_SNAPSHOT_MIN_INTERVAL_MS = 60000;
export const PROTECT_DEFAULT_POLL_INTERVAL_MS = 30000, PROTECT_MIN_POLL_INTERVAL_MS = 5000,
	PROTECT_MAX_POLL_INTERVAL_MS = 600000;
export const PROTECT_REQUEST_TIMEOUT_MS = 10000, PROTECT_REQUEST_DEADLINE_MS = 30000, PROTECT_MAX_ATTEMPTS = 3,
	PROTECT_RETRY_BASE_DELAY_MS = 500, PROTECT_MAX_RETRY_AFTER_MS = 60000, PROTECT_TLS_INSPECT_TIMEOUT_MS = 5000,
	PROTECT_MAX_JSON_BYTES = 2 * 1024 * 1024, PROTECT_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const PROTECT_RATE_UTILISATION = 0.8;
export const PROTECT_DEFAULT_RATE_POLICY = { quota: 10, windowSeconds: 1 } as const;
export const PROTECT_RECONNECT_INITIAL_DELAY_MS = 1000, PROTECT_RECONNECT_MAX_DELAY_MS = 60000,
	PROTECT_RECONNECT_JITTER_RATIO = 0.2, PROTECT_HEALTH_CHECK_INTERVAL_MS = 60000;
export const PROTECT_TLS_MODES = ['verify', 'pinned'] as const;
export type ProtectTlsMode = (typeof PROTECT_TLS_MODES)[number];
export const PROTECT_STREAM_QUALITIES = ['high', 'medium', 'low'] as const;
export type ProtectStreamQuality = (typeof PROTECT_STREAM_QUALITIES)[number];
export enum ProtectConnectionState { DISCONNECTED = 'disconnected', CONNECTING = 'connecting', CONNECTED = 'connected',
	DEGRADED = 'degraded', AUTH_FAILED = 'auth_failed', VERSION_UNSUPPORTED = 'version_unsupported', ERROR = 'error' }
export const PROTECT_ENDPOINTS = ['meta/info', 'nvrs', 'cameras', 'cameras/{id}', 'cameras/{id}/rtsps-stream',
	'cameras/{id}/snapshot', 'sensors', 'lights'] as const; // Plan 5 appends; never 'cameras/{id}/disable-mic-permanently'
export type ProtectEndpoint = (typeof PROTECT_ENDPOINTS)[number];

// validators/protect-config.validators.ts
export const MAX_PROTECT_HOST_LENGTH = 253;
export function isValidProtectHost(value: unknown): value is string;       // IPv4, IPv6 (no brackets) or RFC 1123 name; no scheme, port, path, userinfo, whitespace
export function isValidProtectServerName(value: unknown): value is string; // RFC 1123 DNS name only (not an IP)
export function normalizeProtectFingerprint(value: unknown): string | null; // strip ':' , lowercase; 64 hex or null

// models/config.model.ts
@ApiSchema({ name: 'DevicesUnifiProtectPluginDataConfigTls' })
export class ProtectTlsConfigModel { mode: ProtectTlsMode = 'verify'; serverName: string | null = null; fingerprintSha256: string | null = null }
@ApiSchema({ name: 'DevicesUnifiProtectPluginDataConfig' })
export class ProtectConfigModel extends PluginConfigModel {
	type = DEVICES_UNIFI_PROTECT_PLUGIN_NAME; host: string | null = null; port = 443;
	apiKey: string | null = null; apiKeyConfigured?: boolean; tls = new ProtectTlsConfigModel();
	streamHostOverride: string | null = null; defaultStreamQuality: ProtectStreamQuality = 'medium';
	snapshotMinIntervalMs = 2000; pollIntervalMs = 30000;
}
// wire: host, port, api_key (writeOnly), api_key_configured, tls { mode, server_name, fingerprint_sha256 },
//       stream_host_override, default_stream_quality, snapshot_min_interval_ms, poll_interval_ms

// dto/update-config.dto.ts
@ApiSchema({ name: 'DevicesUnifiProtectPluginUpdateConfigTls' })
export class ProtectUpdateTlsConfigDto { mode?: ProtectTlsMode; serverName?: string | null; fingerprintSha256?: string | null }
@ApiSchema({ name: 'DevicesUnifiProtectPluginUpdateConfig' })
export class ProtectUpdatePluginConfigDto extends UpdatePluginConfigDto {
	type: typeof DEVICES_UNIFI_PROTECT_PLUGIN_NAME; host?: string | null; port?: number; apiKey?: string | null;
	tls?: ProtectUpdateTlsConfigDto; streamHostOverride?: string | null; defaultStreamQuality?: ProtectStreamQuality;
	snapshotMinIntervalMs?: number; pollIntervalMs?: number;
}

// services/protect-config-validator.service.ts
@Injectable()
export class ProtectConfigValidatorService implements IPluginConfigValidator, OnModuleInit {
	readonly pluginType = DEVICES_UNIFI_PROTECT_PLUGIN_NAME;
	validate(config: Record<string, unknown>): Promise<IConfigValidationResult>;
}
```

`fingerprint_sha256` in the DTO is normalized by a `@Transform` with `normalizeProtectFingerprint` (an unnormalizable
string stays as submitted so validation fails on it). The secret uses no `null → undefined` transform (a `null` must
survive, `plugin-secret-removal.spec.ts:78-95`). Readiness messages (fixed, no values): `UniFi Protect host is
required` (`host`), `UniFi Protect host must be a hostname or IP address` (`host`), `UniFi Protect port must be
between 1 and 65535` (`port`), `UniFi Protect API key is required` (`api_key`), `Unknown TLS mode` (`tls.mode`), `TLS server name is required when the host is an IP address` (`tls.server_name`),
`Pinned TLS mode requires a SHA-256 certificate fingerprint` (`tls.fingerprint_sha256`), `TLS server name must be a
DNS name` (`tls.server_name`).

- [ ] **Step 1: Write the failing tests.**

```ts
// validators/protect-config.validators.spec.ts
it.each(['192.168.1.1', 'fe80::1', 'unvr.local', 'abc123.id.ui.direct'])('accepts the host %s', (h) =>
	expect(isValidProtectHost(h)).toBe(true));
it.each(['https://192.168.1.1', '192.168.1.1:443', 'host/path', 'user@host', 'a b', '', 'x'.repeat(254), 42])(
	'refuses the host %#', (h) => expect(isValidProtectHost(h)).toBe(false));
it.each(['192.168.1.1', '::1', 'bad_name.local', ''])('refuses the server name %#', (n) =>
	expect(isValidProtectServerName(n)).toBe(false));
it('normalizes fingerprints', () => {
	const hex = 'ab'.repeat(32);
	expect(normalizeProtectFingerprint(hex.toUpperCase().match(/../g)!.join(':'))).toBe(hex);
	expect(normalizeProtectFingerprint('ab'.repeat(31))).toBeNull();
	expect(normalizeProtectFingerprint('zz'.repeat(32))).toBeNull();
});

// models/config.model.spec.ts
it('defaults to verify mode on port 443 with the design defaults', () => {
	const c = toInstance(ProtectConfigModel, { type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME });
	expect([c.port, c.tls.mode, c.tls.serverName, c.defaultStreamQuality, c.snapshotMinIntervalMs, c.pollIntervalMs])
		.toEqual([443, 'verify', null, 'medium', 2000, 30000]);
	expect(validateSync(c)).toHaveLength(0);
});
it('projects the key as api_key_configured and never serializes api_key', () => { /* as homey models/config.model.spec.ts:16-31 */ });
it('loads a hand-edited config with an invalid host without validation errors', () => { /* host 'https://x' → validateSync length 0 */ });

// dto/update-config.dto.spec.ts
it.each([
	[{ host: 'https://192.168.1.1' }, 'host'], [{ port: 0 }, 'port'], [{ port: 65536 }, 'port'],
	[{ tls: { mode: 'off' } }, 'mode'], [{ tls: { mode: 'insecure' } }, 'mode'], [{ tls: { fingerprint_sha256: 'abc' } }, 'fingerprint_sha256'],
	[{ tls: { server_name: '10.0.0.1' } }, 'server_name'], [{ default_stream_quality: 'package' }, 'default_stream_quality'],
	[{ snapshot_min_interval_ms: 499 }, 'snapshot_min_interval_ms'], [{ poll_interval_ms: 600001 }, 'poll_interval_ms'],
	[{ stream_host_override: 'rtsps://h' }, 'stream_host_override'],
])('rejects %j', async (data, field) => {
	const errors = await validate(plainToInstance(ProtectUpdatePluginConfigDto, { type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME, ...data }));
	expect(JSON.stringify(errors)).toContain(field);
});
it('normalizes a colon-separated upper-case fingerprint', () => { /* 'AB:AB:…' → 'abab…' */ });
it('keeps stored tls fields that a nested update omits', () => {
	// stored tls { mode: 'pinned', fingerprint_sha256: F } + update tls { server_name: 'x.id.ui.direct' } merged through
	// new ConfigSecretsService().merge → mode 'pinned', fingerprintSha256 F, serverName 'x.id.ui.direct'
});

// services/protect-config-validator.service.spec.ts
it('registers itself for the plugin type', () => { /* onModuleInit → register(service) */ });
it('accepts an incomplete disabled configuration', async () =>
	expect(await service.validate({ enabled: false })).toEqual({ valid: true }));
it.each([
	[{ api_key: 'k' }, 'host'], [{ host: 'https://h', api_key: 'k' }, 'host'], [{ host: 'h.local' }, 'api_key'],
	[{ host: 'h.local', api_key: 'k', port: 70000 }, 'port'],
	[{ host: 'h.local', api_key: 'k', tls: { mode: 'pinned' } }, 'tls.fingerprint_sha256'],
	[{ host: 'h.local', api_key: 'k', tls: { mode: 'verify', server_name: '10.0.0.1' } }, 'tls.server_name'],
	[{ host: '10.0.0.2', api_key: 'k', tls: { mode: 'verify' } }, 'tls.server_name'], // verify by IP without server_name is not ready
	[{ host: 'h.local', api_key: 'k', tls: { mode: 'insecure' } }, 'tls.mode'],
])('blocks an enabled config missing %j', async (config, field) => {
	const result = await service.validate({ enabled: true, ...config });
	expect(result.valid).toBe(false);
	expect(result.errors?.[0]?.field).toBe(field);
});
it('never echoes a submitted value in a message', async () => {
	const result = await service.validate({ enabled: true, host: 'https://PROTECT_SENTINEL', api_key: 'PROTECT_SENTINEL_KEY_7f3a9c0d1e2b4a6f' });
	expect(JSON.stringify(result)).not.toContain('PROTECT_SENTINEL');
});
```

  In `plugin-secret-removal.spec.ts` add `['devices-unifi-protect', ProtectUpdatePluginConfigDto, 'api_key', 'apiKey']`
  after the Homey row.

- [ ] **Step 2: Run them.** Run (from `apps/backend`): `npx jest src/plugins/devices-unifi-protect src/plugins/plugin-secret-removal.spec.ts`
  Expected: FAIL (modules not found).

- [ ] **Step 3: Implement** the constants, validators, model, DTO and validator service. `stream_host_override` uses
  `isValidProtectHost`; `null` clears it.

- [ ] **Step 4: Run them.** Same command. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/backend/src/plugins/devices-unifi-protect apps/backend/src/plugins/plugin-secret-removal.spec.ts
git commit -m "feat(backend): add unifi protect plugin configuration and secret handling"
```

---

### Task 2: Identity entities, DTO subclasses and migration 060

**Files:**
- Create: `entities/devices-unifi-protect.entity.ts`, `dto/create-device.dto.ts`, `dto/update-device.dto.ts`,
  `dto/create-device-channel.dto.ts`, `dto/create-device-channel-property.dto.ts`, `dto/create-channel.dto.ts`,
  `dto/update-channel.dto.ts`, `dto/create-channel-property.dto.ts`, `dto/update-channel-property.dto.ts`,
  `src/migrations/1000000000060-AddUnifiProtectIdentity.ts`
- Test: `entities/devices-unifi-protect.entity.spec.ts`, `src/migrations/__tests__/1000000000060-AddUnifiProtectIdentity.spec.ts`

Patterns: child entities and partial unique index `plugins/devices-homey/entities/devices-homey.entity.ts:10-93`;
DTO subclasses one-to-one with `plugins/devices-homey/dto/{create,update}-*.dto.ts` (e.g. `create-device.dto.ts`);
migration with device columns and trigger rebuild `migrations/1000000000054-AddModbusDevices.ts:18-31, 53-61, 104-118`;
its trigger test `migrations/__tests__/1000000000054-AddModbusDevices.spec.ts:137-223`; nullable-column test
`migrations/__tests__/1000000000058-AddModbusLongPress.spec.ts:1-47`; partial index on the discriminator
`migrations/1000000000021-AddHomeyCapabilityIdentity.ts:9-13`.

**Interfaces:**
- Consumes: `DEVICES_UNIFI_PROTECT_TYPE` (Task 1).
- Produces:

```ts
@ApiSchema({ name: 'DevicesUnifiProtectPluginDataDevice' })
@Index('UQ_unifi_protect_device_identity', ['protectNvrId', 'protectDeviceId'], { unique: true,
	where: `"type" = 'devices-unifi-protect' AND "protectNvrId" IS NOT NULL AND "protectDeviceId" IS NOT NULL` })
@ChildEntity(DEVICES_UNIFI_PROTECT_TYPE)
export class ProtectDeviceEntity extends DeviceEntity {
	protectNvrId: string | null;    // wire protect_nvr_id
	protectDeviceId: string | null; // wire protect_device_id
	protectModelKey: string | null; // wire protect_model_key ('camera' | 'sensor' | 'light' | …)
}
@ApiSchema({ name: 'DevicesUnifiProtectPluginDataChannel' }) @ChildEntity(DEVICES_UNIFI_PROTECT_TYPE)
export class ProtectChannelEntity extends ChannelEntity {}
@ApiSchema({ name: 'DevicesUnifiProtectPluginDataChannelProperty' }) @ChildEntity(DEVICES_UNIFI_PROTECT_TYPE)
export class ProtectChannelPropertyEntity extends ChannelPropertyEntity { protectMappingName: string | null } // wire protect_mapping_name

// DTOs (schema names DevicesUnifiProtectPlugin{Create,Update}{Device,DeviceChannel,DeviceChannelProperty,Channel,ChannelProperty})
CreateProtectDeviceDto            // + protectNvrId?, protectDeviceId?, protectModelKey? (IsString, MaxLength 64)
UpdateProtectDeviceDto            // type only: identity is immutable through the API
CreateProtectDeviceChannelDto, CreateProtectChannelDto, UpdateProtectChannelDto
CreateProtectDeviceChannelPropertyDto, CreateProtectChannelPropertyDto // + protectMappingName? (IsString, MaxLength 128)
UpdateProtectChannelPropertyDto   // type only

// migration
export class AddUnifiProtectIdentity1000000000060 implements MigrationInterface { name = 'AddUnifiProtectIdentity1000000000060' }
```

Migration `up`: `ALTER TABLE "devices_module_devices" ADD COLUMN` for `protectNvrId`, `protectDeviceId`,
`protectModelKey` (all `varchar`); rebuild `virtual_thermostat_capture_admitted_deletion` with
`climateDeletionCaptureSql` when it exists (copy the two helpers of 054:21-31); `ALTER TABLE
"devices_module_channels_properties" ADD COLUMN "protectMappingName" varchar`; `CREATE UNIQUE INDEX
"UQ_unifi_protect_device_identity" ON "devices_module_devices" ("protectNvrId", "protectDeviceId") WHERE "type" =
'devices-unifi-protect' AND "protectNvrId" IS NOT NULL AND "protectDeviceId" IS NOT NULL`. `down` reverses: drop the
index, drop the property column, drop the trigger if present, drop device columns in reverse, recreate the trigger.

- [ ] **Step 1: Write the failing tests.**

```ts
// entities/devices-unifi-protect.entity.spec.ts
it('uses the plugin discriminator and exposes the identity columns in snake case', () => {
	const device = toInstance(ProtectDeviceEntity, { id: 'd', protect_nvr_id: 'n', protect_device_id: 'c', protect_model_key: 'camera' });
	expect(device.type).toBe('devices-unifi-protect');
	expect(instanceToPlain(device)).toMatchObject({ type: 'devices-unifi-protect', protect_nvr_id: 'n', protect_device_id: 'c', protect_model_key: 'camera' });
	expect(getMetadataArgsStorage().discriminatorValues.find((d) => d.target === ProtectDeviceEntity)?.value).toBe('devices-unifi-protect');
});
it('does not accept identity changes through the update DTO', async () => {
	const dto = plainToInstance(UpdateProtectDeviceDto, { type: 'devices-unifi-protect', protect_device_id: 'x' }, { excludeExtraneousValues: true });
	expect((dto as Record<string, unknown>).protectDeviceId).toBeUndefined();
});

// __tests__/1000000000060-AddUnifiProtectIdentity.spec.ts — in-memory sqlite as 058's spec
it('adds four nullable varchar columns and keeps existing rows', async () => { /* PRAGMA table_info on both tables; existing row values null */ });
it('rejects a second Protect device with the same NVR and device id', async () => {
	await migration.up(queryRunner);
	await insert('a', 'devices-unifi-protect', 'nvr', 'cam');
	await expect(insert('b', 'devices-unifi-protect', 'nvr', 'cam')).rejects.toThrow(/UNIQUE/);
});
it('allows the same ids on another device type and allows null ids', async () => { /* type 'devices-homey' and nulls → no error */ });
// describe('… thermostat deletion trigger') — copy 054 spec lines 137-175 setup, then:
it('rebuilds the trigger with the Protect columns exactly as the runtime expects', async () => {
	expect(installedBefore).toBe(await climateDeletionCaptureSql(queryRunner.manager));
	await migration.up(queryRunner);
	const expected = await climateDeletionCaptureSql(queryRunner.manager);
	expect(await triggerSql()).toEqual([expected]);
	for (const column of ['protectNvrId', 'protectDeviceId', 'protectModelKey']) expect(expected).toContain(`'${column}', OLD."${column}"`);
});
it('does not create the trigger when migration 49 has not installed it', async () => { /* as 054 spec :128-134 */ });
it('down removes the columns and the index and restores the original trigger', async () => {
	await migration.up(queryRunner); await migration.down(queryRunner);
	expect(await deviceColumns()).toEqual(['id', 'type', 'name']);
	expect(await triggerSql()).toEqual([installedBefore]);
});
```

- [ ] **Step 2: Run them.** `npx jest src/plugins/devices-unifi-protect/entities src/migrations/__tests__/1000000000060-AddUnifiProtectIdentity.spec.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement** the entities, the eight DTOs and the migration. Confirm 060 is still free
  (`ls src/migrations | tail -2`).

- [ ] **Step 4: Run them, plus the full-chain migration suites.** The same command, then
  `npx jest --config ./test/jest-e2e.json test/migration-cli-recovery.e2e-spec.ts test/thermostat-creation-catalog.e2e-spec.ts`
  Expected: PASS (the catalog check accepts appended columns: it only matches `"catalogBirth" integer` followed by `,`
  or `)`, `plugins/devices-virtual/services/thermostat-creation-catalog.ts:78-88`).

- [ ] **Step 5: Commit.**

```bash
git add apps/backend/src/plugins/devices-unifi-protect apps/backend/src/migrations
git commit -m "feat(backend): add unifi protect device identity entities and migration"
```

---

### Task 3: Plugin module and registration

**Files:**
- Create: `devices-unifi-protect.plugin.ts`, `devices-unifi-protect.openapi.ts`, `index.ts`
- Modify: `src/app.module.ts`, appending only: the import pair (constant and plugin; the import sorter of
  `pnpm run lint:js:fix` places it), a route child `{ path: DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX, module:
  DevicesUnifiProtectPlugin }` after the Cloudflare child at `:473-476` (before `...pluginRoutes` at `:477`), and
  `DevicesUnifiProtectPlugin,` after `RemoteAccessCloudflareTunnelPlugin,` at `:563`
- Test: `devices-unifi-protect.plugin.spec.ts`

Pattern: `plugins/devices-homey/devices-homey.plugin.ts:65-288` (module decorator, config mapping with
`secretFields` at `:152-163`, three type mappers, swagger models, nine discriminators via `registerDiscriminator` at
`:278-288`, `registerPluginMetadata` at `:203-272`); spec `plugins/devices-homey/devices-homey.plugin.spec.ts:26-93`.

**Interfaces:**
- Consumes: Task 1 config classes and validator; Task 2 entities and DTOs.
- Produces: `DevicesUnifiProtectPlugin` (`@ApiTag({ tagName: DEVICES_UNIFI_PROTECT_PLUGIN_NAME, displayName:
  DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME, description: …_API_TAG_DESCRIPTION })`; imports
  `TypeOrmModule.forFeature([ProtectDeviceEntity, ProtectChannelEntity, ProtectChannelPropertyEntity])`,
  `DevicesModule`, `ConfigModule`, `ExtensionsModule`, `SwaggerModule`; provider `ProtectConfigValidatorService`);
  `DEVICES_UNIFI_PROTECT_PLUGIN_SWAGGER_EXTRA_MODELS` (config model and DTOs, entities, the eight DTOs; later tasks
  append). Tasks 8 and 9 add providers, controllers and the managed-service registration to this module.

Metadata: `name: 'UniFi Protect'`, `description: 'Connects Smart Panel to a UniFi Protect console over its local
Integration API'`, `author: 'FastyBird'`, `defaultEnabled: false`, `links` as Homey. The readme follows Homey's
headings (`# UniFi Protect`, *What you get*, *Setup*, *Configuration* table of every config field with its default,
*TLS* explaining the two modes (`verify`, `pinned`) and that there is no insecure mode, *Boundaries*). It must state:
Protect 7.2.105 or newer; create the API key in Protect → Integrations; the key is write-only and never returned;
this version reads only and never changes console settings; the plugin never disables a camera microphone.

- [ ] **Step 1: Write the failing test.**

```ts
it('registers config, secret field, type mappers, discriminators and disabled-by-default metadata', () => {
	plugin.onModuleInit();
	expect(configMapper.registerMapping).toHaveBeenCalledWith(expect.objectContaining({
		type: 'devices-unifi-protect-plugin', class: ProtectConfigModel, configDto: ProtectUpdatePluginConfigDto,
		secretFields: [{ path: 'api_key', configuredPath: 'api_key_configured', inputPaths: ['apiKey'] }],
	}));
	for (const mapper of [devicesMapper, channelsMapper, propertiesMapper])
		expect(mapper.registerMapping).toHaveBeenCalledWith(expect.objectContaining({ type: 'devices-unifi-protect' }));
	expect(discriminators.register).toHaveBeenCalledTimes(9);
	expect(extensions.registerPluginMetadata).toHaveBeenCalledWith(expect.objectContaining({
		type: 'devices-unifi-protect-plugin', name: 'UniFi Protect', defaultEnabled: false }));
	expect(extensions.registerPluginMetadata.mock.calls[0][0].readme).toMatch(/7\.2\.105/);
});
it('is wired into the application router', () => {
	const source = readFileSync(resolve(__dirname, '../../app.module.ts'), 'utf8');
	expect(source).toMatch(/path: DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX,\s*module: DevicesUnifiProtectPlugin,/);
	expect(source).toMatch(/RemoteAccessCloudflareTunnelPlugin,\s*DevicesUnifiProtectPlugin,/);
});
```

- [ ] **Step 2: Run it.** `npx jest src/plugins/devices-unifi-protect/devices-unifi-protect.plugin.spec.ts` Expected: FAIL.

- [ ] **Step 3: Implement** the module, openapi list, `index.ts` (re-exports as Homey's `index.ts:1-26` for the files
  that exist), and the three `app.module.ts` insertions.

- [ ] **Step 4: Run it, then boot-check.** The same command; then `pnpm run generate:openapi` from the repository
  root. Expected: PASS; the generated spec contains `DevicesUnifiProtectPluginDataConfig` and
  `DevicesUnifiProtectPluginDataDevice` (`grep -c DevicesUnifiProtectPlugin spec/api/v1/openapi.json` > 0); `git status`
  shows no generated file staged.

- [ ] **Step 5: Commit.**

```bash
git add apps/backend/src/plugins/devices-unifi-protect apps/backend/src/app.module.ts
git commit -m "feat(backend): register the unifi protect plugin"
```

---

### Task 4: Version gate, rate pacer and redaction

**Files:**
- Create: `client/protect-version.ts`, `client/protect-rate-pacer.ts`, `client/protect-redaction.ts`
- Test: `client/protect-version.spec.ts`, `client/protect-rate-pacer.spec.ts`, `client/protect-redaction.spec.ts`

**Interfaces:**
- Consumes: `PROTECT_MIN_VERSION`, `PROTECT_RATE_UTILISATION`, `PROTECT_DEFAULT_RATE_POLICY`,
  `PROTECT_MAX_RETRY_AFTER_MS` (Task 1).
- Produces:

```ts
// client/protect-version.ts
export interface ProtectVersion { major: number; minor: number; patch: number }
export function parseProtectVersion(value: unknown): ProtectVersion | null; // /^(\d+)\.(\d+)(?:\.(\d+))?(?:[-+][0-9A-Za-z.-]+)?$/, patch defaults to 0
export function compareProtectVersions(a: ProtectVersion, b: ProtectVersion): -1 | 0 | 1;
export function isSupportedProtectVersion(value: unknown, minimum: string = PROTECT_MIN_VERSION): boolean;

// client/protect-rate-pacer.ts
export interface ProtectRatePolicy { quota: number; windowSeconds: number }
export interface ProtectRateState { remaining: number; resetSeconds: number }
export type ProtectHeaders = Record<string, string | string[] | undefined>; // lower-case names
export function parseRateLimitPolicy(header: string | string[] | undefined): ProtectRatePolicy | null; // most restrictive item
export function parseRateLimit(header: string | string[] | undefined): ProtectRateState | null;
export function parseRetryAfterMs(header: string | string[] | undefined, nowMs: number): number | null; // seconds or HTTP-date, clamped [0, 60000]
export function pacingIntervalMs(policy: ProtectRatePolicy, utilisation?: number): number;
export class ProtectRatePacer {
	constructor(options?: { utilisation?: number; now?: () => number; sleep?: (ms: number, signal?: AbortSignal) => Promise<void> });
	readonly policy: ProtectRatePolicy;            // starts at PROTECT_DEFAULT_RATE_POLICY
	acquire(signal?: AbortSignal): Promise<void>;  // FIFO; rejects with signal.reason when aborted
	observe(headers: ProtectHeaders): void;        // reads 'ratelimit-policy' and 'ratelimit'
	backOff(ms: number): void;                     // pauses every pending and future acquisition
}

// client/protect-redaction.ts
export const PROTECT_REDACTED = '<redacted>';
export function redactProtectText(text: string, secrets: readonly string[]): string;
```

Pacer algorithm: keep `nextSlotAt` and `pausedUntil`; `acquire` reserves `slot = max(now, nextSlotAt, pausedUntil)`
synchronously, sets `nextSlotAt = slot + pacingIntervalMs(policy)`, then sleeps `slot - now`. `observe` replaces the
policy when `ratelimit-policy` parses and, when `ratelimit` reports `r=0`, sets `pausedUntil = now + t * 1000`.
Policy items follow IETF draft-8 structured fields: `"<name>"; q=<int>; w=<int>[; pk=:<b64>:]`, comma-separated; an
item without positive `q` and `w` is ignored; the most restrictive item is the one with the largest
`pacingIntervalMs`. Redaction order: secret literals of length ≥ 4, longest first; then `X-API-KEY` followed by `:` or
`=` and a token; then `(rtsps?|rtspx)://<host[:port]>/<path…>` keeps scheme, host and port and replaces path and
query by `<redacted>`; then truncation to 1024 characters.

- [ ] **Step 1: Write the failing tests.**

```ts
// protect-version.spec.ts
it.each([
	['7.2.105', true], ['7.3.74', true], ['7.10.0', true], ['8.0.0', true], ['7.3', true], ['7.3.74-beta.3', true],
	['7.2.104', false], ['6.9.999', false], ['5.3.48', false], ['', false], ['v7.3.74', false], ['7.x.1', false], [null, false], [7.3, false],
])('isSupportedProtectVersion(%p) is %p', (v, expected) => expect(isSupportedProtectVersion(v)).toBe(expected));
it('compares numerically, not lexically', () =>
	expect(compareProtectVersions(parseProtectVersion('7.10.0')!, parseProtectVersion('7.9.9')!)).toBe(1));

// protect-rate-pacer.spec.ts
const fixture = JSON.parse(readFileSync(join(FIXTURES, 'rate-limit-headers.json'), 'utf8'));
it('parses the console policy header', () =>
	expect(parseRateLimitPolicy(fixture.ok['ratelimit-policy'])).toEqual({ quota: 10, windowSeconds: 1 }));
it('keeps the most restrictive of several policies', () =>
	expect(parseRateLimitPolicy('"10-in-1sec"; q=10; w=1, "100-in-1min"; q=100; w=60')).toEqual({ quota: 100, windowSeconds: 60 }));
it.each([undefined, '', 'garbage', '"x"; q=0; w=1', '"x"; q=10'])('ignores the policy %p', (h) => expect(parseRateLimitPolicy(h)).toBeNull());
it('parses remaining and reset', () => expect(parseRateLimit('"10-in-1sec"; r=0; t=1')).toEqual({ remaining: 0, resetSeconds: 1 }));
it.each([['1', 1000], ['0', 0], ['120', 60000], ['-1', null], ['soon', null]])('Retry-After %p → %p ms', (h, ms) =>
	expect(parseRetryAfterMs(h, 0)).toBe(ms));
it('accepts an HTTP-date Retry-After', () =>
	expect(parseRetryAfterMs(new Date(Date.UTC(2026, 0, 1, 0, 0, 3)).toUTCString(), Date.UTC(2026, 0, 1))).toBe(3000));
it.each([[{ quota: 10, windowSeconds: 1 }, 125], [{ quota: 5, windowSeconds: 1 }, 250], [{ quota: 1, windowSeconds: 1 }, 1000]])(
	'spaces %j at %d ms', (p, ms) => expect(pacingIntervalMs(p)).toBe(ms));
// with a virtual clock (now/sleep injected; sleep advances the clock)
it('spaces 20 acquisitions at least 125 ms apart in FIFO order', async () => { /* start times strictly increasing, gaps ≥ 125 */ });
it('waits for the reset after the fixture 429 headers', async () => {
	pacer.observe(fixture.rate_limited); // RateLimit r=0; t=1
	await pacer.acquire(); expect(clock.now()).toBeGreaterThanOrEqual(1000);
});
it('backOff delays waiters that are already queued', async () => { /* acquire ×3 pending, backOff(1000) → all start ≥ 1000 */ });
it('rejects an aborted acquisition and keeps serving the next waiter', async () => { /* … */ });
it('adopts a slower advertised policy', () => {
	pacer.observe({ 'ratelimit-policy': '"5-in-1sec"; q=5; w=1' }); expect(pacer.policy).toEqual({ quota: 5, windowSeconds: 1 });
});

// protect-redaction.spec.ts
const KEY = 'PROTECT_SENTINEL_KEY_7f3a9c0d1e2b4a6f';
it('removes the key literal and any X-API-KEY header value', () => {
	expect(redactProtectText(`failed with ${KEY}`, [KEY])).toBe('failed with <redacted>');
	expect(redactProtectText('X-API-KEY: abcdef123', [])).toBe('X-API-KEY: <redacted>');
});
it.each([
	['rtsps://192.168.1.1:7441/SENTINELALIASprotect0123456789?enableSrtp', 'rtsps://192.168.1.1:7441/<redacted>'],
	['rtspx://h:7441/abc', 'rtspx://h:7441/<redacted>'], ['rtsp://h/abc', 'rtsp://h/<redacted>'],
])('redacts the stream alias of %s', (input, output) => expect(redactProtectText(input, [])).toBe(output));
it('is idempotent and keeps the fixture host visible', () => { /* redact(redact(x)) === redact(x); fixture high keeps ':7441/' */ });
it('ignores empty and short secrets', () => expect(redactProtectText('abc', ['', 'ab'])).toBe('abc'));
```

  `FIXTURES = resolve(__dirname, '../__fixtures__')`.

- [ ] **Step 2: Run them.** `npx jest src/plugins/devices-unifi-protect/client` Expected: FAIL.

- [ ] **Step 3: Implement** the three files.

- [ ] **Step 4: Run them.** Same command. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/backend/src/plugins/devices-unifi-protect/client
git commit -m "feat(backend): add unifi protect version gate, rate pacer and redaction"
```

---

### Task 5: Typed errors, TLS policy and the pinning HTTPS agent

**Files:**
- Create: `errors/protect-api.error.ts`, `client/protect-tls-policy.ts`, `client/protect-https-agent.ts`,
  `test/fixtures/unifi-protect-tls/generate.sh`, `ca.crt`, `console.crt`, `console.key`, `self-signed.crt`,
  `self-signed.key` (same directory), `test/support/protect-tls.ts`
- Test: `errors/protect-api.error.spec.ts`, `client/protect-tls-policy.spec.ts`, `client/protect-https-agent.spec.ts`

Pattern for errors: `plugins/devices-homey/errors/homey-connector.error.ts:1-44` (category, operation, retryable,
fixed message). Fixed user texts as `plugins/devices-homey/services/homey-connection-test.service.ts:25-33`.

**Interfaces:**
- Consumes: `ProtectTlsMode`, `normalizeProtectFingerprint`, `isValidProtectServerName`,
  `PROTECT_TLS_INSPECT_TIMEOUT_MS`, `PROTECT_MIN_VERSION` (Task 1).
- Produces:

```ts
// errors/protect-api.error.ts
export enum ProtectErrorCategory { VALIDATION = 'validation', UNREACHABLE = 'unreachable', TIMEOUT = 'timeout',
	TLS_UNTRUSTED = 'tls_untrusted', TLS_FINGERPRINT_MISMATCH = 'tls_fingerprint_mismatch',
	AUTHENTICATION = 'authentication', AUTHORIZATION = 'authorization', NOT_FOUND = 'not_found',
	BAD_REQUEST = 'bad_request', UNSUPPORTED = 'unsupported', RATE_LIMITED = 'rate_limited',
	UNAVAILABLE = 'unavailable', PROTOCOL = 'protocol', VERSION_UNSUPPORTED = 'version_unsupported', CANCELLED = 'cancelled' }
export type ProtectOperation = ProtectEndpoint | 'tls' | 'system'; // ProtectEndpoint from the constants (Task 1)
export class ProtectApiError extends Error {
	constructor(category: ProtectErrorCategory, operation: ProtectOperation, details?: { status?: number | null; retryAfterMs?: number | null });
	readonly category; readonly operation; readonly status: number | null; readonly retryAfterMs: number | null;
	readonly retryable: boolean; // TIMEOUT, UNREACHABLE, UNAVAILABLE, RATE_LIMITED, PROTOCOL
	// message: `UniFi Protect request '${operation}' failed (${category})`
}
export const PROTECT_ERROR_MESSAGES: Record<ProtectErrorCategory, string>;
export function toProtectApiError(error: unknown, operation: ProtectOperation): ProtectApiError; // maps Node codes

// client/protect-tls-policy.ts
export interface ProtectTlsSettings { mode: ProtectTlsMode; serverName: string | null; fingerprintSha256: string | null }
export interface ProtectTlsConnectPlan { servername: string | undefined; rejectUnauthorized: boolean; pinnedFingerprint: string | null }
export function planProtectTls(host: string, settings: ProtectTlsSettings): ProtectTlsConnectPlan; // throws ProtectApiError(VALIDATION, 'tls')
export function peerFingerprint(certificate: { fingerprint256?: string }): string | null; // normalized
export function fingerprintsEqual(a: string, b: string): boolean; // timingSafeEqual on normalized buffers

// client/protect-https-agent.ts
export interface ProtectAgentOptions { host: string; port: number; tls: ProtectTlsSettings; trustedCa?: string | Buffer; handshakeTimeoutMs?: number }
export class ProtectHttpsAgent extends https.Agent {
	constructor(options: ProtectAgentOptions);  // keepAlive true, maxSockets 4
	readonly plan: ProtectTlsConnectPlan;
	readonly lastPeerFingerprint: string | null;
	createConnection(options: tls.ConnectionOptions, callback: (error: Error | null, socket?: Duplex) => void): undefined;
}
export interface ProtectCertificateInfo { fingerprintSha256: string; subjectCommonName: string | null; issuerCommonName: string | null;
	subjectAltNames: string[]; validFrom: string; validTo: string; selfSigned: boolean; trusted: boolean; trustError: string | null }
export function inspectProtectCertificate(input: { host: string; port: number; serverName: string | null;
	trustedCa?: string | Buffer; timeoutMs?: number }): Promise<ProtectCertificateInfo>;

// test/support/protect-tls.ts
export const PROTECT_TEST_DIRECT_DOMAIN = 'fakeconsole.id.ui.direct';
export const PROTECT_TEST_TLS: { ca: string; console: { cert: string; key: string }; selfSigned: { cert: string; key: string };
	fingerprints: { console: string; selfSigned: string } }; // normalized, from new X509Certificate(pem).fingerprint256
export function protectTlsServerOptions(): https.ServerOptions; // SNICallback: servername === domain → console cert, else self-signed
```

Plan table (`planProtectTls`; `servername = settings.serverName ?? (isIP(host) ? undefined : host)` in every mode):

| mode | `rejectUnauthorized` | `pinnedFingerprint` |
|---|---|---|
| `verify` | `true` | `null` |
| `pinned` | `false` | normalized fingerprint (missing → `VALIDATION`) |

`createConnection` calls `tls.connect({ ...options, host, port, servername: plan.servername, rejectUnauthorized:
plan.rejectUnauthorized, ca: trustedCa })` and returns `undefined`; Node's `http.Agent` then waits for the callback
(`createSocket` uses the returned socket only when one is returned). On `secureConnect` it records the peer
fingerprint, compares it with `plan.pinnedFingerprint` when set, and calls `callback(null, socket)` or destroys the
socket and calls `callback(new ProtectApiError(TLS_FINGERPRINT_MISMATCH, 'tls'))`. Handshake errors with codes
`DEPTH_ZERO_SELF_SIGNED_CERT`, `SELF_SIGNED_CERT_IN_CHAIN`, `UNABLE_TO_VERIFY_LEAF_SIGNATURE`,
`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, `CERT_HAS_EXPIRED`, `ERR_TLS_CERT_ALTNAME_INVALID` map to `TLS_UNTRUSTED`;
`ECONNREFUSED`, `EHOSTUNREACH`, `ENETUNREACH`, `ENOTFOUND`, `EAI_AGAIN`, `ECONNRESET` to `UNREACHABLE`; the handshake
timer (`handshakeTimeoutMs`, default `PROTECT_TLS_INSPECT_TIMEOUT_MS`) to `TIMEOUT`. No request byte is written to a
socket before the callback succeeds. `inspectProtectCertificate` opens one TLS connection with
`rejectUnauthorized: false`, reads `getPeerCertificate()`, `authorized`, `authorizationError`, writes nothing and
destroys the socket; `trustError` is the Node error code or `null`.

`generate.sh` (OpenSSL ≥ 1.1.1, EC P-256, `-days 36500`): CA `CN=Smart Panel Test CA`
(`basicConstraints=critical,CA:TRUE`); leaf `CN=fakeconsole.id.ui.direct`, SAN `DNS:fakeconsole.id.ui.direct`,
`extendedKeyUsage=serverAuth`, signed by the CA; self-signed `CN=unifi.local`, SAN `DNS:unifi.local`. It deletes
`ca.key` and the CSR at the end; only the five listed files are committed. A header comment says the keys are test
material with no value outside the test suite.

- [ ] **Step 1: Generate the TLS material.** Run `sh apps/backend/test/fixtures/unifi-protect-tls/generate.sh`.
  Expected: the five files exist; `openssl verify -CAfile ca.crt console.crt` prints `console.crt: OK`.

- [ ] **Step 2: Write the failing tests.**

```ts
// errors/protect-api.error.spec.ts
it('has a fixed message per category and never includes details', () => {
	const e = new ProtectApiError(ProtectErrorCategory.AUTHENTICATION, 'meta/info', { status: 401 });
	expect(e.message).toBe("UniFi Protect request 'meta/info' failed (authentication)");
	expect(e.retryable).toBe(false);
	expect(Object.keys(PROTECT_ERROR_MESSAGES).sort()).toEqual(Object.values(ProtectErrorCategory).sort());
	expect(PROTECT_ERROR_MESSAGES.version_unsupported).toContain('7.2.105');
});
it.each([['ECONNREFUSED', 'unreachable'], ['DEPTH_ZERO_SELF_SIGNED_CERT', 'tls_untrusted'], ['ERR_TLS_CERT_ALTNAME_INVALID', 'tls_untrusted']])(
	'maps %s to %s', (code, category) => expect(toProtectApiError(Object.assign(new Error('x'), { code }), 'tls').category).toBe(category));

// client/protect-tls-policy.spec.ts
it.each([
	['verify', '10.0.0.2', null, { servername: undefined, rejectUnauthorized: true, pinnedFingerprint: null }],
	['verify', '10.0.0.2', 'abc.id.ui.direct', { servername: 'abc.id.ui.direct', rejectUnauthorized: true }],
	['verify', 'unvr.local', null, { servername: 'unvr.local' }],
])('plans %s for %s', (mode, host, serverName, expected) =>
	expect(planProtectTls(host, { mode, serverName, fingerprintSha256: null } as ProtectTlsSettings)).toMatchObject(expected));
it('requires a fingerprint in pinned mode', () =>
	expect(() => planProtectTls('10.0.0.2', { mode: 'pinned', serverName: null, fingerprintSha256: null })).toThrow(ProtectApiError));
it('compares fingerprints regardless of case and colons', () =>
	expect(fingerprintsEqual('AB:'.repeat(31) + 'AB', 'ab'.repeat(32))).toBe(true));

// client/protect-https-agent.spec.ts — https.createServer(protectTlsServerOptions()) on 127.0.0.1:0, counting
// 'secureConnection' sockets, request events and bytes received on each TLS socket
it('verify mode with the console domain as SNI trusts the CA-signed certificate', async () => {
	const agent = new ProtectHttpsAgent({ host: '127.0.0.1', port, tls: { mode: 'verify', serverName: PROTECT_TEST_DIRECT_DOMAIN, fingerprintSha256: null }, trustedCa: PROTECT_TEST_TLS.ca });
	expect((await get(agent)).status).toBe(200);
	expect(agent.lastPeerFingerprint).toBe(PROTECT_TEST_TLS.fingerprints.console);
});
it('verify mode by IP refuses the self-signed certificate before any byte is sent', async () => {
	await expect(get(agentFor({ mode: 'verify', serverName: null, fingerprintSha256: null }))).rejects.toMatchObject({ category: 'tls_untrusted' });
	expect(server.requests).toBe(0); expect(server.bytesReceived).toBe(0);
});
it('pinned mode accepts the matching self-signed certificate', async () => { /* fingerprint upper case with colons → 200 */ });
it('pinned mode refuses another certificate and sends no byte', async () => {
	await expect(get(agentFor({ mode: 'pinned', serverName: null, fingerprintSha256: PROTECT_TEST_TLS.fingerprints.console })))
		.rejects.toMatchObject({ category: 'tls_fingerprint_mismatch' });
	expect(server.bytesReceived).toBe(0);
});
it('reuses one verified socket for sequential requests', async () => { /* two GETs → one secureConnection */ });
it('times out a server that never completes the handshake', async () => {
	// net.createServer that accepts and stays silent; handshakeTimeoutMs 200 → category 'timeout' within 1 s
});
it('inspects both SNI variants without sending application data', async () => {
	const byIp = await inspectProtectCertificate({ host: '127.0.0.1', port, serverName: null });
	expect(byIp).toMatchObject({ subjectCommonName: 'unifi.local', selfSigned: true, trusted: false, fingerprintSha256: PROTECT_TEST_TLS.fingerprints.selfSigned });
	const byDomain = await inspectProtectCertificate({ host: '127.0.0.1', port, serverName: PROTECT_TEST_DIRECT_DOMAIN, trustedCa: PROTECT_TEST_TLS.ca });
	expect(byDomain).toMatchObject({ issuerCommonName: 'Smart Panel Test CA', trusted: true, trustError: null });
	expect(server.bytesReceived).toBe(0);
});
```

  `get(agent)` is a test helper doing `https.get({ host: '127.0.0.1', port, path: '/', agent, headers: { 'X-API-KEY': 'k' } })`.

- [ ] **Step 3: Run them.** `npx jest src/plugins/devices-unifi-protect/errors src/plugins/devices-unifi-protect/client/protect-tls-policy.spec.ts src/plugins/devices-unifi-protect/client/protect-https-agent.spec.ts`
  Expected: FAIL.

- [ ] **Step 4: Implement** the error module, the policy and the agent. If the "no byte is sent" assertions fail
  because Node writes before the callback, replace the agent override by opening and verifying the TLS socket first
  and passing it through the request option `createConnection: () => verifiedSocket`; the tests stay unchanged.

- [ ] **Step 5: Run them.** Same command. Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add apps/backend/src/plugins/devices-unifi-protect apps/backend/test/fixtures/unifi-protect-tls apps/backend/test/support/protect-tls.ts
git commit -m "feat(backend): add unifi protect tls policy with pinned certificates"
```

---

### Task 6: Protect Integration API client

**Files:**
- Create: `client/protect-api.types.ts`, `client/protect-endpoints.ts`, `client/protect-http.transport.ts`,
  `client/protect-api.client.ts`, `client/protect-console-system.ts`, `client/protect-api-client.factory.ts`
- Test: `client/protect-endpoints.spec.ts`, `client/protect-api.client.spec.ts`

**Interfaces:**
- Consumes: Task 4 (`ProtectRatePacer`, `parseRetryAfterMs`, `redactProtectText`), Task 5 (`ProtectApiError`,
  `toProtectApiError`, `ProtectTlsSettings`, `ProtectHttpsAgent`), Task 1 limits.
- Produces:

```ts
// client/protect-endpoints.ts (ProtectEndpoint and PROTECT_ENDPOINTS come from the constants, Task 1)
export const PROTECT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export function buildProtectPath(endpoint: ProtectEndpoint, params?: { id?: string; query?: Record<string, string> }): string;
// → `${PROTECT_INTEGRATION_BASE_PATH}/v1/<endpoint with {id} replaced>[?query]`; throws ProtectApiError(VALIDATION)
//   for an id outside PROTECT_ID_PATTERN and for any result containing 'disable-mic-permanently'

// client/protect-api.types.ts — every type keeps `raw: Record<string, unknown>` for Plan 5 mapping
export interface ProtectMetaInfo { applicationVersion: string }
export interface ProtectNvr { id: string; name: string | null; modelKey: string; mac: string | null; raw: Record<string, unknown> }
export interface ProtectCameraFeatureFlags { supportFullHdSnapshot: boolean; hasHdr: boolean; hasMic: boolean; hasSpeaker: boolean;
	hasLedStatus: boolean; smartDetectTypes: string[]; smartDetectAudioTypes: string[]; videoModes: string[] } // missing → false / []
export interface ProtectCamera { id: string; modelKey: string; state: string; name: string | null; type: string | null; mac: string | null;
	hasPackageCamera: boolean; featureFlags: ProtectCameraFeatureFlags; raw: Record<string, unknown> }
export interface ProtectSensor { id: string; modelKey: string; state: string; name: string | null; mac: string | null; raw: Record<string, unknown> }
export interface ProtectLight { id: string; modelKey: string; state: string; name: string | null; mac: string | null; cameraId: string | null; raw: Record<string, unknown> }
export interface ProtectRtspsStreams { high: string | null; medium: string | null; low: string | null; package: string | null } // SECRET values
export interface ProtectSnapshot { contentType: string; data: Buffer }
export interface ProtectConsoleSystem { name: string | null; mac: string | null; shortname: string | null; directConnectDomain: string | null; deviceState: string | null }

// client/protect-http.transport.ts
export interface ProtectTransportRequest { method: 'GET'; path: string; headers: Record<string, string>; timeoutMs: number; maxBytes: number; signal?: AbortSignal }
export interface ProtectTransportResponse { status: number; headers: ProtectHeaders; body: Buffer }
export interface ProtectTransport { request(request: ProtectTransportRequest): Promise<ProtectTransportResponse>; close(): void }
export class NodeProtectTransport implements ProtectTransport { constructor(options: { host: string; port: number; agent: https.Agent }) }
// one timer per request covers connect, headers and body; body > maxBytes → destroy, ProtectApiError(PROTOCOL)

// client/protect-api.client.ts
export interface ProtectApiClientOptions { host: string; port: number; apiKey: string; tls: ProtectTlsSettings;
	timeoutMs?: number; deadlineMs?: number; maxAttempts?: number;
	trustedCa?: string | Buffer;   // tests only (PROTECT_TRUSTED_CA)
	transport?: ProtectTransport;  // tests only; default NodeProtectTransport over a ProtectHttpsAgent
	pacer?: ProtectRatePacer; random?: () => number; sleep?: (ms: number, signal?: AbortSignal) => Promise<void> }
export interface ProtectCallOptions { signal?: AbortSignal }
export class ProtectApiClient {
	constructor(options: ProtectApiClientOptions);
	getMetaInfo(options?: ProtectCallOptions): Promise<ProtectMetaInfo>;
	getNvr(options?: ProtectCallOptions): Promise<ProtectNvr>;              // object, or first entry of an array
	listCameras(options?: ProtectCallOptions): Promise<ProtectCamera[]>;
	getCamera(cameraId: string, options?: ProtectCallOptions): Promise<ProtectCamera>;
	listSensors(options?: ProtectCallOptions): Promise<ProtectSensor[]>;
	listLights(options?: ProtectCallOptions): Promise<ProtectLight[]>;
	getRtspsStreams(cameraId: string, options?: ProtectCallOptions): Promise<ProtectRtspsStreams>;
	getSnapshot(cameraId: string, options?: ProtectCallOptions & { highQuality?: boolean; channel?: 'main' | 'package' }): Promise<ProtectSnapshot>;
	readonly peerFingerprint: string | null;
	close(): void; // in-flight and later calls reject with CANCELLED
}

// client/protect-console-system.ts
export function fetchProtectConsoleSystem(input: { host: string; port: number; timeoutMs?: number }): Promise<ProtectConsoleSystem>;
// GET /api/system, rejectUnauthorized false, no X-API-KEY, JSON cap 64 KiB, errors as ProtectApiError(…, 'system')

// client/protect-api-client.factory.ts
export const PROTECT_API_CLIENT_FACTORY = Symbol('PROTECT_API_CLIENT_FACTORY');
export const PROTECT_TRUSTED_CA = Symbol('PROTECT_TRUSTED_CA'); // provider value string | undefined, default undefined
export interface ProtectApiClientFactory { create(options: Omit<ProtectApiClientOptions, 'trustedCa' | 'transport'>): ProtectApiClient }
@Injectable() export class DefaultProtectApiClientFactory implements ProtectApiClientFactory {
	constructor(@Optional() @Inject(PROTECT_TRUSTED_CA) trustedCa?: string);
}
```

Request rules: headers `X-API-KEY: <key>` and `Accept: application/json` (`image/jpeg` for snapshots); the key goes
nowhere else. Status mapping: 400 → `BAD_REQUEST` (snapshot with body `name` `BAD_REQUEST` and `error` matching
`/full hd snapshot/i` → `UNSUPPORTED`), 401 → `AUTHENTICATION`, 403 → `AUTHORIZATION`, 404 → `NOT_FOUND`, 408 →
`TIMEOUT`, 429 → `RATE_LIMITED` (with `retryAfterMs`), 500/502/503/504 → `UNAVAILABLE`, other non-2xx and non-JSON
bodies → `PROTOCOL`; a snapshot whose `content-type` does not start with `image/` → `PROTOCOL`. Retry loop per call:
`pacer.acquire` → request → `pacer.observe(headers)`; a status in the endpoint's retry set (`[408, 429, 500, 502,
503, 504]`; snapshots `[408, 429]`) retries while attempts remain and the delay fits the deadline; the delay is
`Retry-After` when present, else `500 * 2^(attempt-1)` × (0.8 + random × 0.4); a 429 also calls
`pacer.backOff(delay)`; `ECONNRESET` on the first attempt is retried once (stale keep-alive socket); TLS, auth and
validation failures never retry. Lists drop entries without a string `id` and `modelKey` and log the dropped count at
debug. Log lines (debug) are `GET <endpoint template> <status> <ms>ms`, passed through `redactProtectText` with
`[apiKey]`.

- [ ] **Step 1: Write the failing tests.** Fake transport records requests and answers from a queue; fake clock.

```ts
// protect-endpoints.spec.ts
it.each([
	['meta/info', {}, '/proxy/protect/integration/v1/meta/info'],
	['cameras/{id}/snapshot', { id: '6541', query: { highQuality: 'false', channel: 'main' } }, '/proxy/protect/integration/v1/cameras/6541/snapshot?highQuality=false&channel=main'],
])('builds %s', (endpoint, params, path) => expect(buildProtectPath(endpoint as ProtectEndpoint, params)).toBe(path));
it.each(['', 'a/b', '../disable-mic-permanently', 'x'.repeat(65), 'a b'])('refuses the id %p', (id) =>
	expect(() => buildProtectPath('cameras/{id}', { id })).toThrow(ProtectApiError));

// protect-api.client.spec.ts
const KEY = 'PROTECT_SENTINEL_KEY_7f3a9c0d1e2b4a6f';
it('sends the key only as X-API-KEY and parses meta/info', async () => {
	queue(200, fixture('meta-info.json'));
	expect(await client.getMetaInfo()).toEqual({ applicationVersion: '7.3.74' });
	expect(transport.requests[0]).toMatchObject({ method: 'GET', path: '/proxy/protect/integration/v1/meta/info', headers: { 'X-API-KEY': KEY } });
});
it('no client method can reach disable-mic-permanently and every request is a GET', async () => {
	const methods = Object.getOwnPropertyNames(ProtectApiClient.prototype).filter((n) => !['constructor', 'close'].includes(n)
		&& typeof (ProtectApiClient.prototype as Record<string, unknown>)[n] === 'function');
	for (const name of methods) { queue(200, '{}'); await (client as any)[name]('6541').catch(() => undefined); }
	expect(methods.length).toBeGreaterThanOrEqual(8);
	expect(transport.requests.every((r) => r.method === 'GET' && !r.path.includes('disable-mic-permanently'))).toBe(true);
});
it('parses the fixtures', async () => {
	// nvrs.json (object) → id/name/mac; cameras.json → 2 cameras, featureFlags.supportFullHdSnapshot false,
	// smartDetectTypes ['person','vehicle','animal']; rtsps-stream.json → medium/low/package null;
	// sensors.json and lights.json → all synthetic entries parsed; snapshot.jpg → contentType 'image/jpeg'
});
it('accepts an nvrs array by taking the first entry', async () => { /* [nvr] → nvr */ });
it('drops list entries without id or modelKey', async () => { /* [{ id: 'a' }, cam] → [cam] */ });
it('retries a 429 after Retry-After and succeeds', async () => {
	queue(429, '{}', fixture('rate-limit-headers.json').rate_limited); queue(200, fixture('cameras.json'));
	await client.listCameras(); expect(sleep).toHaveBeenCalledWith(1000, undefined); expect(transport.requests).toHaveLength(2);
});
it('retries 502, 503 and 504 for lists and gives up after three attempts', async () => {
	queue(502); queue(503); queue(504);
	await expect(client.listCameras()).rejects.toMatchObject({ category: 'unavailable', status: 504 });
	expect(transport.requests).toHaveLength(3);
});
it('does not retry a snapshot 503 and reports the camera unavailable', async () => { /* one request; category 'unavailable' */ });
it('maps the full-HD snapshot 400 to unsupported', async () => {
	queue(400, fixture('snapshot-hq-unsupported.json'));
	await expect(client.getSnapshot('6541', { highQuality: true })).rejects.toMatchObject({ category: 'unsupported' });
	expect(transport.requests[0].path).toContain('highQuality=true');
});
it.each([[401, 'authentication'], [403, 'authorization'], [404, 'not_found']])('maps %d to %s without retry', async (status, category) => { /* one request */ });
it('fails fast when Retry-After exceeds the remaining deadline', async () => { /* 429 Retry-After 60 → rate_limited, retryAfterMs 60000, one request */ });
it('rejects a non-JSON body as protocol', async () => { /* '<html>' */ });
it('close() cancels in-flight and later calls', async () => { /* category 'cancelled' */ });
it('never puts the key or a stream alias into errors or log lines', async () => {
	// spy Logger.prototype; rtsps-stream answer with 'rtsps://127.0.0.1:7441/SENTINELALIASprotect0123456789?enableSrtp';
	// then a 500 whose body echoes the key; collect JSON.stringify([log calls, caught errors, String(errors)])
	expect(emitted).not.toContain(KEY); expect(emitted).not.toContain('SENTINELALIAS');
});
```

- [ ] **Step 2: Run them.** `npx jest src/plugins/devices-unifi-protect/client/protect-endpoints.spec.ts src/plugins/devices-unifi-protect/client/protect-api.client.spec.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement** the six files. Register `DefaultProtectApiClientFactory` and `{ provide:
  PROTECT_API_CLIENT_FACTORY, useExisting: DefaultProtectApiClientFactory }` in the plugin module (Homey's
  `devices-homey.plugin.ts:86-90` pattern); `PROTECT_TRUSTED_CA` has no provider in production.

- [ ] **Step 4: Run them.** Same command plus `npx jest src/plugins/devices-unifi-protect`. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): add the unifi protect integration api client"
```

---

### Task 7: Fake Protect console and client integration tests

**Files:**
- Create: `test/support/fake-protect-server.ts`, `client/protect-api.client.integration.spec.ts`

**Interfaces:**
- Consumes: Task 5 `protectTlsServerOptions`, `PROTECT_TEST_TLS`, `PROTECT_TEST_DIRECT_DOMAIN`; Task 6 client and
  `fetchProtectConsoleSystem`; fixtures listed in Global Constraints.
- Produces (Plan 5 adds the two WebSockets to this file):

```ts
export const FAKE_PROTECT_API_KEY = 'PROTECT_SENTINEL_KEY_7f3a9c0d1e2b4a6f';
export const FAKE_PROTECT_ALIAS = 'SENTINELALIASprotect0123456789';
export interface FakeProtectRequest { method: string; path: string; query: Record<string, string>; hadApiKey: boolean; servername: string | null }
export interface FakeProtectResponse { status: number; headers?: Record<string, string>; body?: string | Buffer }
export interface FakeProtectServerOptions { apiKey: string; applicationVersion: string | null; rateLimit: { quota: number; windowSeconds: number } | null; hangPaths: RegExp[] }
export class FakeProtectServer {
	static start(options?: Partial<FakeProtectServerOptions>): Promise<FakeProtectServer>; // 127.0.0.1, port 0
	readonly host: '127.0.0.1'; readonly port: number;
	readonly requests: FakeProtectRequest[]; readonly writes: FakeProtectRequest[]; forbiddenHits: number; rateLimited: number;
	set(options: Partial<FakeProtectServerOptions>): void;   // applicationVersion null → serve meta-info.json as captured
	enqueue(match: RegExp, response: FakeProtectResponse): void; // consumed once, before normal routing
	reset(): void; stop(): Promise<void>;
}
```

Routing: TLS from `protectTlsServerOptions()`. `GET /api/system` (no auth) → `system.json` with `directConnectDomain`
replaced by `PROTECT_TEST_DIRECT_DOMAIN`. `GET /proxy/protect/api` → 401. Under `/proxy/protect/integration/v1/`:
`meta/info`, `nvrs`, `cameras`, `cameras/:id`, `cameras/:id/rtsps-stream` (`rtsps-stream.json` with the redacted
alias replaced by `FAKE_PROTECT_ALIAS` and the host by `127.0.0.1`), `cameras/:id/snapshot` (`snapshot.jpg`;
`highQuality=true` for a camera whose `supportFullHdSnapshot` is false → 400 with `snapshot-hq-unsupported.json`),
`sensors`, `lights`, `chimes`; unknown → 404 `{"error":"Not found","name":"NOT_FOUND"}` (synthetic). Missing or wrong
`X-API-KEY` → 401 `{"error":"Unauthorized","name":"UNAUTHORIZED"}` (synthetic). Any method other than GET → 405 and
recorded in `writes`; a path containing `disable-mic-permanently` increments `forbiddenHits`. Every response carries
`RateLimit-Policy` and `RateLimit` in the format of `rate-limit-headers.json`; with `rateLimit` set (default 10 / 1 s)
a sliding window per key answers 429 with `Retry-After: 1` and `r=0; t=1` past the quota, counted in `rateLimited`.
A path matching `hangPaths` sends headers and then never ends the body.

- [ ] **Step 1: Write the fake server and the failing integration tests.** Real timers; the client in pinned mode
  with `PROTECT_TEST_TLS.fingerprints.selfSigned`.

```ts
it('reads every endpoint the client offers', async () => {
	expect((await client.getMetaInfo()).applicationVersion).toBe('7.3.74');
	expect((await client.listCameras())).toHaveLength(2);
	const streams = await client.getRtspsStreams(cameraId);
	expect(streams.high).toContain(`:7441/${FAKE_PROTECT_ALIAS}`); expect(streams.medium).toBeNull();
	expect((await client.getSnapshot(cameraId)).contentType).toBe('image/jpeg');
	await expect(client.getSnapshot(cameraId, { highQuality: true })).rejects.toMatchObject({ category: 'unsupported' });
	expect([fake.writes.length, fake.forbiddenHits]).toEqual([0, 0]);
});
it('the fake enforces 10-in-1sec like the console', async () => {
	// 15 parallel raw https GETs with the key → 10 × 200 and 5 × 429 (matches the spike)
});
it('15 parallel reads through one client produce no 429', async () => { // Review Focus 3
	const results = await Promise.allSettled(Array.from({ length: 15 }, () => client.getCamera(cameraId)));
	expect(results.every((r) => r.status === 'fulfilled')).toBe(true); expect(fake.rateLimited).toBe(0);
});
it('recovers from an injected 429 using Retry-After', async () => { /* enqueue 429 Retry-After 1 → resolved, elapsed ≥ 1000 ms */ });
it('ends a hung snapshot within its timeout', async () => { // Review Focus 4
	fake.set({ hangPaths: [/snapshot/] }); const started = Date.now();
	await expect(timeoutClient.getSnapshot(cameraId)).rejects.toMatchObject({ category: 'timeout' }); // timeoutMs 500, maxAttempts 1
	expect(Date.now() - started).toBeLessThan(2000);
});
it('cuts off an oversized body as protocol', async () => { // Review Focus 4
	fake.enqueue(/meta\/info/, { status: 200, headers: { 'content-type': 'application/json' }, body: Buffer.alloc(3 * 1024 * 1024, 0x20) });
	await expect(client.getMetaInfo()).rejects.toMatchObject({ category: 'protocol' });
});
it('reports a wrong key as authentication', async () => { /* other client key → 'authentication' */ });
it('fetches the console system without the key', async () => {
	const system = await fetchProtectConsoleSystem({ host: fake.host, port: fake.port });
	expect(system.directConnectDomain).toBe(PROTECT_TEST_DIRECT_DOMAIN);
	expect(fake.requests.find((r) => r.path === '/api/system')?.hadApiKey).toBe(false);
});
```

- [ ] **Step 2: Run them.** `npx jest src/plugins/devices-unifi-protect/client/protect-api.client.integration.spec.ts`
  Expected: PASS (Task 6 is in place, so this run is the verification). Run the self-test first on its own
  (`-t 'enforces 10-in-1sec'`); when it passes and another case fails, fix the client, not the fake.

- [ ] **Step 3: Commit.**

```bash
git add apps/backend/test/support/fake-protect-server.ts apps/backend/src/plugins/devices-unifi-protect/client
git commit -m "test(backend): add a fake unifi protect console from spike fixtures"
```

---

### Task 8: Connector service, status model and status route

**Files:**
- Create: `services/protect-reconnect-backoff.ts`, `services/protect-connector.service.ts`, `models/status.model.ts`,
  `controllers/protect-status.controller.ts`
- Modify: `devices-unifi-protect.plugin.ts` (providers, controller, `managedServiceManager.register(this.connector)`,
  factory reset at priority 90 as `devices-homey.plugin.ts:138-150`), `devices-unifi-protect.openapi.ts`,
  `src/modules/extensions/services/managed-service-registration.inventory.spec.ts:17` (row after Homey) and `:71`
  (`23` → `24`)
- Test: `services/protect-reconnect-backoff.spec.ts`, `services/protect-connector.service.spec.ts`,
  `controllers/protect-status.controller.spec.ts`, `devices-unifi-protect.plugin.spec.ts` (extend)

Patterns: managed service shape `plugins/devices-homey/services/homey.service.ts:71-76` (owner, serviceId),
`:135-224` (start/stop under `withLock`, generation counter), `:226-242` (`onConfigChanged`),
`modules/extensions/services/base-managed-extension.service.ts:1-37`; backoff
`plugins/devices-homey/services/homey-reconnect-backoff.ts:8-22`; status model `plugins/devices-homey/models/status.model.ts`;
controller `plugins/devices-homey/controllers/homey-status.controller.ts:14-35`.

**Interfaces:**
- Consumes: Task 6 `ProtectApiClientFactory`, `PROTECT_API_CLIENT_FACTORY`, `ProtectApiClient`; Task 4
  `isSupportedProtectVersion`; Task 5 `ProtectApiError`, `PROTECT_ERROR_MESSAGES`; Task 1 config and constants.
- Produces:

```ts
export function calculateProtectReconnectDelay(attempt: number, randomValue?: number): number;

@Injectable()
export class ProtectConnectorService extends BaseManagedExtensionService {
	readonly owner = { kind: 'plugin', type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME } as const;
	readonly serviceId = DEVICES_UNIFI_PROTECT_CONNECTOR_SERVICE_ID;
	constructor(configService: ConfigService, @Inject(PROTECT_API_CLIENT_FACTORY) clientFactory: ProtectApiClientFactory);
	start(): Promise<void>;   // state 'started', schedules attempt; never throws for console outcomes
	stop(): Promise<void>;    // generation += 1, closes client, clears timers
	onConfigChanged(): Promise<ConfigChangeResult>;
	isHealthy(): Promise<boolean>; // started && CONNECTED
	getStatus(): ProtectStatusModel;
	getClient(): ProtectApiClient | null; // non-null only while CONNECTED; Plan 5 consumers
	settle(): Promise<void>;  // resolves when the current attempt or health check finished (tests, e2e)
}

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataStatus' })
export class ProtectStatusModel {
	serviceState: ServiceState; connectionState: ProtectConnectionState; enabled: boolean; configured: boolean; healthy: boolean;
	host: string | null; tlsMode: ProtectTlsMode; warnings: string[]; applicationVersion: string | null; minimumVersion: string;
	nvrId: string | null; nvrName: string | null; lastConnectedAt: string | null; lastErrorCategory: ProtectErrorCategory | null;
	lastError: string | null; reconnectAttempt: number; nextRetryAt: string | null;
}
// wire: service_state, connection_state, enabled, configured, healthy, host, tls_mode, warnings, application_version,
//       minimum_version, nvr_id, nvr_name, last_connected_at, last_error_category, last_error, reconnect_attempt, next_retry_at
@ApiSchema({ name: 'DevicesUnifiProtectPluginResStatus' })
export class ProtectStatusResponseModel extends BaseSuccessResponseModel<ProtectStatusModel> {}
// GET status: operationId 'get-devices-unifi-protect-plugin-status', roles OWNER, ADMIN, USER
```

Attempt and outcome table (`lastError` is always `PROTECT_ERROR_MESSAGES[category]`):

| Attempt result | `connection_state` | Next |
|---|---|---|
| not configured (no host or key) | `disconnected` | none |
| `getMetaInfo` + `getNvr` succeed, version supported | `connected`, `reconnect_attempt` 0 | health check in 60 s |
| version unsupported or unparsable | `version_unsupported` | none until config change |
| `authentication` / `authorization` | `auth_failed` | none |
| `tls_untrusted`, `tls_fingerprint_mismatch`, `validation`, `not_found` | `error` | none |
| `unreachable`, `timeout`, `unavailable`, `rate_limited`, `protocol` | `disconnected`, `next_retry_at` set | reconnect after `calculateProtectReconnectDelay(attempt)`, `connecting` while it runs |
| health check fails retryably | `disconnected` | reconnect, client closed |
| health check sees an unsupported version | `version_unsupported` | none |

Every continuation checks its captured generation; a mismatch closes the client it created and returns. There is no
insecure mode, so the connector has no TLS warning. `onConfigChanged` returns `restartRequired: true` when `host`,
`port`, `apiKey`, `tls.mode`, `tls.serverName` or `tls.fingerprintSha256` changed and the service is started; other
fields never restart. Log lines: `UniFi Protect connected (Protect <version>)`, `UniFi Protect connection failed
(<category>); retry in <ms> ms`, `UniFi Protect connection stopped (<category>)`.

- [ ] **Step 1: Write the failing tests.** Fake client factory returns scripted clients; Jest fake timers.

```ts
// protect-reconnect-backoff.spec.ts
it('doubles from 1 s and caps at 60 s', () =>
	expect([0, 1, 2, 3, 4, 5, 6, 7].map((a) => calculateProtectReconnectDelay(a, 0.5))).toEqual([1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000]));
it('applies ±20 % jitter and never exceeds the cap', () => {
	expect(calculateProtectReconnectDelay(0, 0)).toBe(800); expect(calculateProtectReconnectDelay(10, 1)).toBe(60000);
});

// protect-connector.service.spec.ts
it('connects, gates the version and reports the NVR', async () => {
	await service.start(); await service.settle();
	expect(service.getStatus()).toMatchObject({ connectionState: 'connected', applicationVersion: '7.3.74', minimumVersion: '7.2.105', healthy: true });
	expect(service.getClient()).not.toBeNull();
});
it('reports version_unsupported for 7.2.104 and schedules nothing', async () => { /* jest.getTimerCount() === 0; getClient() null */ });
it.each([['authentication', 'auth_failed'], ['tls_untrusted', 'error'], ['tls_fingerprint_mismatch', 'error']])(
	'stops retrying after %s', async (category, state) => { /* state; no timer; start() resolved */ });
it('retries an unreachable console with growing delays and recovers', async () => {
	// unreachable ×2 then success; advance 1000 then 2000 (random 0.5) → connected, reconnect_attempt 0
});
it('never throws from start for console outcomes and keeps the service started', async () => { /* each category */ });
it('discards a superseded attempt and closes its client', async () => { // Review Focus 5
	// first client's getMetaInfo is a deferred; stop() then start() with a new key; resolve the first deferred
	expect(firstClient.close).toHaveBeenCalled(); expect(factory.create).toHaveBeenLastCalledWith(expect.objectContaining({ apiKey: 'new' }));
	expect(service.getClient()).toBe(secondClient);
});
it('re-gates the version on the 60 s health check', async () => { /* connected; next meta/info '7.2.0' → version_unsupported, client closed */ });
it('moves to disconnected and reconnects when the health check fails', async () => { /* … */ });
it.each([['host', true], ['port', true], ['apiKey', true], ['tls.mode', true], ['tls.serverName', true], ['tls.fingerprintSha256', true],
	['snapshotMinIntervalMs', false], ['pollIntervalMs', false], ['defaultStreamQuality', false], ['streamHostOverride', false]])(
	'onConfigChanged for %s requires restart: %s', async (field, expected) => { /* … */ });
it('stop closes the client and clears every timer', async () => { /* jest.getTimerCount() === 0 */ });
it('keeps the key out of status and logs', async () => {
	// key PROTECT_SENTINEL_KEY_…; failing client throws new Error(`boom ${KEY}`)
	expect(JSON.stringify([service.getStatus(), logCalls])).not.toContain('PROTECT_SENTINEL_KEY');
});

// protect-status.controller.spec.ts
it('wraps the connector status in the response model', () => { /* response.data === connector.getStatus() result */ });

// devices-unifi-protect.plugin.spec.ts (extend)
it('registers the connector as a managed service and a factory-reset handler', () => { /* register(connector); factoryReset.register(name, fn, 90) */ });
```

  Inventory spec: add `['plugins/devices-unifi-protect/devices-unifi-protect.plugin.ts',
  'this.managedServiceManager.register(this.protectConnectorService)']` and change the count to `24`.

- [ ] **Step 2: Run them.** `npx jest src/plugins/devices-unifi-protect src/modules/extensions/services/managed-service-registration.inventory.spec.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement** backoff, connector, status model and controller; register them; append the two status
  classes to the swagger list.

- [ ] **Step 4: Run them.** Same command. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/backend/src/plugins/devices-unifi-protect apps/backend/src/modules/extensions/services/managed-service-registration.inventory.spec.ts
git commit -m "feat(backend): add the unifi protect connector service and status route"
```

---

### Task 9: Test-connection, end-to-end coverage and PR body

**Files:**
- Create: `dto/test-connection.dto.ts`, `models/test-connection.model.ts`, `services/protect-connection-test.service.ts`,
  `controllers/protect-test-connection.controller.ts`, `test/devices-unifi-protect.e2e-spec.ts`
- Modify: `devices-unifi-protect.plugin.ts` (provider, controller), `devices-unifi-protect.openapi.ts`,
  `tasks/epics/EPIC-UNIFI-PROTECT.md:100` (`UP-5` → `UP-5 (done)`)
- Test: `dto/test-connection.dto.spec.ts`, `services/protect-connection-test.service.spec.ts`,
  `controllers/protect-test-connection.controller.spec.ts`, the e2e file

Patterns: discriminated saved/candidate request `plugins/devices-homey/dto/test-connection.dto.ts:8-126`; service
`plugins/devices-homey/services/homey-connection-test.service.ts:35-147`; model
`plugins/devices-homey/models/test-connection.model.ts:10-63`; controller
`plugins/devices-homey/controllers/homey-test-connection.controller.ts:16-40`; e2e boot, auth and log spies
`test/cameras.e2e-spec.ts:92-211, 366-385`; `FB_CONFIG_PATH` temp directory `test/cameras-live.e2e-spec.ts:264-268`;
provider override `test/wled-adoption.e2e-spec.ts:46`; plugin config route `PATCH
/api/v1/modules/config/config/plugin/:plugin` (`modules/config/controllers/config.controller.ts:44, 101, 125`);
managed services `GET /api/v1/modules/extensions/services` (`modules/extensions/controllers/services.controller.ts:22, 34`).

**Interfaces:**
- Consumes: Tasks 5, 6, 8.
- Produces:

```ts
export enum ProtectTestConnectionMode { SAVED = 'saved', CANDIDATE = 'candidate' }
@ApiSchema({ name: 'DevicesUnifiProtectPluginTestSavedConnection' }) export class ProtectTestSavedConnectionDto { mode: 'saved' }
@ApiSchema({ name: 'DevicesUnifiProtectPluginTestCandidateConnectionTls' }) export class ProtectTestTlsDto {
	mode: ProtectTlsMode; serverName?: string | null; fingerprintSha256?: string | null } // same validators as Task 1
@ApiSchema({ name: 'DevicesUnifiProtectPluginTestCandidateConnection' }) export class ProtectTestCandidateConnectionDto {
	mode: 'candidate'; host: string; port?: number /* 443 */; apiKey: string /* required, write-only */; tls?: ProtectTestTlsDto /* default verify */ }
@ApiSchema({ name: 'DevicesUnifiProtectPluginReqTestConnection' }) export class ProtectTestConnectionRequestDto {
	data: ProtectTestSavedConnectionDto | ProtectTestCandidateConnectionDto }

@ApiSchema({ name: 'DevicesUnifiProtectPluginDataCertificate' }) export class ProtectCertificateModel {
	fingerprintSha256; subjectCommonName; issuerCommonName; subjectAltNames; validFrom; validTo; selfSigned; trusted }
@ApiSchema({ name: 'DevicesUnifiProtectPluginDataTestConnection' }) export class ProtectTestConnectionModel {
	mode; success: boolean; tlsMode: ProtectTlsMode | null; certificate: ProtectCertificateModel | null;
	directConnectDomain: string | null; consoleName: string | null; consoleModel: string | null;
	applicationVersion: string | null; minimumVersion: string; versionSupported: boolean | null; nvrName: string | null;
	warnings: string[]; errorCategory: ProtectErrorCategory | null; error: string | null }
@ApiSchema({ name: 'DevicesUnifiProtectPluginResTestConnection' })
export class ProtectTestConnectionResponseModel extends BaseSuccessResponseModel<ProtectTestConnectionModel> {}

@Injectable() export class ProtectConnectionTestService {
	constructor(configService: ConfigService, @Inject(PROTECT_API_CLIENT_FACTORY) factory: ProtectApiClientFactory,
		@Optional() @Inject(PROTECT_TRUSTED_CA) trustedCa?: string);
	testConnection(request: ProtectTestSavedConnectionDto | ProtectTestCandidateConnectionDto): Promise<ProtectTestConnectionModel>; // never throws
}
// POST test-connection: operationId 'test-devices-unifi-protect-plugin-connection', HttpCode 200, roles OWNER, ADMIN
```

Sequence (every failure stops and fills `errorCategory` / `error` from `PROTECT_ERROR_MESSAGES`):

1. Resolve settings: `saved` reads the stored config and rejects extra keys (`validation`); `candidate` uses only the
   submitted host, port, key and TLS (the stored key is never used).
2. `inspectProtectCertificate` (with `serverName`, `trustedCa`) → `certificate`.
3. `fetchProtectConsoleSystem` (no key; failures ignored) → `directConnectDomain`, `consoleName`,
   `consoleModel` (`hardware.shortname`).
4. TLS decision without sending the key: `verify` needs `certificate.trusted` (else `tls_untrusted`); `pinned` needs
   `fingerprintsEqual` (else `tls_fingerprint_mismatch`). The presented fingerprint is always returned, so a console without a usable domain can be pinned.
5. Client from the factory: `getMetaInfo` → `applicationVersion`, `versionSupported`; unsupported → stop with
   `version_unsupported`; then `getNvr` → `nvrName`; `success = true`; the client is closed in `finally`.

- [ ] **Step 1: Write the failing unit tests.**

```ts
// dto/test-connection.dto.spec.ts
it('requires a new key in candidate mode', async () => { /* candidate without api_key → error on api_key */ });
it('normalizes the candidate fingerprint', async () => { /* 'AB:…' → 'ab…' */ });

// services/protect-connection-test.service.spec.ts (fake factory; inspect/fetch mocked via jest.mock of their modules)
it('never pairs the stored key with a submitted host', async () => {
	// saved config has key STORED; request { mode: 'saved', host: 'evil' } → validation, factory never called
	// request { mode: 'candidate', host: 'evil', api_key: 'new' } → factory called with apiKey 'new'
});
it('stops before the key is used when verify mode sees an untrusted certificate', async () => { // Review Focus 1
	// inspect → trusted false; system → directConnectDomain 'x.id.ui.direct'
	expect(result).toMatchObject({ success: false, errorCategory: 'tls_untrusted', directConnectDomain: 'x.id.ui.direct',
		certificate: expect.objectContaining({ selfSigned: true }) });
	expect(factory.create).not.toHaveBeenCalled();
});
it('reports version_unsupported with the observed version', async () => { /* '7.2.104' → versionSupported false */ });
it('closes the client even when a call fails', async () => { /* close called once */ });
```

- [ ] **Step 2: Run them.** `npx jest src/plugins/devices-unifi-protect` Expected: FAIL on the new specs.

- [ ] **Step 3: Implement** DTO, model, service and controller; register them; append the new classes to the
  swagger list.

- [ ] **Step 4: Run them.** Same command. Expected: PASS.

- [ ] **Step 5: Write the e2e test.** Boot as `test/cameras.e2e-spec.ts:92-211` with `pluginExtensions: []` and
  `.overrideProvider(PROTECT_TRUSTED_CA).useValue(PROTECT_TEST_TLS.ca)`; `FB_CONFIG_PATH` = a fresh temp directory set
  before compiling; one `FakeProtectServer` for the suite (`fake.reset()` between cases); spies on
  `Logger.prototype` (`log`, `warn`, `error`, `debug`, `verbose`) and `EventEmitter2.prototype.emit` for the whole
  suite. Base `/api/v1/plugins/devices-unifi-protect`. Poll `GET status` every 100 ms up to 5 s where a state is awaited.

| Case | Expectation |
|---|---|
| `GET status` as user before configuration | 200, `enabled: false`, `configured: false`, `connection_state: 'disconnected'`, `minimum_version: '7.2.105'` |
| `POST test-connection` candidate, host `127.0.0.1`, default TLS | `success: false`, `error_category: 'tls_untrusted'`, `certificate.fingerprint_sha256` = self-signed fingerprint, `direct_connect_domain: 'fakeconsole.id.ui.direct'`; `fake.requests.filter((r) => r.hadApiKey)` is empty |
| candidate, `tls: { mode: 'verify', server_name: 'fakeconsole.id.ui.direct' }` | `success: true`, `certificate.trusted: true`, `application_version: '7.3.74'`, `version_supported: true`, `nvr_name` = `nvrs.json` name |
| candidate, `pinned` with the self-signed fingerprint | `success: true` |
| candidate, `pinned` with the console fingerprint | `error_category: 'tls_fingerprint_mismatch'`; no request with the key |
| candidate with a wrong key | `error_category: 'authentication'` |
| `fake.set({ applicationVersion: '7.2.104' })`, candidate pinned | `error_category: 'version_unsupported'`, `version_supported: false` |
| `PATCH` config `{ tls: { mode: 'insecure' } }` (or any unknown mode) | 400, config unchanged |
| saved mode with an extra `host` field | 400 (validation pipe, `forbidNonWhitelisted`), no fake request |
| saved mode before a key is stored | `error_category: 'validation'` |
| `POST test-connection` as a user-role token | 403 |
| `PATCH` config `{ enabled: true, host: '127.0.0.1', port, api_key: FAKE_PROTECT_API_KEY, tls: { mode: 'pinned', fingerprint_sha256: <self-signed, colon form> } }` | 200; `GET` config has `api_key_configured: true`, no `api_key`, normalized fingerprint; status becomes `connected` with `nvr_name`, `warnings: []` |
| `fake.set({ applicationVersion: '7.2.104' })`, `PATCH` as above | status `version_unsupported`, `warnings: []` |
| `PATCH` `api_key: 'wrong-key-0000'` | status `auth_failed`; the `meta/info` request count does not grow over the next 3 s |
| `PATCH` the correct key and `port` = a closed local port (bind and close a `net` server to get one) | status `disconnected`, `last_error_category: 'unreachable'`, `next_retry_at` set |
| `GET /api/v1/modules/extensions/services` | the connector entry has no `lastError` containing the sentinel |
| whole suite | log calls, emitted event payloads and every response body/header contain neither `PROTECT_SENTINEL_KEY` nor `SENTINELALIAS`; `fake.writes` empty; `fake.forbiddenHits` 0; of the files under `FB_CONFIG_PATH`, only `config.yaml` contains the key |

  The rows run in table order inside one `describe`; the closed-port row runs last.

- [ ] **Step 6: Run it.** `npx jest --config ./test/jest-e2e.json test/devices-unifi-protect.e2e-spec.ts` Expected: PASS.

- [ ] **Step 7: Run every gate.**

```bash
pnpm run lint:js
pnpm run test:unit
pnpm run test:e2e
pnpm run generate:openapi
pnpm --filter ./apps/admin run test:unit
```

  Expected: all PASS; `git status` shows no generated file.

- [ ] **Step 8: Manual check against the real console** (not in CI; needs the maintainer's console and a key in the
  environment, never in a file in the repository). From `apps/backend`, a throwaway script in the session scratchpad
  that constructs `ProtectApiClient` three times — `verify` with `server_name` = the console's `directConnectDomain`,
  `pinned` with the IP certificate's fingerprint — and calls `getMetaInfo`, `getNvr`, `listCameras`.
  Record in the PR body only: Protect version, which modes succeeded, whether the console accepted `Host: <ip>` with
  SNI = the domain, and the observed request spacing. A failure of `verify` with the domain blocks the PR until the TLS
  decision is revisited.

- [ ] **Step 9: Tick UP-5** in `tasks/epics/EPIC-UNIFI-PROTECT.md:100` and commit.

```bash
git add apps/backend tasks/epics/EPIC-UNIFI-PROTECT.md
git commit -m "feat(backend): test unifi protect connections and cover the plugin end to end"
```

- [ ] **Step 10: Write the PR body to a file; do not push.** Write it to the executing session's scratchpad as
  `pr-body-up5.md` (never inside the repository). Title `feat(backend): add UniFi Protect plugin foundation and API
  client`. The body states: what the plugin does now (configuration, read-only client, connector, status,
  test-connection) and that it is disabled by default and reads only; the three TLS modes and why `verify` with the
  console domain is the default (spike); that the domain is suggested by test-connection and saved by the admin, never
  learned silently; that candidate tests require a new key; the rate pacing values; that the client never builds
  `disable-mic-permanently` and is GET-only until Plan 5; migration 060 and the trigger rebuild; the inventory count 24;
  the deviations listed in "Decisions made in this plan" (TLS config shape vs. #1181, connector never throws, `nvrs`
  object); the manual-check results of Step 8; that no generated file is committed (A11); and ends with
  `Closes #1181`. Report the file path and the branch name to the controller; pushing and opening the PR are the
  controller's step.

---

## Self-review

- **Spec coverage.** Issue #1181 acceptance: identifiers and child entities with the four columns (Tasks 1–3);
  config fields, `secretFields`, `api_key_configured`, readiness validator (Task 1; `tls.verify` replaced by
  `tls.mode`, see Decisions); client with `X-API-KEY`, two TLS modes (`verify`, `pinned`; no insecure mode), 80 % pacing,
  retries honouring `Retry-After`, timeouts, typed errors, redaction (Tasks 4–6, warning in Task 8); version gate ⇒
  `version_unsupported` (Tasks 4, 8, 9); connector with generation counter and backoff, `GET status`, `POST
  test-connection` with saved or candidate credentials returning the fingerprint (Tasks 8, 9); never calls
  `disable-mic-permanently` (Tasks 6, 7, 9); unit and e2e tests against a fixture-built fake (Tasks 7, 9). Roadmap
  steps 1–7 map to Tasks 3, 2, 1, 4–5, 6, 7, 8–9. Design §16 unit list for this scope (version gate, rate pacer, TLS
  policy, redaction) is covered; URL conversion belongs to UP-10. Secret rule with planted sentinels: Tasks 1, 4, 6, 8, 9.
- **Step scan.** Every code step names files, signatures and pinned values; bodies appear only for the pacer
  algorithm and the TLS plan table, which the signatures do not determine. The fallback in Task 5 Step 4 is a
  conditional with fixed tests, not an open choice.
- **Type consistency.** `ProtectTlsSettings` (Task 5) matches `ProtectTlsConfigModel` field names (Task 1);
  `ProtectEndpoint` lives in the constants (Task 1) so the error module (Task 5) and the path builder (Task 6) import
  it without a cycle. `PROTECT_API_CLIENT_FACTORY` / `PROTECT_TRUSTED_CA` are defined in Task 6 and
  consumed in Tasks 8–9. `getClient()`, `settle()`, `ProtectStatusModel` fields are used with the same names in Task 9.
  Sentinels are the same strings in Global Constraints, Tasks 1, 4, 6, 7, 9.
- **Review Focus.** Each line has a pinned test: 1 → Task 5 "verify mode by IP refuses…", Task 9 service and e2e
  rows; 2 → Task 5 "pinned mode refuses…", Task 8 "stops retrying after tls_fingerprint_mismatch"; 3 → Task 4
  "backOff delays waiters…", Task 7 "15 parallel reads…"; 4 → Task 7 "ends a hung snapshot…" and "cuts off an oversized body…", Task 8
  "moves to disconnected and reconnects when the health check fails"; 5 → Task 8 "discards a superseded attempt…".
- **Proportion.** Signatures, tables and test assertions only; no service body is written out.
