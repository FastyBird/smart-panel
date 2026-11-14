# UniFi Protect fixtures

Fixtures for the UniFi Protect plugin (epic `tasks/epics/EPIC-UNIFI-PROTECT.md`, task UP-0). Later tasks (UP-5 to UP-10)
build their client types, mappers and tests against these files. `fixtures.spec.ts` guards their integrity.

Two kinds of files exist:

- **captured (sanitized, Protect 7.3.74, UVC G5 Dome, 2026-11-14)** - real responses from a UniFi OS console with two
  UVC G5 Dome cameras, sanitized as described below.
- **synthetic** - hand-built from the design doc
  (`docs/superpowers/specs/2026-10-06-unifi-protect-integration-design.md`, section 4.1) and the Protect OpenAPI shapes
  it lists, for devices the capture console does not have. Every JSON object (and every line of a `.jsonl` file)
  carries `"_synthetic": true`. They are **unverified against real hardware**; replace them with captures when such
  hardware is available. A `_state` key in `sensors.json` only labels the scenario.

| File | Origin | Content |
|---|---|---|
| `meta-info.json` | captured (sanitized, Protect 7.3.74, UVC G5 Dome, 2026-11-14) | `GET /v1/meta/info` |
| `nvrs.json` | captured (sanitized, Protect 7.3.74, UVC G5 Dome, 2026-11-14) | `GET /v1/nvrs` (a single NVR object, not an array) |
| `cameras.json` | captured (sanitized, Protect 7.3.74, UVC G5 Dome, 2026-11-14) | `GET /v1/cameras`, two H.264 dome cameras, no doorbell |
| `liveviews.json` | captured (sanitized, Protect 7.3.74, UVC G5 Dome, 2026-11-14) | `GET /v1/liveviews` |
| `rtsps-stream.json` | captured (sanitized, Protect 7.3.74, UVC G5 Dome, 2026-11-14) | `GET /v1/cameras/{id}/rtsps-stream`; only enabled qualities are non-null |
| `snapshot-hq-unsupported.json` | captured (sanitized, Protect 7.3.74, UVC G5 Dome, 2026-11-14) | 400 body of `snapshot?highQuality=true` on a camera without `supportFullHdSnapshot` |
| `rate-limit-headers.json` | captured (sanitized, Protect 7.3.74, UVC G5 Dome, 2026-11-14) | `RateLimit` / `RateLimit-Policy` / `Retry-After` headers of a 200 and of a 429 |
| `system.json` | captured (sanitized, Protect 7.3.74, UVC G5 Dome, 2026-11-14) | unauthenticated `GET /api/system` |
| `discovery-reply.bin` | captured (sanitized, Protect 7.3.74, UVC G5 Dome, 2026-11-14) | UDP 10001 reply of the console, header version 1 (402 bytes) |
| `discovery-reply-v0.bin` | captured (sanitized, Protect 7.3.74, UVC G5 Dome, 2026-11-14) | UDP 10001 reply of a non-console UniFi device, header version 0 (114 bytes) |
| `cameras-doorbell.json` | synthetic | doorbell camera with `featureFlags.hasLcdScreen` and a variant with `hasPackageCamera` |
| `rtsps-stream-post.json` | synthetic | `POST /v1/cameras/{id}/rtsps-stream` request and response |
| `sensors.json` | synthetic | UP-Sense in idle, open, motion, leak, tamper and battery-low states |
| `lights.json` | synthetic | UP Floodlight |
| `chimes.json` | synthetic | chime |
| `ws-devices.jsonl` | synthetic | `subscribe/devices` frames: camera state, doorbell LCD, sensor open/close/motion/leak/tamper/battery, light, add, remove |
| `ws-events.jsonl` | synthetic | `subscribe/events` frames: motion, smartDetectZone person/vehicle, smartDetectLine, smartAudioDetect alrmSmoke/alrmBabyCry, ring, sensorOpened/Closed/Motion/WaterLeak/Tamper, lightMotion; each event is an `add` (`end: null`) followed by an `update` with `end` |
| `snapshot.jpg` | synthetic | 32x18 gradient JPEG generated for tests, not a camera image |

Event frames were **not** captured: the capture console saw no motion during the 6 minute observation (see section 6 of
the design doc).

## Sanitization rules (captured files)

- Object ids, MAC addresses and GUIDs are replaced by stable fakes (the same input always maps to the same fake;
  MACs use the `0CEA1400...` prefix, GUIDs are fake UUIDs).
- IP addresses are replaced by addresses from `192.0.2.0/24` (RFC 5737 documentation range).
- `directConnectDomain` (`<hex>.id.ui.direct`) is replaced by `0cea14000000000000000000000000000000.id.ui.direct`.
- RTSPS stream aliases (a bearer secret) are replaced by `REDACTEDALIAS...`; the rate-limit policy key by `REDACTED`.
- Camera and NVR names are replaced by generic names. No API key, token or cookie is stored.
- Remaining generic values (product names such as "Dream Machine Pro", UniFi product-database ids and image hashes,
  arm status, default doorbell text) are not personal.
