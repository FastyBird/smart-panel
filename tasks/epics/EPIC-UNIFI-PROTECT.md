# Task: UniFi Protect cameras and sensors integration

ID: EPIC-UNIFI-PROTECT
Type: epic
Scope: backend, admin, panel, installer, spec, website
Size: large
Parent: (none)
Status: planned
Created: 2026-10-06
GitHub: #1175

## 1. Business goal

In order to see who is at the door and what is happening around the house from the same place I control my home,
As a user with a UniFi Protect system (cameras, doorbell, UP-Sense sensors, floodlights),
I want Smart Panel to discover my console, adopt its devices, raise security alerts from their detections and show
live camera video and snapshots in the admin and on the wall panel.

## 2. Context

- Analysis and design: [`docs/superpowers/specs/2026-10-06-unifi-protect-integration-design.md`](../../docs/superpowers/specs/2026-10-06-unifi-protect-integration-design.md).
  It records the API research (public Integration API vs private API), how Home Assistant integrates Protect, the
  current gaps in Smart Panel and the proposed decisions D1–D10.
- Smart Panel has **no** video streaming or snapshot code today; the `camera` channel has no defined way to expose a
  stream; flutter-pi is built without its GStreamer video player; the security module ignores `camera`/`doorbell`
  channels. The epic therefore also delivers a reusable core `cameras` module and a go2rtc relay.
- Reference implementations: `apps/backend/src/plugins/devices-homey` (REST + realtime hub, secrets, adoption),
  `apps/backend/src/plugins/devices-home-assistant` (ws client, discovery service), `apps/admin/src/plugins/devices-homey`
  (config form + wizard adapter), `apps/backend/src/modules/security` (detection rules).
- Prior art: Home Assistant `unifiprotect` and `unifi_discovery`, `uilibs/uiprotect`, `hjdhjd/unifi-protect` /
  `homebridge-unifi-protect`, Scrypted, go2rtc, Frigate.

## 3. Scope

**In scope (MVP)**

- Core `cameras` module: stream-provider registry, snapshot endpoint with cache, stream sessions with short-lived
  tokens, go2rtc relay as a managed service, authenticated live WebSocket (MSE) for browsers.
- go2rtc shipped with the Raspberry Pi image, Linux installer and Docker image.
- Spec extension: `object_detection` channel, more optional channels on `camera`/`doorbell`, multiple `camera`
  channels, defined `camera.source` semantics.
- `devices-unifi-protect` plugin on the public Integration API (API key): config with write-only secret and TLS
  policy, UDP discovery, mapping + adoption of cameras, doorbells, UP-Sense sensors and floodlights, real-time sync
  over both WebSockets, control of floodlights / status LEDs / mic volume, stream and snapshot provider.
- Admin: camera live view + snapshot components for every camera/doorbell device; plugin config form and adoption
  wizard.
- Panel: snapshot views on camera/doorbell detail pages and a Cameras tab on the security screen; doorbell-ring
  overlay; source camera in alert overlays.
- Security: alerts from object detections (motion, contact, leak, smoke already work through existing rules).
- Documentation and hardware acceptance.

**In scope (later milestones, after the MVP)**

- Live video on the panel (flutter-pi GStreamer video player, HLS/fMP4 endpoint) — UP-15.
- Protect Alarm Manager as an `alarm` device (optional) — UP-17.
- Optional full-access mode on the private API (privacy/recording/IR mode, reboot, chime play) — UP-18.

**Out of scope**

- Recording browsing, event clips and thumbnails, timeline/NVR playback.
- Chimes, sirens, relays, alarm hubs, speakers, viewers/liveviews, NVR health, PTZ, doorbell LCD text, talkback,
  NFC/fingerprint, licence-plate text.
- Video transcoding (HEVC/AV1 → H.264), WebRTC (optional enhancement after MSE).
- Snapshot images in notifications.
- Multiple consoles per installation (identifiers are prepared for it).
- UniFi cloud connector and SSO/cloud-only accounts.

## 4. Acceptance criteria

- [ ] Decisions D1–D10 of the design confirmed (or amended) and recorded in the design doc.
- [ ] A console is discovered or entered, connected with an API key and verified against the minimum Protect version.
- [ ] Cameras, doorbells, UP-Sense sensors and floodlights are adopted through the wizard, idempotently, and stay in
      sync in real time, including after console reboot, Protect update and network loss.
- [ ] Motion, object detections, contact, leak and smoke/CO detections raise security alerts; doorbell rings reach
      the panel as an overlay.
- [ ] Live view works in the admin (Chrome, Firefox, Safari; H.264), also through remote access; snapshots work on
      the panel (flutter-pi on Pi 4/Pi 5 and Android).
- [ ] The API key and RTSPS stream aliases never appear in logs, API responses, persisted data or diagnostics.
- [ ] Hardware acceptance matrix (UP-20) recorded below; documentation published.

## 5. Tasks

Sub-issues of #1175. PR titles are the issue titles unless stated otherwise.

| ID | Issue | Milestone | Task | Depends on |
|---|---|---|---|---|
| UP-0 | #1176 | M0 | API compatibility spike, fixtures, go2rtc and flutter-pi measurements | hardware access |
| UP-1 | #1177 | M0 | `feat(cross): extend camera specs with object detection and multi-stream channels` | D8 |
| UP-2 | #1178 | M1 | `feat(backend): add cameras module with stream provider registry and snapshots` | D1, UP-1 (merge) |
| UP-3 | #1179 | M1 | `feat(backend): relay camera live streams through a managed go2rtc service` | UP-2, UP-0 |
| UP-4 | #1180 | M1 | `feat(installer): ship go2rtc with server installations` | UP-0 |
| UP-5 | #1181 | M2 | `feat(backend): add UniFi Protect plugin foundation and API client` | D2–D4, D10 |
| UP-6 | #1182 | M2 | `feat(backend): discover UniFi Protect consoles on the local network` | UP-5 |
| UP-7 | #1183 | M2 | `feat(backend): map and adopt UniFi Protect cameras, doorbells, sensors and floodlights` | UP-1, UP-5, D9 |
| UP-8 | #1184 | M2 | `feat(backend): sync UniFi Protect device state and events in real time` | UP-7 |
| UP-9 | #1185 | M2 | `feat(backend): control UniFi Protect floodlights and camera settings` | UP-8 |
| UP-10 | #1186 | M2 | `feat(backend): provide UniFi Protect camera streams and snapshots` | UP-2, UP-7 (UP-3 for live) |
| UP-11 | #1187 | M3 | `feat(admin): add camera live view and snapshot components` | UP-2, UP-3 |
| UP-12 | #1188 | M3 | `feat(admin): add UniFi Protect plugin configuration and adoption wizard` | UP-5, UP-6, UP-7 |
| UP-13 | #1189 | M4 | `feat(panel): show camera snapshots on camera and doorbell detail pages` | UP-2 |
| UP-14 | #1190 | M4 | `feat(panel): show the doorbell camera on ring and the source camera on alerts` | UP-8, UP-13 |
| UP-15 | #1192 | M4 (later) | `feat(cross): play live camera video on the panel` (split into installer/backend/panel PRs) | UP-0, UP-3, UP-4, UP-13 |
| UP-16 | #1193 | M5 | `feat(backend): raise security alerts from camera object detections` | UP-1 |
| UP-17 | #1194 | M5 (optional) | `feat(backend): expose the UniFi Protect alarm manager as an alarm device` | UP-8 |
| UP-18 | #1195 | M5 (optional) | `feat(backend): add optional full-access mode for UniFi Protect private API features` | UP-9, decision |
| UP-19 | #1196 | M6 | `docs(cross): document the UniFi Protect integration and camera live view` | UP-11, UP-12 |
| UP-20 | #1197 | M6 | Integrated verification and hardware acceptance | MVP items merged |

### Execution order

1. **M0:** UP-0 and UP-1 in parallel; confirm D1–D10.
2. **M1:** UP-2 → UP-3; UP-4 in parallel.
3. **M2:** UP-5 → (UP-6 ∥ UP-7) → UP-8 → (UP-9 ∥ UP-10).
4. **M3/M4:** UP-11 after UP-3; UP-12 after UP-7; UP-13 after UP-2; UP-14 after UP-8 + UP-13.
5. **M5/M6:** UP-16 after UP-1; UP-19; UP-20 closes the MVP. UP-15, UP-17, UP-18 follow the MVP.

### Parallel lanes

- Lane A (core streaming): UP-2 → UP-3 → UP-11.
- Lane B (plugin backend): UP-5 → UP-6/UP-7 → UP-8 → UP-9/UP-10.
- Lane C (spec, security, panel): UP-1 → UP-16; UP-13 → UP-14.
- Lane D (installer): UP-4.
- Shared files (`app.module.ts`, `app.main.ts`, `openapi.constants.ts`, locale indexes) are edited by appending;
  generated files are regenerated in the PR that changes their source, never edited by hand.

## 6. Technical constraints

- Follow the Homey plugin structure and the Devices module API conventions (see `CLAUDE.md`).
- No new runtime dependency in the backend for the UniFi client (use `ws` and Node built-ins); go2rtc is an external
  binary, not an npm package.
- Incremental migrations only.
- Secrets follow `docs/config-secrets.md`; stream aliases are memory-only.
- Every external call has a timeout; the console rate budget is shared by REST, snapshots and polling.
- Tests are expected for new logic (unit next to source, e2e against a fake Protect server).

## 7. Verification

Hardware acceptance (UP-20) results are recorded here with date, release and outcome per row.

| Row | Date | Release | Outcome |
|---|---|---|---|
| — | — | — | not started |

## 8. AI instructions

- Read the design doc and this file entirely before making changes; work on one sub-issue per branch and PR.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes inside the sub-issue's file ownership; report anything outside it instead of widening scope.
- For each acceptance criterion, either implement it or explain why it is skipped.
