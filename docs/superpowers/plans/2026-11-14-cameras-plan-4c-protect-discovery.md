# Cameras — Plan 4c: UniFi Protect console discovery (UP-6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The `devices-unifi-protect` plugin finds UniFi OS consoles on the local network over Ubiquiti's UDP discovery
protocol, confirms which of them run Protect and whether their `directConnectDomain` has a usable certificate, and
offers the result (and a manual-host probe) to the admin form through three owner/admin-only endpoints.

**Architecture:** A pure parser (`protect-discovery-tlv.ts`) turns one datagram into a typed reply or a failure code and
never throws. `ProtectDiscoveryService` opens one UDP socket per usable IPv4 interface, sends the V1 and V2 requests to
that interface's subnet broadcast address and to the multicast group three times inside a 5 s window, de-duplicates
console candidates by MAC, then hands every candidate to `ProtectDiscoveryProbeService`. The probe issues two
unauthenticated HTTPS GETs and one certificate check through an injectable transport (`NodeProtectProbeTransport` on
Node `https`/`tls`/`dns`), and a pure classifier turns the answers into a result. Every environmental failure (no
permission, Docker bridge network, unreachable host) is data in the response, never an exception.

**Tech Stack:** NestJS 11, Node `dgram`/`https`/`tls`/`dns`/`os` (no new dependency), class-validator,
class-transformer, `@nestjs/swagger`, Jest, supertest. No migration, no config change.

**Spec:** `docs/superpowers/specs/2026-10-06-unifi-protect-integration-design.md` §8 (discovery), §4.3 (TLS), §16
(testing). Issue #1182, epic #1175. Roadmap: `docs/superpowers/plans/2026-11-12-cameras-roadmap.md` §5 Plan 4 UP-6.
**Live findings (override the design where they differ):** UP-0 spike, `FINDINGS.md` lines 6-9 (reproduced as
"Verified facts" below, so the executor does not need that file).

## Global Constraints

- Branch `feat/unifi-protect-discovery`, cut from `main` after UP-5 (#1181) has merged. One PR titled
  `feat(backend): discover UniFi Protect consoles on the local network`, body `Closes #1182`. Never push to `main`.
  The final task writes the PR body to a file and does not push.
- Commits `<type>(<scope>): <lowercase imperative subject>` (scope `backend` for `apps/backend/**`, `tasks` for
  `tasks/**`), header ≤ 100 characters, ending with `Co-Authored-By: <model that wrote it> <noreply@anthropic.com>`.
  The PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- TypeScript: tabs, single quotes, semicolons, trailing commas, print width 120; imports external first, then `../`,
  then `./`, blank line between groups. Wire names snake_case via `@Expose({ name })`; properties camelCase.
- No new runtime dependency. Do not edit generated files (`spec/api/v1/openapi.json`, `apps/admin/src/openapi.ts`,
  `apps/panel/lib/api/`, …); they are git-ignored (roadmap A11) and regenerated locally only to compile and lint.
- Discovery constants (`services/protect-discovery.constants.ts`, exact values):

  | Constant | Value |
  |---|---|
  | `PROTECT_DISCOVERY_PORT` | `10001` |
  | `PROTECT_DISCOVERY_MULTICAST_ADDRESS` | `'233.89.188.1'` |
  | `PROTECT_DISCOVERY_REQUEST_V1` | `Buffer.from([0x01, 0x00, 0x00, 0x00])` |
  | `PROTECT_DISCOVERY_REQUEST_V2` | `Buffer.from([0x02, 0x08, 0x00, 0x00])` |
  | `PROTECT_DISCOVERY_WINDOW_MS` | `5000` |
  | `PROTECT_DISCOVERY_RESEND_ROUNDS` | `3` (rounds at `0`, `WINDOW/3`, `2*WINDOW/3`) |
  | `PROTECT_DISCOVERY_MAX_DATAGRAM_BYTES` | `4096` (the live reply is 402) |
  | `PROTECT_DISCOVERY_MAX_TLV_VALUE_BYTES` | `1024` |
  | `PROTECT_DISCOVERY_MAX_CANDIDATES` | `16` |
| `PROTECT_DISCOVERY_MAX_OTHER_DEVICES` | `256` (tracked identities of non-console devices) |
  | `PROTECT_PROBE_TIMEOUT_MS` | `4000` per request |
  | `PROTECT_PROBE_MAX_BODY_BYTES` | `65536` |
  | `PROTECT_PROBE_CONCURRENCY` | `8` |
  | `PROTECT_PROBE_DEFAULT_PORT` | `443` |
  | `PROTECT_PROBE_SYSTEM_PATH` / `PROTECT_PROBE_PROTECT_PATH` | `'/api/system'` / `'/proxy/protect/api'` |

- Text hygiene: every string taken from the network (TLV or JSON) is trimmed, at most 128 characters, free of control
  characters (`/[\u0000-\u001f\u007f]/`) and valid UTF-8; otherwise the field is `null`. MACs are lowercase,
  colon-separated.
- Secrets: nothing in UP-6 handles credentials. The probe never sends an `Authorization` or `X-API-KEY` header; the
  unauthenticated GETs may therefore use the TLS policy's `insecure` mode (the console presents a self-signed
  certificate by IP). Log lines carry fixed reason codes, never raw datagrams, bodies or MACs.
- Roles: all three routes `@Roles(UserRole.OWNER, UserRole.ADMIN)` on each handler, as `plugins/devices-homey`
  (`controllers/homey-test-connection.controller.ts`).

### Verified facts (live console, UP-0, 2026-11-14)

- Request `01 00 00 00` to the subnet broadcast address on UDP 10001: the console replies with header version 1,
  command 0, 402 bytes. A second, non-console UniFi device replies with header version 0 and other TLVs.
- Console TLVs: `0x01` MAC, `0x02` MAC+IPv4 (twice, plus a `0x2f` variant), `0x03` firmware `6.0.17`, `0x0a` uptime,
  `0x0b` hostname `Dream-Machine-Pro`, `0x0c` short model `UNVR`, `0x0d`/`0x0e`/`0x0f`/`0x14`/`0x17`/`0x20` other,
  `0x30` directConnectDomain `<hex>.id.ui.direct`, `0x32` JSON interface info, `0x33` UUID.
- Non-console v0 device TLVs: `0x15` `uum_controller`, `0x16` version, `0x22` `tls://<ip>:12812`; no `0x0c`, no `0x30`.
- `255.255.255.255` fails with `EADDRNOTAVAIL` on macOS; the subnet broadcast address works.
- `GET https://<ip>/api/system` (no auth) → 200 JSON: `hardware.shortname` `UNVR`, `name` `Dream Machine Pro`, `mac`,
  `deviceState`, `directConnectDomain`. `GET /proxy/protect/api` (no auth) → 401. By IP the certificate is
  self-signed (`CN=unifi.local`); with SNI = `directConnectDomain` it is a valid Let's Encrypt certificate.
- The V2 request `02 08 00 00` was **not** sent during the spike; nothing is known about V2 replies.

### Interface assumptions (UP-5 and UP-0 are planned in parallel; Task 1 Step 1 and Task 3 Step 1 verify them)

| # | Assumption | If it differs |
|---|---|---|
| A1 | `apps/backend/src/plugins/devices-unifi-protect/devices-unifi-protect.constants.ts` exports `DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX`, `DEVICES_UNIFI_PROTECT_PLUGIN_NAME`, `DEVICES_UNIFI_PROTECT_TYPE`, `DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME` (Homey analogues). | Use UP-5's names; no other effect. |
| A2 | `devices-unifi-protect.plugin.ts` exports `DevicesUnifiProtectPlugin` (`@Module` with `providers` and `controllers` arrays); `devices-unifi-protect.openapi.ts` exports `DEVICES_UNIFI_PROTECT_PLUGIN_SWAGGER_EXTRA_MODELS`; the plugin is routed from `app.module.ts` at `DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX`. | Task 5 edits UP-5's equivalents. |
| A3 | UP-5 (plan 4b, Task 5) provides `client/protect-tls-policy.ts`: `interface ProtectTlsSettings { mode: ProtectTlsMode; serverName: string \| null; fingerprintSha256: string \| null }`, `planProtectTls(host, settings): ProtectTlsConnectPlan` (`{ servername, rejectUnauthorized, pinnedFingerprint, insecure }`), `peerFingerprint`, `fingerprintsEqual`; and `client/protect-https-agent.ts`: `inspectProtectCertificate({ host, port, serverName, … }): Promise<ProtectCertificateInfo>` (`fingerprintSha256`, `subjectCommonName`, `issuerCommonName`, …) plus `ProtectHttpsAgent`. The discovery probe transport reuses `inspectProtectCertificate` for its certificate check and `planProtectTls` for TLS options instead of building its own. | Only `protect-discovery-probe.transport.ts` imports them; if UP-5's final names differ, adapt that file's imports and call sites only. |
| A4 | UP-0 is merged: `apps/backend/src/plugins/devices-unifi-protect/__fixtures__/` contains `discovery-reply.bin` (sanitized console reply, header version 1), `discovery-reply-v0.bin` (non-console, header version 0) and `system.json` (body of `GET /api/system`). Sanitization keeps field shapes (a MAC stays a 6-byte MAC, the domain stays `<hex>.id.ui.direct`). | **Stop.** Do not hand-craft a stand-in for a live capture; ask for UP-0. |
| A5 | `createExtensionLogger(name, context)` from `apps/backend/src/common/logger` is available (used by `plugins/devices-home-assistant/services/ha-mdns-discoverer.service.ts`). | — |

## Review Focus

Failure modes the spec implies but no acceptance criterion exercises, most likely first; each is pinned by a test in
the task named at the end of the line.

1. **Docker bridge network or a VLAN with no console**: no reply arrives. The scan ends `completed` (not `failed`)
   with `consoles: []`, warning `no_replies` and, when `/.dockerenv` exists, `container_network_isolated`; manual
   probe keeps working. → Task 4.
2. **Another UniFi device that also answers with a short model** (access point, switch): it must not appear as a
   console. It is probed, found not to be UniFi OS, dropped from `consoles` and counted in `other_unifi_devices`. A
   v0 reply and a reply with no TLV that identifies a console are counted, never listed. → Tasks 1 and 4.
3. **A hostile or broken LAN device**: garbage, truncated, oversized datagrams, replies from another source port, the
   request echoed back, and a flood of replies with fresh MACs. Nothing throws, nothing is retained beyond 16
   candidates and 256 other-device identities (warning `candidate_limit_reached`). → Tasks 1 and 4.
4. **`directConnectDomain` is valid for TLS but does not resolve to the console on this LAN** (router DNS rebinding
   protection, split DNS): `preferred_host` must stay the IP, otherwise the admin form would be pre-filled with a host
   that cannot connect. → Task 3.
5. **A manual probe aimed at something that is not a console** (plain HTTP on 443, an HTTPS site with a 5 MB body,
   a socket that accepts and never answers, a name that does not resolve): the call returns within the timeout with a
   `not_console` or `unreachable` result and a fixed failure code, never a 5xx and never the remote body. → Tasks 2
   and 3.

---

## File structure

All paths under `apps/backend/src/plugins/devices-unifi-protect/` unless stated.

| Path | Responsibility |
|---|---|
| `services/protect-discovery.constants.ts` (new) | Constants table above, response enums, DI tokens. |
| `services/protect-discovery-text.ts` (new) | Text hygiene: `sanitizeText`, `formatMac`, `normalizeMacString`, `isDnsHostname`. |
| `services/protect-discovery-tlv.ts` (new) | Pure datagram parser, candidate rule, identity MAC. |
| `services/protect-discovery-interfaces.ts` (new) | Pure: broadcast address, interface selection, socket error code mapping. |
| `services/protect-discovery-probe.ts` (new) | Pure: `/api/system` body parser and probe classification. |
| `services/protect-discovery-probe.transport.ts` (new) | Node I/O: `get`, `checkCertificate`, `resolveAll`; the only importer of UP-5's TLS policy. |
| `services/protect-discovery-probe.service.ts` (new) | Orchestrates one probe from the transport and the classifier into `ProtectProbeModel`. |
| `services/protect-discovery.service.ts` (new) | UDP scan lifecycle, de-duplication, probing of candidates, last-scan state. |
| `validators/protect-probe-host.validator.ts` (new) | `parseProbeHost`, `@IsProtectProbeHost()`. |
| `dto/protect-discovery-probe.dto.ts` (new) | `ProtectProbeDto`, `ProtectProbeRequestDto`. |
| `models/protect-discovery.model.ts` (new) | Response models and envelopes. |
| `controllers/protect-discovery.controller.ts` (new) | The three routes. |
| `devices-unifi-protect.plugin.ts`, `devices-unifi-protect.openapi.ts` (modify) | Providers, controller, swagger models. |
| `test/support/protect-discovery-reply.ts` (new) | `buildDiscoveryReply` hand-built datagram helper. |
| `test/support/fake-udp-socket.ts` (new) | `FakeUdpSocket`, `createFakeDiscoveryEnvironment`. |
| (no new TLS helper) | Reuse UP-5's committed test TLS material (`PROTECT_TEST_TLS`, `PROTECT_TEST_DIRECT_DOMAIN`, `protectTlsServerOptions()` — plan 4b Task 5): its CA, console cert for `fakeconsole.id.ui.direct` and self-signed cert. |
| `test/devices-unifi-protect-discovery.e2e-spec.ts` (new) | Roles, validation, envelope, real probe transport against a local HTTPS server. |
| `tasks/epics/EPIC-UNIFI-PROTECT.md:101` (modify) | `UP-6` → `UP-6 (done)`. |

Specs sit next to their source (`*.spec.ts`). Tasks are ordered so each ends with a green, committed deliverable.

---

### Task 1: Text helpers, constants and the TLV parser

**Files:**
- Create: `services/protect-discovery.constants.ts`, `services/protect-discovery-text.ts`,
  `services/protect-discovery-tlv.ts`, `test/support/protect-discovery-reply.ts`
- Test: `services/protect-discovery-text.spec.ts`, `services/protect-discovery-tlv.spec.ts`

**Interfaces:**
- Consumes: A4 fixtures.
- Produces:
  ```ts
  // protect-discovery.constants.ts — the constants table above, plus:
  export enum ProtectDiscoveryParseFailure {
  	TRUNCATED_HEADER = 'truncated_header', OVERSIZED_DATAGRAM = 'oversized_datagram',
  	UNSUPPORTED_VERSION = 'unsupported_version', TRUNCATED_DATAGRAM = 'truncated_datagram',
  	TRUNCATED_TLV = 'truncated_tlv', OVERSIZED_TLV = 'oversized_tlv',
  }
  // protect-discovery-text.ts
  export const sanitizeText = (value: string, maxLength?: number /* 128 */): string | null;
  export const formatMac = (bytes: Uint8Array): string;                 // 6 bytes -> 'aa:bb:cc:00:00:01'
  export const normalizeMacString = (value: string): string | null;     // 'AA-BB-…' | 'aabb.cc…' | 'aa:bb:…' -> lowercase colon form
  export const isDnsHostname: (value: string) => boolean;               // RFC 1123, <=253 chars, labels <=63, lowercase only, not all-numeric labels
  // protect-discovery-tlv.ts
  export interface ProtectDiscoveryAddress { mac: string; ip: string }
  export interface ProtectDiscoveryReply {
  	headerVersion: 0 | 1;
  	hwaddr: string | null;                // TLV 0x01
  	addresses: ProtectDiscoveryAddress[]; // every TLV 0x02, in order
  	firmware: string | null;              // 0x03
  	hostname: string | null;              // 0x0b
  	shortModel: string | null;            // 0x0c
  	directConnectDomain: string | null;   // 0x30
  	uuid: string | null;                  // 0x33
  }
  export type ProtectDiscoveryParseResult =
  	| { ok: true; reply: ProtectDiscoveryReply }
  	| { ok: false; reason: ProtectDiscoveryParseFailure };
  export const parseDiscoveryReply = (datagram: Uint8Array): ProtectDiscoveryParseResult;   // never throws
  export const replyIdentityMac = (reply: ProtectDiscoveryReply): string | null;            // hwaddr ?? addresses[0]?.mac ?? null
  export const isProtectConsoleCandidate = (reply: ProtectDiscoveryReply): boolean;         // identity MAC present AND (shortModel || directConnectDomain)
  // test/support/protect-discovery-reply.ts
  export const buildDiscoveryReply: (opts: {
  	version?: number; command?: number; tlvs: ReadonlyArray<readonly [type: number, value: Buffer | string]>;
  	declaredLength?: number;   // overrides the computed header length
  }) => Buffer;
  export const HAND_BUILT_CONSOLE_TLVS: ReadonlyArray<readonly [number, Buffer | string]>;
  ```
- Value formats (decided here, because the live capture only names the TLVs): `0x01` is 6 bytes; `0x02` is 10 bytes
  (6 MAC + 4 IPv4 octets, dotted decimal); `0x03`, `0x0b`, `0x0c`, `0x30` are UTF-8 strings (`0x30` must also satisfy `isDnsHostname`, else `null`); `0x33` is 16 bytes
  rendered as lowercase `8-4-4-4-12` UUID. Any other length for those types drops that field (`null`, or the pair is
  skipped for `0x02`), it does not reject the reply. Unknown types are skipped. A scalar type seen twice keeps its
  first value. Header: `>BBH` = version, command, length of the bytes after the header; versions 0 and 1 accepted,
  any command byte accepted, bytes past the declared length ignored.

- [ ] **Step 1: Verify the preconditions**

Run: `git fetch origin && git log origin/main --oneline | grep -i "unifi protect plugin foundation" && git ls-tree --name-only origin/main apps/backend/src/plugins/devices-unifi-protect/__fixtures__/`
Expected: the UP-5 merge commit, and `discovery-reply.bin`, `discovery-reply-v0.bin`, `system.json` listed (A4). If
either is missing: stop and report which.

- [ ] **Step 2: Check the fixture layout against the value-format table**

Write a throwaway script in the session scratchpad (never in the repo) that walks `discovery-reply.bin` and prints
`type:length` per TLV and the header. Expected: header `01 00` + big-endian length equal to `file size - 4`; one `0x01`
of length 6; `0x02` of length 10 (twice); `0x30` and `0x0c` present; `0x33` of length 16. Also confirm `discovery-reply-v0.bin` has header version 0 and carries a `0x01` or a `0x02` TLV (the scan counts a
non-console device only when it has an identity MAC). If a length differs from
the table or the v0 fixture has no identity, stop and amend the "Value formats" paragraph of this plan before Step 3; do not bend the parser to a guess.

- [ ] **Step 3: Write the failing text-helper tests** (`protect-discovery-text.spec.ts`)

```ts
it('sanitizeText trims and keeps ordinary text', () => expect(sanitizeText('  UNVR ')).toBe('UNVR'));
it.each(['', '   ', 'a\u0000b', 'a\nb', 'x'.repeat(129)])('sanitizeText rejects %j', (v) => expect(sanitizeText(v)).toBeNull());
it('sanitizeText accepts exactly 128 characters', () => expect(sanitizeText('x'.repeat(128))).toBe('x'.repeat(128)));
it('formatMac formats six bytes lowercase', () => expect(formatMac(Uint8Array.of(0xaa,0xbb,0xcc,0,0,1))).toBe('aa:bb:cc:00:00:01'));
it.each([['AA-BB-CC-00-00-01','aa:bb:cc:00:00:01'],['aabb.cc00.0001','aa:bb:cc:00:00:01'],['aa:bb:cc:00:00:01','aa:bb:cc:00:00:01']])('normalizeMacString %s', (i, o) => expect(normalizeMacString(i)).toBe(o));
it.each(['aa:bb:cc:00:00', 'zz:bb:cc:00:00:01', '', 'aa:bb:cc:00:00:01:02'])('normalizeMacString rejects %s', (v) => expect(normalizeMacString(v)).toBeNull());
it.each(['unifi','unifi.local','abc123.id.ui.direct','a-b.c'])('isDnsHostname accepts %s', (v) => expect(isDnsHostname(v)).toBe(true));
it.each(['','Unifi','a_b','-a.b','a-.b','a..b','1.2.3','a b','x'.repeat(64)+'.local',('a.'.repeat(130))+'a'])('isDnsHostname rejects %j', (v) => expect(isDnsHostname(v)).toBe(false));
```

- [ ] **Step 4: Write the failing parser tests** (`protect-discovery-tlv.spec.ts`; fixtures read with
  `readFileSync(join(__dirname, '..', '__fixtures__', '<name>'))`)

`HAND_BUILT_CONSOLE_TLVS` = `0x01` `aa:bb:cc:00:00:01`, `0x02` same MAC + `192.168.1.10`, `0x03` `6.0.17`, `0x0b`
`Dream-Machine-Pro`, `0x0c` `UNVR`, `0x30` `abc123.id.ui.direct`, `0x33` bytes `00112233-4455-6677-8899-aabbccddeeff`.

```ts
it('parses a hand-built v1 console reply', () => expect(parseDiscoveryReply(buildDiscoveryReply({ version: 1, tlvs: HAND_BUILT_CONSOLE_TLVS }))).toEqual({
	ok: true, reply: { headerVersion: 1, hwaddr: 'aa:bb:cc:00:00:01', addresses: [{ mac: 'aa:bb:cc:00:00:01', ip: '192.168.1.10' }],
	firmware: '6.0.17', hostname: 'Dream-Machine-Pro', shortModel: 'UNVR', directConnectDomain: 'abc123.id.ui.direct',
	uuid: '00112233-4455-6677-8899-aabbccddeeff' } }));
it('parses the sanitized v1 fixture: header, length and fields', ...);   // fixture.length === 4 + fixture.readUInt16BE(2); headerVersion 1; firmware '6.0.17'; shortModel 'UNVR'; hostname 'Dream-Machine-Pro'; domain matches /^[0-9a-f]+\.id\.ui\.direct$/; hwaddr matches /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/; uuid matches the UUID regex; addresses.length >= 2; isProtectConsoleCandidate true
it('parses the sanitized v0 fixture and does not treat it as a console', ...); // ok true; headerVersion 0; isProtectConsoleCandidate false
it('accepts header versions 0 and 1 and rejects version 2', ...);            // 02 08 00 00 -> { ok:false, reason:'unsupported_version' }
it('skips unknown TLV types and keeps them out of the model', ...);          // add 0x0a, 0x32 (JSON), 0x2f, 0xee; Object.keys(reply).sort() equals the 8 documented keys
it('keeps the first value of a repeated scalar TLV and every 0x02 pair', ...);
it.each([0,1,2,3])('rejects a %i byte datagram as truncated_header', ...);
it('rejects a declared length beyond the datagram as truncated_datagram', ...); // declaredLength: 100 on a 20 byte body
it('ignores bytes after the declared length', ...);
it('rejects a TLV whose length runs past the end as truncated_tlv', ...);
it('rejects a TLV header cut after two bytes as truncated_tlv', ...);
it('rejects a TLV above 1024 bytes as oversized_tlv', ...);
it('rejects a datagram above 4096 bytes as oversized_datagram', ...);
it.each([ ['0x01 with 5 bytes','hwaddr'], ['0x33 with 15 bytes','uuid'], ['0x0b with invalid UTF-8 (0xff 0xfe)','hostname'],
          ['0x0c containing a control character','shortModel'], ['0x30 of 129 characters','directConnectDomain'], ['0x30 "not a host"','directConnectDomain'] ])
  ('drops %s but keeps the reply', ...);                                       // ok true, that field null, others intact
it('skips a 0x02 TLV that is not 10 bytes', ...);
it('never throws for any prefix of either fixture', ...);                      // for n in 0..length: expect(() => parseDiscoveryReply(f.subarray(0, n))).not.toThrow()
it('never throws for 500 deterministic pseudo-random buffers', ...);           // mulberry32(1182), lengths 0..600, header bytes forced to 01 00 + random length
// base reply: hwaddr 'aa:bb:cc:00:00:01', everything else null, addresses []
it.each([ [{shortModel:'UNVR'},true], [{directConnectDomain:'x.id.ui.direct'},true], [{},false], [{shortModel:'U6-LR', hwaddr:null, addresses:[]},false] ])
  ('isProtectConsoleCandidate %j -> %s', ...);                                  // identity MAC is required
it('replyIdentityMac falls back to the first 0x02 MAC', ...);
```

- [ ] **Step 5: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services/protect-discovery-text.spec.ts src/plugins/devices-unifi-protect/services/protect-discovery-tlv.spec.ts`
Expected: FAIL, "Cannot find module './protect-discovery-text'".

- [ ] **Step 6: Implement** `protect-discovery.constants.ts` (the table values plus `ProtectDiscoveryParseFailure`),
  `protect-discovery-text.ts` (signatures above; `TextDecoder('utf-8', { fatal: true })` for strings is used by the
  parser, `sanitizeText` only checks the decoded string), `protect-discovery-tlv.ts` and the
  `buildDiscoveryReply` helper (`>BBH` + `type(1) len(2) value`, `declaredLength` overriding the computed length).
  Parser approach: bounds-check with `DataView`/`Buffer` reads only, a single `while (offset < end)` loop, and a
  `switch (type)` over `0x01 0x02 0x03 0x0b 0x0c 0x30 0x33` with `default` doing nothing. Wrap nothing in
  `try/catch` that hides a bug: every failure path is an explicit bounds check returning `{ ok: false }`; the only
  `try/catch` is around `TextDecoder` with `fatal: true`.

- [ ] **Step 7: Run to verify pass**

Run: the Step 5 command. Expected: PASS, all tests in both files.

- [ ] **Step 8: Lint and commit**

Run: `pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect/services test/support/protect-discovery-reply.ts && pnpm --filter ./apps/backend exec prettier --check "src/plugins/devices-unifi-protect/services/protect-discovery*.ts" test/support/protect-discovery-reply.ts`

```bash
git add apps/backend/src/plugins/devices-unifi-protect/services apps/backend/test/support/protect-discovery-reply.ts
git commit -m "feat(backend): parse UniFi Protect discovery replies"
```

---

### Task 2: Probe host validation and probe classification (pure)

**Files:**
- Create: `validators/protect-probe-host.validator.ts`, `services/protect-discovery-probe.ts`
- Test: `validators/protect-probe-host.validator.spec.ts`, `services/protect-discovery-probe.spec.ts`
- Modify: `services/protect-discovery.constants.ts` (response enums below)

**Interfaces:**
- Consumes (Task 1): `sanitizeText`, `normalizeMacString`, `isDnsHostname`, `PROTECT_PROBE_*` constants.
- Produces:
  ```ts
  // protect-discovery.constants.ts additions
  export enum ProtectPresence { PRESENT = 'present', ABSENT = 'absent', UNKNOWN = 'unknown' }
  export enum ProtectProbeStatus { CONSOLE = 'console', NOT_CONSOLE = 'not_console', UNREACHABLE = 'unreachable' }
  export enum ProtectProbeFailure {
  	TIMEOUT = 'timeout', CONNECTION_REFUSED = 'connection_refused', HOST_UNREACHABLE = 'host_unreachable',
  	DNS_FAILURE = 'dns_failure', TLS_FAILURE = 'tls_failure',
  }
  export type ProtectTransportErrorKind = 'timeout' | 'refused' | 'unreachable' | 'dns' | 'tls' | 'protocol';
  // validators/protect-probe-host.validator.ts
  export interface ParsedProbeHost { host: string; kind: 'ipv4' | 'ipv6' | 'hostname' }
  export const parseProbeHost = (value: unknown): ParsedProbeHost | null;   // trims, lowercases hostnames
  export const IsProtectProbeHost: (options?: ValidationOptions) => PropertyDecorator;
  // services/protect-discovery-probe.ts
  export type ProtectProbeHttp =
  	| { ok: true; statusCode: number; body: string }
  	| { ok: false; kind: ProtectTransportErrorKind; code: string | null };
  export interface ParsedProtectSystem {
  	model: string; name: string | null; mac: string | null; deviceState: string | null; directConnectDomain: string | null;
  }
  export const parseSystemInfo = (body: string): ParsedProtectSystem | null;
  export interface ProtectProbeClassification {
  	status: ProtectProbeStatus; failure: ProtectProbeFailure | null; protect: ProtectPresence; system: ParsedProtectSystem | null;
  }
  export const classifyProbe = (input: { system: ProtectProbeHttp; protect: ProtectProbeHttp }): ProtectProbeClassification;
  ```
- Host policy (decided): accept an IPv4 literal, an IPv6 literal (bare, no brackets) or an RFC 1123 hostname; reject
  anything with a scheme, path, query, `@`, whitespace or a `:` that is not part of an IPv6 literal (the port is a
  separate field). Reject non-unicast and link-local addresses: `0.0.0.0`, `255.255.255.255`, `224.0.0.0/4`,
  `169.254.0.0/16` (includes cloud metadata), `::`, `fe80::/10`, `ff00::/8`. **Loopback and private ranges are
  accepted**: the LAN is the point of the endpoint, the response is a fixed projection of two JSON fields, and the
  route is owner/admin only.

- [ ] **Step 1: Write the failing validator tests**

```ts
it.each([['192.168.1.10','ipv4'],['127.0.0.1','ipv4'],['unifi','hostname'],['unifi.local','hostname'],[' UniFi.Local ','hostname'],['fd00::1','ipv6'],['::1','ipv6']])
  ('accepts %j', (v, kind) => expect(parseProbeHost(v)).toEqual({ host: v.trim().toLowerCase(), kind }));
it.each(['', '   ', 5, null, 'http://192.168.1.10', '192.168.1.10:443', '192.168.1.10/api', '192.168.1.10?x=1', 'user@host', 'host name',
         '0.0.0.0', '255.255.255.255', '224.0.0.1', '169.254.169.254', 'fe80::1', 'ff02::1', '::', '999.1.1.1', '1.2.3', 'host_name',
         'a'.repeat(254), `${'a'.repeat(64)}.local`, '[::1]'])('rejects %j', (v) => expect(parseProbeHost(v)).toBeNull());
```

- [ ] **Step 2: Write the failing classification tests** (`protect-discovery-probe.spec.ts`)

`parseSystemInfo`: reads `__fixtures__/system.json` → `{ model: 'UNVR', name: 'Dream Machine Pro', mac: <matches MAC regex>,
deviceState: <string>, directConnectDomain: <matches /^[0-9a-f]+\.id\.ui\.direct$/> }`; plus `it.each` returning `null`
for `''`, `'not json'`, `'[]'`, `'{}'`, `'{"hardware":{}}'`, `'{"hardware":{"shortname":""}}'`, `'{"hardware":{"shortname":5}}'`;
an invalid `directConnectDomain` (`'a b'`, `'EVIL.com/x'`) becomes `null` while the rest survives; unknown keys are ignored.

`classifyProbe` (`sys200` = `{ok:true,statusCode:200,body:<fixture>}`, `http(n)` = `{ok:true,statusCode:n,body:''}`,
`fail(kind)` = `{ok:false,kind,code:null}`):

| Test name | system | protect | status | failure | protect |
|---|---|---|---|---|---|
| console with Protect (401) | sys200 | http(401) | `console` | null | `present` |
| Protect behind 403 | sys200 | http(403) | `console` | null | `present` |
| console without Protect (404) | sys200 | http(404) | `console` | null | `absent` |
| Protect answers 502 | sys200 | http(502) | `console` | null | `unknown` |
| Protect request times out | sys200 | fail('timeout') | `console` | null | `unknown` |
| system 404 | http(404) | http(401) | `not_console` | null | `unknown` |
| system body is HTML | `{ok:true,statusCode:200,body:'<html>'}` | http(401) | `not_console` | null | `unknown` |
| system protocol error (oversized body) | fail('protocol') | http(401) | `not_console` | null | `unknown` |
| system timeout | fail('timeout') | fail('timeout') | `unreachable` | `timeout` | `unknown` |
| refused | fail('refused') | fail('refused') | `unreachable` | `connection_refused` | `unknown` |
| unreachable | fail('unreachable') | … | `unreachable` | `host_unreachable` | `unknown` |
| dns | fail('dns') | … | `unreachable` | `dns_failure` | `unknown` |
| tls | fail('tls') | … | `unreachable` | `tls_failure` | `unknown` |

`it('does not report Protect for a non-console even when the Protect path answers 401')` is the `system 404` row.

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/validators/protect-probe-host.validator.spec.ts src/plugins/devices-unifi-protect/services/protect-discovery-probe.spec.ts`
Expected: FAIL, "Cannot find module".

- [ ] **Step 4: Implement** the enums, `parseProbeHost` (use `node:net` `isIPv4`/`isIPv6` for literals, `isDnsHostname`
  for names; compute the IPv4/IPv6 range rejections from parsed octets/hextets, not string prefixes),
  `IsProtectProbeHost` (`ValidateBy`, message `host must be an IP address or hostname without scheme, path or port`,
  same shape as `plugins/devices-homey/validators/homey-url.validator.ts`), `parseSystemInfo` (`JSON.parse` in
  `try/catch`; require `hardware.shortname` as a non-empty sanitized string) and `classifyProbe`.

- [ ] **Step 5: Run to verify pass.** Command of Step 3. Expected: PASS.

- [ ] **Step 6: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect/validators src/plugins/devices-unifi-protect/services
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): classify UniFi Protect probe results"
```

---

### Task 3: Probe transport and probe service

**Files:**
- Create: `services/protect-discovery-probe.transport.ts`, `services/protect-discovery-probe.service.ts`,
- Test: `services/protect-discovery-probe.transport.spec.ts`, `services/protect-discovery-probe.service.spec.ts`
- Modify: `services/protect-discovery.constants.ts` (token `PROTECT_PROBE_TRANSPORT`)

**Interfaces:**
- Consumes (Task 2): `classifyProbe`, `ProtectProbeHttp`, `ProtectTransportErrorKind`, enums. A3 TLS policy.
- Produces:
  ```ts
  // protect-discovery.constants.ts
  export const PROTECT_PROBE_TRANSPORT = Symbol('PROTECT_PROBE_TRANSPORT');
  // protect-discovery-probe.transport.ts
  export interface ProtectProbeTarget { host: string; port: number }
  export type ProtectCertificateCheck =
  	| { ok: true; valid: boolean; errorCode: string | null; validTo: string | null }   // validTo ISO-8601, only when valid
  	| { ok: false; kind: ProtectTransportErrorKind; code: string | null };
  export interface ProtectProbeTransport {
  	get(target: ProtectProbeTarget, path: string, timeoutMs: number): Promise<ProtectProbeHttp>;                     // never rejects
  	checkCertificate(target: ProtectProbeTarget, servername: string, timeoutMs: number): Promise<ProtectCertificateCheck>; // never rejects
  	resolveAll(hostname: string): Promise<string[]>;                                                                  // IPs; [] on any failure; an IP literal returns itself
  }
  export class NodeProtectProbeTransport implements ProtectProbeTransport {
  	constructor(options?: { extraCa?: string });   // extraCa: additional trusted CA (private PKI, tests); default none
  }
  // protect-discovery-probe.service.ts
  @Injectable() export class ProtectDiscoveryProbeService {
  	constructor(@Inject(PROTECT_PROBE_TRANSPORT) transport: ProtectProbeTransport);
  	probe(target: ProtectProbeTarget): Promise<ProtectProbeResult>;   // never rejects; ProtectProbeResult is declared below
  }
  // Reuse UP-5's PROTECT_TEST_TLS (CA + console cert for PROTECT_TEST_DIRECT_DOMAIN + self-signed cert) and
  // protectTlsServerOptions(); pass PROTECT_TEST_TLS.ca as the transport's extraCa in tests. No openssl at test time.
  ```
  `ProtectProbeModel` is a Task 5 class; to keep this task compilable on its own, `protect-discovery-probe.service.ts`
  exports the plain interface `ProtectProbeResult` (fields in the table below); Tasks 4 and 5 import it from there and
  Task 5's model `implements ProtectProbeResult`.

  | Field | Type | Rule |
  |---|---|---|
  | `host`, `port` | string, number | echo of the target |
  | `status`, `failure`, `protect` | enums | from `classifyProbe` |
  | `model`, `name`, `mac`, `deviceState` | `string \| null` | from `ParsedProtectSystem`, `null` unless status `console` |
  | `directConnectDomain` | `string \| null` | same |
  | `certificate` | `{ checked: true; domain: string; valid: boolean \| null; errorCode: string \| null; validTo: string \| null; domainResolvesToHost: boolean } \| null` | `null` unless a certificate check ran |
  | `preferredHost` | `string \| null` | status `console`: the domain when `certificate.valid === true && domainResolvesToHost === true`, else `host`; otherwise `null` |

- [ ] **Step 1: Locate UP-5's TLS policy (A3)**

Run: `git ls-files apps/backend/src/plugins/devices-unifi-protect | grep -E 'protect-tls-policy|protect-https-agent'` and read the exports.
Expected: `ProtectTlsSettings`, `planProtectTls` (in `client/protect-tls-policy.ts`) and `inspectProtectCertificate` (in `client/protect-https-agent.ts`) as in A3. If the names differ, use the real ones in Step 5 and nothing else changes.

- [ ] **Step 2: Write the failing transport tests** (real sockets on `127.0.0.1`, a
  `https.createServer` per test using UP-5's `protectTlsServerOptions()` / `PROTECT_TEST_TLS` (console cert for `PROTECT_TEST_DIRECT_DOMAIN`, self-signed cert otherwise), closed in `afterEach`; timeouts in
  tests ≤ 300 ms)

```ts
it('get returns status and body from a self-signed server', ...);               // 200 '{"a":1}' -> { ok:true, statusCode:200, body:'{"a":1}' }
it('get sends no credentials and only the documented headers', ...);            // server records req.headers: no authorization, no x-api-key; accept 'application/json'
it('get does not follow a redirect', ...);                                       // 302 Location: /x -> { ok:true, statusCode:302 }
it('get fails with kind timeout when the server accepts and never answers', ...);
it('get fails with kind timeout when the server dribbles the body past the overall deadline', ...);   // one byte every 50 ms, timeoutMs 200
it('get fails with kind refused for a closed port', ...);
it('get fails with kind protocol when the body exceeds 65536 bytes', ...);      // and the request is destroyed
it('get fails with kind tls when the port speaks plain HTTP', ...);             // net server answering 'HTTP/1.1 200 OK'
it('checkCertificate is valid when the certificate is trusted and names the servername', ...); // new NodeProtectProbeTransport({ extraCa: cert }); { ok:true, valid:true, errorCode:null, validTo: ISO string in the future }
it('checkCertificate reports DEPTH_ZERO_SELF_SIGNED_CERT without extraCa', ...);              // { ok:true, valid:false, errorCode:'DEPTH_ZERO_SELF_SIGNED_CERT', validTo:null }
it('checkCertificate reports ERR_TLS_CERT_ALTNAME_INVALID for another servername', ...);      // extraCa set, servername 'other.test'
it('checkCertificate fails with kind refused for a closed port', ...);
it('resolveAll returns an IP literal unchanged', ...);                          // '127.0.0.1' -> ['127.0.0.1']
it('resolveAll returns [] for a name that does not resolve', ...);              // 'nonexistent.invalid'
```

- [ ] **Step 3: Write the failing service tests** (fake `ProtectProbeTransport` as a plain object of `jest.fn()`s;
  `system200` = `{ok:true,statusCode:200,body: readFileSync(system.json)}`, whose domain is `D`)

```ts
it('queries only the two documented paths with the probe timeout', ...);        // get calls toEqual [[target,'/api/system',4000],[target,'/proxy/protect/api',4000]] (any order)
it('prefers the directConnectDomain when its certificate is valid and it resolves to the host', ...);   // cert valid, resolveAll(D)=['192.168.1.10'], host '192.168.1.10' -> preferredHost D; certificate {checked:true, domain:D, valid:true, errorCode:null, validTo:<iso>, domainResolvesToHost:true}
it('keeps the IP when the certificate is valid but the domain resolves elsewhere', ...);   // resolveAll(D)=['203.0.113.9'] -> preferredHost '192.168.1.10', domainResolvesToHost false
it('keeps the IP when the domain does not resolve', ...);                       // resolveAll(D)=[]
it('keeps the IP and reports the error code when the certificate is invalid', ...);   // valid:false errorCode 'DEPTH_ZERO_SELF_SIGNED_CERT'
it('resolves a hostname target before comparing addresses', ...);                // host 'unifi.local': resolveAll('unifi.local') used for the host side
it('records a certificate transport failure as valid null', ...);                // checkCertificate {ok:false,kind:'timeout'} -> certificate.valid null, errorCode 'timeout', preferredHost host
it('skips the certificate check when /api/system has no usable domain', ...);    // certificate null, preferredHost host
it('skips the certificate check when the host is not a console', ...);          // system 404 -> checkCertificate not called, preferredHost null
it('returns an unreachable result and never rejects when the transport reports failures', ...);
it('never lets a throwing transport escape', ...);                               // transport.get throws synchronously -> status 'unreachable', failure 'host_unreachable'
```

- [ ] **Step 4: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services/protect-discovery-probe.transport.spec.ts src/plugins/devices-unifi-protect/services/protect-discovery-probe.service.spec.ts`
Expected: FAIL, "Cannot find module './protect-discovery-probe.transport'".

- [ ] **Step 5: Implement the transport**

`get`: `https.request({ host, port, path, method: 'GET', agent: false, timeout, headers: { Accept: 'application/json' }, rejectUnauthorized: false })` (TLS options from `planProtectTls(host, { mode: 'insecure', serverName: null, fingerprintSha256: null })`)
(comment: unauthenticated request, nothing secret is sent, so an unverified certificate is acceptable; the verified
check is `checkCertificate`). Collect the body up to `PROTECT_PROBE_MAX_BODY_BYTES`, then destroy and resolve
`{ ok: false, kind: 'protocol', code: 'body_too_large' }`. Settle exactly once (a `settled` guard); one `setTimeout(timeoutMs)`
covering the whole request including the body (not the idle-socket `timeout` option, which a slow drip evades)
destroys the request and resolves `kind: 'timeout'`. Map error `code`: `ECONNREFUSED` → `refused`;
`EHOSTUNREACH|ENETUNREACH|ENETDOWN|ECONNRESET|EPIPE` → `unreachable`; `ENOTFOUND|EAI_AGAIN` → `dns`;
`ERR_SSL_*|EPROTO|ERR_TLS_*` and anything raised before the response → `tls`; `ETIMEDOUT` → `timeout`; unknown →
`unreachable`. `checkCertificate`: `tls.connect({ host, port, servername, rejectUnauthorized: true, ca: [...tls.rootCertificates, extraCa] when extraCa is set, timeout })` — options derived from `planProtectTls(host, { mode: 'verify', serverName: servername, fingerprintSha256: null })` (UP-5); where UP-5's `inspectProtectCertificate` already yields the same result (verified flag, subject/issuer, fingerprint), call it instead and map its outcome;
resolve `valid: true` on `secureConnect` (read `getPeerCertificate().valid_to` → ISO string); an error whose `code`
is in `{CERT_HAS_EXPIRED, CERT_NOT_YET_VALID, DEPTH_ZERO_SELF_SIGNED_CERT, SELF_SIGNED_CERT_IN_CHAIN, UNABLE_TO_VERIFY_LEAF_SIGNATURE, UNABLE_TO_GET_ISSUER_CERT, UNABLE_TO_GET_ISSUER_CERT_LOCALLY, ERR_TLS_CERT_ALTNAME_INVALID, CERT_REVOKED}`
resolves `valid: false` with that code; every other error uses the mapping above. Always `socket.destroy()` after the
result. `resolveAll`: `isIP` literal returns `[value]`; else `dns.promises.lookup(name, { all: true })` with a
`PROTECT_PROBE_TIMEOUT_MS` race, `[]` on any failure.

Service: the algorithm is (1) `Promise.all` of the two `get` calls; (2) `classifyProbe`; (3) when status is `console`
and `system.directConnectDomain !== null`, `Promise.all` of `checkCertificate(target, domain, 4000)`,
`resolveAll(domain)` and, for a hostname target, `resolveAll(target.host)`; `domainResolvesToHost` is
`domainAddrs.some((a) => hostAddrs.includes(a))`; (4) assemble `ProtectProbeResult`. Wrap the body in `try/catch`
so a throwing transport yields `{ status: 'unreachable', failure: 'host_unreachable', … }`.

- [ ] **Step 6: Run to verify pass.** Command of Step 4. Expected: PASS (transport tests use UP-5's committed test TLS material).

- [ ] **Step 7: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect/services
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): probe UniFi Protect consoles and their certificates"
```

---

### Task 4: Scan interfaces and the discovery service

**Files:**
- Create: `services/protect-discovery-interfaces.ts`, `services/protect-discovery.service.ts`,
  `test/support/fake-udp-socket.ts`
- Test: `services/protect-discovery-interfaces.spec.ts`, `services/protect-discovery.service.spec.ts`
- Modify: `services/protect-discovery.constants.ts` (scan enums, `PROTECT_DISCOVERY_ENVIRONMENT`)

**Interfaces:**
- Consumes: Task 1 parser; Task 3 `ProtectDiscoveryProbeService.probe(target): Promise<ProtectProbeResult>`.
- Produces:
  ```ts
  // protect-discovery.constants.ts
  export enum ProtectDiscoveryStatus { IDLE = 'idle', SCANNING = 'scanning', COMPLETED = 'completed', FAILED = 'failed' }
  export enum ProtectDiscoveryFailureReason { NO_USABLE_INTERFACE = 'no_usable_interface', ALL_INTERFACES_FAILED = 'all_interfaces_failed' }
  export enum ProtectDiscoveryWarning {
  	SOME_INTERFACES_FAILED = 'some_interfaces_failed', NO_REPLIES = 'no_replies',
  	CONTAINER_NETWORK_ISOLATED = 'container_network_isolated', CANDIDATE_LIMIT_REACHED = 'candidate_limit_reached',
  }
  export enum ProtectInterfaceStatus { OK = 'ok', ERROR = 'error' }
  export enum ProtectInterfaceErrorCode {
  	PERMISSION_DENIED = 'permission_denied', ADDRESS_UNAVAILABLE = 'address_unavailable',
  	NETWORK_UNREACHABLE = 'network_unreachable', SOCKET_ERROR = 'socket_error',
  }
  export const PROTECT_DISCOVERY_ENVIRONMENT = Symbol('PROTECT_DISCOVERY_ENVIRONMENT');
  // protect-discovery-interfaces.ts
  export interface ProtectScanInterface { name: string; address: string; broadcast: string }
  export const computeBroadcastAddress = (address: string, netmask: string): string | null;   // null for /31 and /32 or malformed
  export const selectScanInterfaces = (interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>): ProtectScanInterface[]; // IPv4, !internal, not 169.254/16, with a broadcast; stable order by name then address
  export const mapSocketErrorCode = (error: unknown): ProtectInterfaceErrorCode;               // EACCES|EPERM, EADDRNOTAVAIL, ENETUNREACH|EHOSTUNREACH|ENETDOWN, else socket_error
  // protect-discovery.service.ts
  export interface ProtectDiscoverySocket extends Pick<dgram.Socket, 'bind' | 'send' | 'close' | 'on' | 'setBroadcast' | 'setMulticastTTL' | 'setMulticastInterface' | 'setMulticastLoopback'> {}
  export interface ProtectDiscoveryEnvironment {
  	createSocket(): ProtectDiscoverySocket;                    // udp4
  	networkInterfaces(): NodeJS.Dict<os.NetworkInterfaceInfo[]>;
  	isContainer(): boolean;                                    // existsSync('/.dockerenv')
  }
  export const createNodeDiscoveryEnvironment = (): ProtectDiscoveryEnvironment;
  @Injectable() export class ProtectDiscoveryService implements OnModuleDestroy {
  	constructor(@Inject(PROTECT_DISCOVERY_ENVIRONMENT) env: ProtectDiscoveryEnvironment, probe: ProtectDiscoveryProbeService);
  	getLastScan(): ProtectDiscoveryScan;           // idle snapshot before the first scan
  	scan(): Promise<ProtectDiscoveryScan>;         // concurrent calls share one scan; never rejects
  	onModuleDestroy(): void;                       // clears timers, closes sockets, settles an in-flight scan
  }
  export interface ProtectDiscoveryScan {          // Task 5 maps it 1:1 onto ProtectDiscoveryModel
  	status: ProtectDiscoveryStatus; failureReason: ProtectDiscoveryFailureReason | null; warnings: ProtectDiscoveryWarning[];
  	startedAt: string | null; finishedAt: string | null;   // ISO-8601
  	interfaces: Array<{ name: string; address: string; broadcastAddress: string; status: ProtectInterfaceStatus; errorCode: ProtectInterfaceErrorCode | null }>;
  	consoles: Array<{ mac: string; host: string; addresses: string[]; hostname: string | null; model: string | null; firmware: string | null;
  	                  directConnectDomain: string | null; uuid: string | null; probe: ProtectProbeResult }>;
  	otherUnifiDevices: number;
  }
  // test/support/fake-udp-socket.ts
  export class FakeUdpSocket extends EventEmitter implements ProtectDiscoverySocket { /* records sends; supports scripted replies and errors */ }
  export const createFakeDiscoveryEnvironment: (opts: {
  	interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>; container?: boolean;
  	onSend?: (socket: FakeUdpSocket, msg: Buffer, port: number, address: string) => Error | null | void;   // return an Error to fail that send; call socket.reply(buf, fromAddress) to answer
  	bindError?: (address: string) => NodeJS.ErrnoException | null;
  }) => { env: ProtectDiscoveryEnvironment; sockets: FakeUdpSocket[] };
  ```
- Scan algorithm (not determined by the signatures): (1) a running scan is returned as-is; otherwise reset the state
  to `scanning` with `startedAt = now` and empty lists. (2) `selectScanInterfaces`; none → `failed`/`no_usable_interface`.
  (3) One socket per interface bound to `<address>:0`; attach `error` and `message` listeners **before** `bind`; after
  bind call `setBroadcast(true)`, `setMulticastTTL(1)`, `setMulticastInterface(address)`, `setMulticastLoopback(false)`
  each in its own `try/catch` (a multicast setup failure does not stop broadcast). (4) A send round (t = 0, 1667,
  3333 ms) sends, per ready interface, V1 then V2 to `<broadcast>:10001` and to `233.89.188.1:10001`; **never to
  `255.255.255.255`**. A send callback error records the interface's first error code; one successful send marks the
  interface `ok`. (5) A message is dropped unless `rinfo.port === 10001`; then parsed; parse failures are logged at
  `debug` with the reason code only; replies without an identity MAC are ignored; a candidate (rule of Task 1) is kept
  in a `Map<mac, …>` (first `rinfo.address` is `host`, further addresses are appended to `addresses`, null fields are
  filled from later replies), up to 16 (then `candidate_limit_reached`); any other reply with an identity MAC adds to a
  `Set` (at most 256 entries, then ignored) counted as `otherUnifiDevices`. (6) At t = 5000 ms close every socket, finalise interface statuses, and if
  every interface is `error` finish `failed`/`all_interfaces_failed`. (7) Otherwise probe candidates with concurrency
  8 (`probe({ host, port: PROTECT_PROBE_DEFAULT_PORT })`); a candidate whose probe status is `not_console` is dropped from `consoles` and
  added to `otherUnifiDevices` (its MAC joins the same `Set`, so nothing is counted twice). (8) Warnings:
  `some_interfaces_failed` when at least one but not all failed; `no_replies` when no UDP reply was kept or counted;
  `container_network_isolated` when `no_replies` and `env.isContainer()`. (9) `completed`, `finishedAt = now`.

- [ ] **Step 1: Write the failing interface tests**

```ts
it.each([['192.168.1.20','255.255.255.0','192.168.1.255'],['10.0.5.9','255.255.252.0','10.0.7.255'],['172.16.3.4','255.255.0.0','172.16.255.255']])
  ('computeBroadcastAddress %s %s', (a, m, b) => expect(computeBroadcastAddress(a, m)).toBe(b));
it.each([['100.64.0.5','255.255.255.255'],['10.0.0.1','255.255.255.254'],['bad','255.255.255.0'],['10.0.0.1','nope']])
  ('computeBroadcastAddress returns null for %s %s', (a, m) => expect(computeBroadcastAddress(a, m)).toBeNull());
it('selectScanInterfaces keeps non-internal IPv4 interfaces with a broadcast address and skips lo, IPv6, /32 and 169.254/16', ...);
it('selectScanInterfaces orders by name then address and keeps two addresses on one interface', ...);
it.each([['EACCES','permission_denied'],['EPERM','permission_denied'],['EADDRNOTAVAIL','address_unavailable'],['ENETUNREACH','network_unreachable'],['EHOSTUNREACH','network_unreachable'],['EBADF','socket_error']])
  ('mapSocketErrorCode %s -> %s', ...);
it('mapSocketErrorCode maps a non-error to socket_error', () => expect(mapSocketErrorCode('x')).toBe('socket_error'));
```

- [ ] **Step 2: Write the failing service tests** (jest modern fake timers; `jest.advanceTimersByTimeAsync`; probe is a
  `{ probe: jest.fn() }` fake returning a console-shaped `ProtectProbeResult`; single interface `en0`
  `192.168.1.20/255.255.255.0` unless stated; replies built with `buildDiscoveryReply` or read from the fixtures)

```ts
it('getLastScan is idle with empty lists before the first scan', ...);
it('binds one socket per usable interface and skips others', ...);                      // en0 + lo + IPv6 + /32 -> sockets.length 1, bound to 192.168.1.20 port 0
it('sends V1 and V2 to the subnet broadcast address and the multicast group, never to 255.255.255.255', ...); // round 1: exactly 4 sends: 01000000 and 02080000 to 192.168.1.255:10001 and 233.89.188.1:10001
it('resends at one third and two thirds of the window and stops after three rounds', ...);   // 4 -> 8 -> 12 sends; after 5000 ms sockets closed and no further sends
it('closes every socket and settles the scan at the end of the window', ...);
it('lists a console candidate from the sanitized v1 fixture and probes it on port 443', ...);   // probe called with { host: <rinfo.address>, port: 443 }; consoles[0] mac/hostname 'Dream-Machine-Pro'/model 'UNVR'/firmware '6.0.17'
it('counts a v0 reply as another UniFi device and never lists or probes it', ...);              // otherUnifiDevices 1; probe not called
it('de-duplicates replies with the same MAC and keeps every source address', ...);             // same reply from 192.168.1.10 and 192.168.1.11 -> one console, addresses both, host first
it('de-duplicates across resend rounds', ...);
it('drops a probed candidate that is not a console and counts it once', ...);                  // probe status 'not_console' -> consoles [], otherUnifiDevices 1 (also when its MAC replied twice)
it('keeps a console whose probe is unreachable and reports the probe status', ...);
it('ignores a reply from a source port other than 10001', ...);
it('ignores the echoed request and replies without an identity MAC', ...);
it('ignores malformed datagrams without throwing and without counting them', ...);              // truncated fixture prefixes, 5000 bytes, random bytes
it('keeps at most 16 candidates and warns candidate_limit_reached', ...);                       // 20 distinct console MACs
it('stops tracking other devices after 256 identities', ...);                                   // 300 distinct non-console MACs -> otherUnifiDevices 256
it('reports a socket error event as that interface failing and still completes', ...);          // two interfaces; sockets[0].emit('error', EACCES) -> interfaces[0] error/permission_denied, status completed, warning some_interfaces_failed
it('does not throw when setBroadcast or setMulticastInterface throw', ...);                     // interface stays ok when a send still succeeds
it('reports failed/all_interfaces_failed when every interface cannot send', ...);              // onSend returns EACCES; consoles []
it('reports failed/no_usable_interface when no usable interface exists', ...);
it('reports an interface bind error as address_unavailable', ...);
it('ends completed with no_replies when nothing answers', ...);
it('adds container_network_isolated when nothing answers inside a container', ...);              // env.isContainer() true
it('does not warn about containers when a console answered', ...);
it('shares one scan between concurrent scan calls', ...);                                        // two calls, one set of sockets (sockets.length 1), same resolved object
it('replaces the previous result when a new scan starts', ...);                                  // getLastScan during the second scan is scanning with empty consoles
it('onModuleDestroy closes sockets, clears timers and settles an in-flight scan without throwing', ...);
it('passes at most eight probes at a time', ...);                                                // 12 candidates, probe fake holds promises; max concurrent === 8
it('logs no raw datagram, MAC or body', ...);                                                    // spy on Logger.prototype.*; serialized calls contain neither the fixture hex nor 'aa:bb:cc'
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/services/protect-discovery-interfaces.spec.ts src/plugins/devices-unifi-protect/services/protect-discovery.service.spec.ts`
Expected: FAIL, "Cannot find module './protect-discovery-interfaces'".

- [ ] **Step 4: Implement** `protect-discovery-interfaces.ts`, `FakeUdpSocket`/`createFakeDiscoveryEnvironment`,
  `createNodeDiscoveryEnvironment` (`dgram.createSocket({ type: 'udp4', reuseAddr: false })`, `os.networkInterfaces`,
  `fs.existsSync('/.dockerenv')`) and `ProtectDiscoveryService` following the algorithm above. Logger:
  `createExtensionLogger(DEVICES_UNIFI_PROTECT_PLUGIN_NAME, 'ProtectDiscoveryService')`, levels `debug`/`warn`, fixed
  codes only. All timers live in one `Set<NodeJS.Timeout>`; every socket in one array; both are drained by the
  finish path and by `onModuleDestroy`. The scan body is one `async` method whose outer `try/catch` converts any
  unexpected error into a `failed` scan with `failureReason: 'all_interfaces_failed'` and a `warn` log of
  `error.name`, so `scan()` never rejects.

- [ ] **Step 5: Run to verify pass.** Command of Step 3. Expected: PASS.

- [ ] **Step 6: Lint and commit**

```bash
pnpm --filter ./apps/backend exec eslint src/plugins/devices-unifi-protect/services test/support/fake-udp-socket.ts
git add apps/backend/src/plugins/devices-unifi-protect apps/backend/test/support/fake-udp-socket.ts
git commit -m "feat(backend): scan the local network for UniFi OS consoles"
```

---

### Task 5: Models, DTO, controller and plugin wiring

**Files:**
- Create: `models/protect-discovery.model.ts`, `dto/protect-discovery-probe.dto.ts`,
  `controllers/protect-discovery.controller.ts`
- Test: `dto/protect-discovery-probe.dto.spec.ts`, `controllers/protect-discovery.controller.spec.ts`
- Modify: `devices-unifi-protect.plugin.ts`, `devices-unifi-protect.openapi.ts` (A2)

**Interfaces:**
- Consumes: `ProtectDiscoveryService` (Task 4), `ProtectDiscoveryProbeService` (Task 3), `IsProtectProbeHost` (Task 2).
- Produces (schema names follow `devices-wled/models/wled-discovery.model.ts`; every model property carries
  `@ApiProperty`/`@ApiPropertyOptional` with description and `@Expose({ name: '<snake_case>' })`; nested arrays use
  `@Type` and `getSchemaPath`):

  | Class | `@ApiSchema` name | Fields (wire names) |
  |---|---|---|
  | `ProtectDiscoveryInterfaceModel` | `DevicesUnifiProtectPluginDataDiscoveryInterface` | `name`, `address`, `broadcast_address`, `status` (enum), `error_code` (enum, nullable) |
  | `ProtectProbeCertificateModel` | `DevicesUnifiProtectPluginDataProbeCertificate` | `checked` (`true`), `domain`, `valid` (bool, nullable), `error_code` (nullable), `valid_to` (nullable), `domain_resolves_to_host` |
  | `ProtectProbeModel` implements `ProtectProbeResult` | `DevicesUnifiProtectPluginDataProbe` | `host`, `port`, `status`, `failure`, `protect`, `model`, `name`, `mac`, `device_state`, `direct_connect_domain`, `certificate` (nullable), `preferred_host` (nullable) |
  | `ProtectDiscoveredConsoleModel` | `DevicesUnifiProtectPluginDataDiscoveredConsole` | `mac`, `host`, `addresses`, `hostname`, `model`, `firmware`, `direct_connect_domain`, `uuid`, `probe` |
  | `ProtectDiscoveryModel` | `DevicesUnifiProtectPluginDataDiscovery` | `status`, `failure_reason`, `warnings`, `started_at`, `finished_at`, `interfaces`, `consoles`, `other_unifi_devices` |
  | `ProtectDiscoveryResponseModel` / `ProtectProbeResponseModel` | `DevicesUnifiProtectPluginResDiscovery` / `…ResProbe` | `data` over `BaseSuccessResponseModel` |
  | `ProtectProbeDto` / `ProtectProbeRequestDto` (DTO file) | `DevicesUnifiProtectPluginProbe` / `…ReqProbe` | `host` (`@IsProtectProbeHost`, `@Transform` trim + lowercase), optional `port` (`@IsInt @Min(1) @Max(65535)`); request wraps `{ data }` like `WledProbeRequestDto` |

  ```ts
  @ApiTags(DEVICES_UNIFI_PROTECT_PLUGIN_API_TAG_NAME) @Controller('discovery')
  export class ProtectDiscoveryController {
  	constructor(discovery: ProtectDiscoveryService, probe: ProtectDiscoveryProbeService);
  	getDiscovery(): ProtectDiscoveryResponseModel;                              // GET /discovery      operationId 'get-devices-unifi-protect-plugin-discovery'
  	scanDiscovery(): Promise<ProtectDiscoveryResponseModel>;                    // POST /discovery/scan  @HttpCode(200)  'scan-devices-unifi-protect-plugin-discovery'
  	probeHost(body: ProtectProbeRequestDto): Promise<ProtectProbeResponseModel>; // POST /discovery/probe @HttpCode(200)  'probe-devices-unifi-protect-plugin-discovery'
  }
  ```
  Each handler: `@Roles(UserRole.OWNER, UserRole.ADMIN)`, Swagger decorators before NestJS decorators, `ApiSuccessResponse`
  (never a Dto), `ApiInternalServerErrorResponse`; `probeHost` also `ApiBadRequestResponse('Invalid host or port')` and
  `@ApiBody({ type: ProtectProbeRequestDto })`. Probe failures are data (status 200), as in
  `homey-test-connection.controller.ts`. The controller builds model instances (nested too) from the service result
  and calls `probe.probe({ host: body.data.host, port: body.data.port ?? PROTECT_PROBE_DEFAULT_PORT })`.

- [ ] **Step 1: Write the failing tests**

```ts
// dto spec (plainToInstance + validate, forbidNonWhitelisted like the global pipe)
it('accepts { host: "192.168.1.10" } and defaults the port to undefined', ...);
it('lowercases and trims the host', ...);                                         // ' UniFi.Local ' -> 'unifi.local'
it.each(['http://x', '192.168.1.10:443', '169.254.169.254', '', 5])('rejects host %j', ...);
it.each([0, 65536, 1.5, '443'])('rejects port %j', ...);
it('rejects unknown properties', ...);                                            // { host, extra: 1 }
// controller spec
it('wraps the last scan in the response envelope with snake_case wire names', ...);       // instanceToPlain(response).data: status 'completed', other_unifi_devices 1, consoles[0].direct_connect_domain, consoles[0].probe.preferred_host, interfaces[0].broadcast_address
it('runs a scan and returns the finished result', ...);
it('probes the requested host and defaults the port to 443', ...);                         // probe called with { host: '192.168.1.10', port: 443 } and { host: 'unifi.local', port: 8443 }
it('returns an unreachable probe as a normal response', ...);
it('allows only owners and administrators on all three handlers', ...);                    // Reflect.getMetadata(ROLES_KEY, ProtectDiscoveryController.prototype.<each>) toEqual([OWNER, ADMIN]) (eslint-disable unbound-method, as homey-test-connection.controller.spec.ts)
it('never serialises request secrets or raw bodies', ...);                                 // JSON of the serialised probe response has none of: 'authorization', 'x-api-key', the system fixture's raw text
```

- [ ] **Step 2: Run to verify failure.** `pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect/controllers/protect-discovery.controller.spec.ts src/plugins/devices-unifi-protect/dto/protect-discovery-probe.dto.spec.ts`
  Expected: FAIL, "Cannot find module".

- [ ] **Step 3: Implement** models, DTO and controller as specified; model classes have no constructor logic
  (`Object.assign(new X(), …)` at the call site, as `HomeyConnectionTestService`).

- [ ] **Step 4: Wire the plugin (A2).** In `devices-unifi-protect.plugin.ts` add to `providers`:
  `ProtectDiscoveryService`, `ProtectDiscoveryProbeService`,
  `{ provide: PROTECT_PROBE_TRANSPORT, useFactory: () => new NodeProtectProbeTransport() }`,
  `{ provide: PROTECT_DISCOVERY_ENVIRONMENT, useFactory: createNodeDiscoveryEnvironment }`; add
  `ProtectDiscoveryController` to `controllers`. Add every new model and DTO class (the nine above) to
  `DEVICES_UNIFI_PROTECT_PLUGIN_SWAGGER_EXTRA_MODELS`. Do not export the services (UP-12 uses HTTP).

- [ ] **Step 5: Run unit tests, type-check, regenerate and lint the contract**

Run:
```bash
pnpm --filter ./apps/backend exec jest src/plugins/devices-unifi-protect
pnpm --filter ./apps/backend exec tsc --noEmit -p tsconfig.json
pnpm run generate:openapi
grep -Eo 'operationId": "(get|scan|probe)-devices-unifi-protect-plugin-discovery"' spec/api/v1/openapi.json | wc -l
pnpm --filter ./apps/backend run lint:api && pnpm --filter ./apps/backend run lint:openapi:spec
```
Expected: all tests PASS; `tsc` silent; the `grep … | wc -l` prints `3`; both linters exit 0 (spectral prints no warnings).
Do not `git add` any regenerated file (roadmap A11); `git status` must list only plugin sources.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/plugins/devices-unifi-protect
git commit -m "feat(backend): expose UniFi Protect discovery and probe endpoints"
```

---

### Task 6: End-to-end test, live check, epic status and PR body

**Files:**
- Create: `apps/backend/test/devices-unifi-protect-discovery.e2e-spec.ts`
- Modify: `tasks/epics/EPIC-UNIFI-PROTECT.md:101`
- Write (outside the repo, not committed): the PR body file in the session scratchpad.

**Interfaces:** Consumes everything above plus UP-5's `PROTECT_TEST_TLS`/`protectTlsServerOptions`, `createFakeDiscoveryEnvironment`,
`buildDiscoveryReply`. Modelled on `apps/backend/test/cameras-live.e2e-spec.ts:270-330` (plugin mounted through
`AppModule.register({ moduleExtensions: [], pluginExtensions: [{ routePrefix: DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX, extensionClass: DevicesUnifiProtectPlugin }] })`,
global filters and pipes as `main.ts`, `api = '/api/v1'`, owner and USER accounts as in
`devices-modbus-probe.e2e-spec.ts:155-190`). Overrides: `PROTECT_DISCOVERY_ENVIRONMENT` with `fake.env` (a reply built
from `__fixtures__/discovery-reply.bin`, sent from `127.0.0.1`), and `PROTECT_PROBE_TRANSPORT` with a test-local
subclass of `NodeProtectProbeTransport` that overrides `get` and `checkCertificate` to rewrite port `443` to the port
of a local `https.createServer` (UP-5's `protectTlsServerOptions()`) serving `__fixtures__/system.json` on
`/api/system` and `401` on `/proxy/protect/api` (every other port passes through unchanged), and overrides
`resolveAll` to return `[]` so the suite makes no DNS query. Base path
`${api}/plugins/devices-unifi-protect/discovery`.

- [ ] **Step 1: Write the e2e tests** (the production code already exists, so this is an integration test of the
  wiring; Step 3 proves the roles test can fail)

```ts
it('rejects unauthenticated requests with 401 on all three routes', ...);
it('rejects a USER with 403 on all three routes', ...);
it('returns an idle scan before any scan ran', ...);                         // GET -> data.status 'idle', consoles [], other_unifi_devices 0
it('scans through the fake network and lists the console with a real probe', ...);   // POST scan -> status 'completed'; consoles[0].model 'UNVR', .hostname 'Dream-Machine-Pro', .probe.status 'console', .probe.protect 'present', .probe.certificate.valid false (self-signed), .probe.preferred_host '127.0.0.1'; then GET returns the same data
it('probes a manually entered host and reports an untrusted certificate', ...);      // POST probe {host:'127.0.0.1', port:<server port>} -> 200, status 'console', protect 'present', certificate.error_code 'DEPTH_ZERO_SELF_SIGNED_CERT', preferred_host '127.0.0.1'
it('reports a closed port as a 200 unreachable result', ...);                         // failure 'connection_refused', preferred_host null
it.each(['http://127.0.0.1', '127.0.0.1/api', '169.254.169.254', ''])('rejects host %j with 400', ...);   // and the HTTPS server saw no new request
it('rejects an unknown body property with 400', ...);
```

- [ ] **Step 2: Run**

Run: `pnpm --filter ./apps/backend exec jest --config ./test/jest-e2e.json test/devices-unifi-protect-discovery.e2e-spec.ts --detectOpenHandles`
Expected: PASS, 11 tests (the four `it.each` rows count), no open-handle report. Fix the test, not the product, unless a
real defect shows.

- [ ] **Step 3: Prove the roles test can fail**

Temporarily delete the `@Roles(...)` line above `scanDiscovery` in `controllers/protect-discovery.controller.ts`, run
the Step 2 command. Expected: the `rejects a USER with 403` test FAILS for `POST scan`. Restore with
`git checkout -- apps/backend/src/plugins/devices-unifi-protect/controllers/protect-discovery.controller.ts` and rerun
Step 2 to PASS.

- [ ] **Step 4: Full backend gates**

Run:
```bash
pnpm --filter ./apps/backend run lint:js
pnpm --filter ./apps/backend run pretty:check
pnpm --filter ./apps/backend run lint:deps
pnpm run test:unit
```
Expected: all exit 0 (`madge` reports no circular dependency; the unit suite passes in full).

- [ ] **Step 5: Live check on the maintainer's LAN (skip with a note in the PR body when no console is reachable)**

Write a throwaway script in the session scratchpad that builds `new ProtectDiscoveryService(env, new ProtectDiscoveryProbeService(new NodeProtectProbeTransport()))`
with `env = createNodeDiscoveryEnvironment()` whose sockets are wrapped to (a) optionally drop outgoing datagrams that
start with `0x01`, and (b) print `length` and the `parseDiscoveryReply` result code of every incoming datagram (no
payload). It awaits `scan()` and prints `status`, interface names and codes, per console `model`, `firmware`, `probe.status`,
`probe.protect`, `probe.certificate.valid`, `probe.preferred_host === probe.host`, with MACs, hosts and the domain
replaced by `***`. Run it twice: as is, and with the V1 datagrams dropped (V2 only).
Expected as is: `completed`, at least one console with `model UNVR`, `protect present`, `certificate.valid true`,
`other_unifi_devices >= 1`. The V2-only run is exploratory: record in the PR body whether any reply arrived and its
`parseDiscoveryReply` outcome (`unsupported_version` is the expected answer); if a V2 reply parses differently than
documented, file a follow-up issue, do not extend this PR. Do not commit the script or any capture.

- [ ] **Step 6: Mark the issue done in the epic file**

Edit `tasks/epics/EPIC-UNIFI-PROTECT.md` line 101 so the first cell reads `UP-6 (done)`, matching the UP-1/2/3 rows.

- [ ] **Step 7: Commit the e2e test and the epic status separately**

```bash
git add apps/backend/test/devices-unifi-protect-discovery.e2e-spec.ts
git commit -m "test(backend): cover UniFi Protect discovery end to end"
git add tasks/epics/EPIC-UNIFI-PROTECT.md
git commit -m "docs(tasks): mark UniFi Protect discovery done"
```

- [ ] **Step 8: Write the PR body to a file (do not push, do not open the PR)**

Path: `<session scratchpad>/pr-body-unifi-protect-discovery.md`. Title line first:
`feat(backend): discover UniFi Protect consoles on the local network`. Body sections: Summary (3 bullets), Endpoints
table (route, role, purpose), Deviations from issue #1182 and the design with reasons (the list in "Decisions
recorded" below), Test plan (commands of Tasks 1-6 with pass counts), Live check result (Step 5, MACs masked),
Known limits (broadcast does not cross VLANs; Docker needs host networking, documented in UP-19), `Closes #1182`,
then the line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

---

## Decisions recorded (for the PR body)

1. Broadcast goes to each interface's subnet broadcast address only; `255.255.255.255` is not used (fails with
   `EADDRNOTAVAIL` on macOS; the subnet address was verified live). Issue #1182 and design §8 list it.
2. TLV set is the live-verified one (`0x01 0x02 0x03 0x0b 0x0c 0x30 0x33`). Design §8 names `0x0C` "platform", `0x14`
   model, `0x15` product, `0x16` version, `0x2B` guid, `0x2F` primary address; live data shows `0x0c` is the short
   model, the GUID is `0x33`, and `0x14`/`0x15`/`0x16`/`0x2f` are unverified or mean something else. The host to
   probe is the datagram's source address instead of `0x2F`.
3. V2 request is still sent (issue AC) but V2 replies are not parsed; nothing is known about them.
4. Probe addition beyond the issue: optional `port` (default 443) because the UP-5 config has a `port`; a
   `domain_resolves_to_host` check so `preferred_host` is never a name that cannot connect; non-unicast/link-local
   host rejection.
5. Scan probes every candidate itself, so `GET discovery` already says which consoles run Protect.

## Self-review

**Spec coverage (design §8, issue #1182, roadmap UP-6):**

| Requirement | Task |
|---|---|
| UDP discovery with `dgram`, V1/V2, broadcast + multicast, resend within a window | 4 |
| Reply header `>BBH` + TLV parser, de-duplication by MAC | 1, 4 |
| Truncated/oversized TLVs rejected inside the parser, never thrown past it | 1 |
| Probe `GET /api/system` and `GET /proxy/protect/api` (401 ⇒ Protect), with timeouts | 2, 3 |
| `directConnectDomain` certificate validity, preferred host | 3 |
| Manually entered hosts probed | 3, 5 |
| `GET discovery`, `POST discovery/scan`, `POST discovery/probe` with OpenAPI models, owner/admin only | 5, 6 |
| Socket errors reported as scan status, never crash | 4 |
| Tests from UP-0 captures and probe classification | 1, 2, 3 |
| Both header versions; non-console devices ignored | 1, 4 |
| Epic status | 6 |

**Step scan:** every code step names a signature or an algorithm paragraph that decides the open choices; test steps
list names with the exact values; verification steps carry the command and expected output. Two spots are
deliberately conditional and say what to do: A3 (UP-5's TLS policy names) and the fixture layout check (Task 1 Step 2).

**Type consistency:** `ProtectProbeResult` (Task 3) is implemented by `ProtectProbeModel` (Task 5) and is the type of
`ProtectDiscoveryScan.consoles[].probe` (Task 4); enums are defined once in `protect-discovery.constants.ts`
(Task 1 creates the file, Tasks 2 and 4 append); `ProtectProbeTarget` is exported from the transport file and used by
the service, the discovery service and the controller; `PROTECT_PROBE_DEFAULT_PORT` is used by Tasks 4 and 5.

**Review Focus:** items 1-5 each have a named test (Task 4: `adds container_network_isolated…`, `drops a probed
candidate that is not a console…`, `keeps at most 16 candidates…`; Task 3: `keeps the IP when the domain does not
resolve`, transport `kind` tests; Task 2: `system 404`/HTML rows).

**Proportion:** about 6 tasks and 45 steps for roughly 1,800 lines of source and tests; the plan carries signatures,
test names with assertions, exact values and one algorithm paragraph per non-trivial unit, no function bodies.
